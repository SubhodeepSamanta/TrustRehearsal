import forge from 'node-forge';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface GeneratedKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface IssuedCertificate {
  serialNumber: string;
  certPem: string;
  keyPem: string;
  fingerprint: string;
  issuerFingerprint: string;
  validFrom: Date;
  validTo: Date;
  sanList: string[];
}

export interface CaAuthority {
  name: string;
  certPem: string;
  keyPem: string;
  fingerprint: string;
}

export function computeFingerprintFromPem(certPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex').toLowerCase();
}

function generateKeyPair(bits: number = 2048): forge.pki.rsa.KeyPair {
  return forge.pki.rsa.generateKeyPair({ bits, workers: -1 });
}

export function createRootCa(commonName: string, validityDays: number = 365): CaAuthority {
  const keys = generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(16).toString('hex');
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  const attrs = [
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: 'TrustRehearsal Lab' },
    { name: 'countryName', value: 'US' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' }
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const fingerprint = computeFingerprintFromPem(certPem);

  return { name: commonName, certPem, keyPem, fingerprint };
}

export function issueLeafCertificate(
  ca: CaAuthority,
  commonName: string,
  sanList: string[],
  validityDays: number = 30
): IssuedCertificate {
  const keys = generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  const serial = crypto.randomBytes(16).toString('hex');
  cert.serialNumber = serial;

  const notBefore = new Date(Date.now() - 60 * 1000);
  const notAfter = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  const subjectAttrs = [
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: 'TrustRehearsal Lab Services' }
  ];
  cert.setSubject(subjectAttrs);

  const caCert = forge.pki.certificateFromPem(ca.certPem);
  cert.setIssuer(caCert.subject.attributes);
  cert.publicKey = keys.publicKey;

  const altNames = sanList.map((san) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(san)) {
      return { type: 7, ip: san };
    }
    return { type: 2, value: san };
  });

  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    { name: 'subjectAltName', altNames }
  ]);

  const caPrivateKey = forge.pki.privateKeyFromPem(ca.keyPem);
  cert.sign(caPrivateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const fingerprint = computeFingerprintFromPem(certPem);

  return {
    serialNumber: serial,
    certPem,
    keyPem,
    fingerprint,
    issuerFingerprint: ca.fingerprint,
    validFrom: notBefore,
    validTo: notAfter,
    sanList
  };
}

export class LabCertStore {
  private baseDir: string;
  public rootA!: CaAuthority;
  public rootB!: CaAuthority;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(__dirname, '../../lab/volumes/certs');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public initializeRoots(): void {
    const rootAPath = path.join(this.baseDir, 'root-a.json');
    const rootBPath = path.join(this.baseDir, 'root-b.json');

    if (fs.existsSync(rootAPath) && fs.existsSync(rootBPath)) {
      this.rootA = JSON.parse(fs.readFileSync(rootAPath, 'utf-8'));
      this.rootB = JSON.parse(fs.readFileSync(rootBPath, 'utf-8'));
    } else {
      this.rootA = createRootCa('TrustRehearsal Lab Root CA A');
      this.rootB = createRootCa('TrustRehearsal Lab Root CA B');
      fs.writeFileSync(rootAPath, JSON.stringify(this.rootA, null, 2), { mode: 0o600 });
      fs.writeFileSync(rootBPath, JSON.stringify(this.rootB, null, 2), { mode: 0o600 });
    }
  }

  public saveProfile(serviceName: string, profileName: string, cert: IssuedCertificate): void {
    const serviceDir = path.join(this.baseDir, serviceName);
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true });
    }
    const profilePath = path.join(serviceDir, `${profileName}.json`);
    fs.writeFileSync(profilePath, JSON.stringify(cert, null, 2), { mode: 0o600 });
  }

  public loadProfile(serviceName: string, profileName: string): IssuedCertificate | null {
    const profilePath = path.join(this.baseDir, serviceName, `${profileName}.json`);
    if (!fs.existsSync(profilePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  }
}
