import tls from 'tls';
import crypto from 'crypto';
import { TlsProbeData } from '../contracts/index.js';

export interface ProbeOptions {
  host: string;
  port: number;
  servername: string;
  caCertPem: string;
  caller: string;
  callee: string;
  trustProfile: string;
  timeoutMs?: number;
  sampleIndex?: number;
}

export async function executeTlsProbe(options: ProbeOptions): Promise<TlsProbeData> {
  const {
    host,
    port,
    servername,
    caCertPem,
    caller,
    callee,
    trustProfile,
    timeoutMs = 3000,
    sampleIndex
  } = options;

  const startTime = process.hrtime.bigint();

  return new Promise<TlsProbeData>((resolve) => {
    let settled = false;

    const finalize = (result: Partial<TlsProbeData>, error?: any) => {
      if (settled) return;
      settled = true;

      const endTime = process.hrtime.bigint();
      const elapsedMs = Number(endTime - startTime) / 1_000_000;

      resolve({
        caller,
        callee,
        servername,
        success: result.success ?? false,
        authorized: result.authorized ?? false,
        errorCode: error?.code || result.errorCode || null,
        errorMessage: error?.message || result.errorMessage || null,
        certificateFingerprint: result.certificateFingerprint || null,
        issuerFingerprint: result.issuerFingerprint || null,
        subjectAltNames: result.subjectAltNames || [],
        validFrom: result.validFrom || null,
        validTo: result.validTo || null,
        serialNumber: result.serialNumber || null,
        protocol: result.protocol || null,
        durationMs: Math.round(elapsedMs * 100) / 100,
        trustProfile,
        connectionFresh: true,
        sampleIndex
      });
    };

    const socket = tls.connect(
      {
        host,
        port,
        servername,
        ca: caCertPem,
        rejectUnauthorized: true,
        checkServerIdentity: (hostParam, cert) => tls.checkServerIdentity(hostParam, cert)
      },
      () => {
        try {
          const peerCert = socket.getPeerCertificate(true);
          const rawDer = peerCert.raw;
          const fingerprint = rawDer
            ? crypto.createHash('sha256').update(rawDer).digest('hex').toLowerCase()
            : null;

          let issuerFingerprint: string | null = null;
          if (peerCert.issuerCertificate && peerCert.issuerCertificate.raw) {
            issuerFingerprint = crypto
              .createHash('sha256')
              .update(peerCert.issuerCertificate.raw)
              .digest('hex')
              .toLowerCase();
          }

          const altNames = peerCert.subjectaltname
            ? peerCert.subjectaltname.split(', ').map((s) => s.replace(/^(DNS|IP Address):/, ''))
            : [];

          const protocol = socket.getProtocol();

          socket.end();

          finalize({
            success: true,
            authorized: socket.authorized,
            certificateFingerprint: fingerprint,
            issuerFingerprint,
            subjectAltNames: altNames,
            validFrom: peerCert.valid_from ? new Date(peerCert.valid_from).toISOString() : undefined,
            validTo: peerCert.valid_to ? new Date(peerCert.valid_to).toISOString() : undefined,
            serialNumber: peerCert.serialNumber,
            protocol
          });
        } catch (err: any) {
          socket.destroy();
          finalize({ success: false, authorized: false }, err);
        }
      }
    );

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      finalize({ success: false, authorized: false }, { code: 'ETIMEDOUT', message: `TLS probe timed out after ${timeoutMs}ms` });
    });

    socket.on('error', (err: any) => {
      finalize({
        success: false,
        authorized: false,
        errorCode: err.code || 'TLS_HANDSHAKE_ERROR',
        errorMessage: err.message
      }, err);
    });
  });
}
