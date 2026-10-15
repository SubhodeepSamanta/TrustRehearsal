import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { LabCertStore, issueLeafCertificate, IssuedCertificate } from './ca.js';
import { SampleServiceInstance } from './sampleServices.js';

export interface ControllerOptions {
  baseDir?: string;
  controllerSecret?: string;
  ephemeralPorts?: boolean;
}

export class LabController {
  public certStore: LabCertStore;
  public services: Map<string, SampleServiceInstance> = new Map();
  public proxyFaultEnabled: boolean = false;
  public highestAcceptedFence: number = 0;
  public managementToken: string;
  public caProxyPort: number = 18440;
  public ephemeralPorts: boolean = false;
  private caProxyServer?: http.Server;

  constructor(options: ControllerOptions = {}) {
    this.certStore = new LabCertStore(options.baseDir);
    this.managementToken = options.controllerSecret || crypto.randomBytes(24).toString('hex');
    this.ephemeralPorts = !!options.ephemeralPorts;
    if (this.ephemeralPorts) {
      this.caProxyPort = 0;
    }
  }

  public getServicePort(name: string): number {
    const s = this.services.get(name);
    return s?.httpsServer ? (s.httpsServer.address() as any).port : 0;
  }

  public async initialize(): Promise<void> {
    this.certStore.initializeRoots();

    const gatewaySans = ['gateway', 'localhost', '127.0.0.1'];
    const ordersSans = ['orders', 'localhost', '127.0.0.1'];
    const ledgerSans = ['ledger', 'localhost', '127.0.0.1'];

    let gatewayA0 = this.certStore.loadProfile('gateway', 'A0');
    if (!gatewayA0) {
      gatewayA0 = issueLeafCertificate(this.certStore.rootA, 'gateway', gatewaySans);
      this.certStore.saveProfile('gateway', 'A0', gatewayA0);
    }

    let ordersA0 = this.certStore.loadProfile('orders', 'A0');
    if (!ordersA0) {
      ordersA0 = issueLeafCertificate(this.certStore.rootA, 'orders', ordersSans);
      this.certStore.saveProfile('orders', 'A0', ordersA0);
    }

    let ledgerA0 = this.certStore.loadProfile('ledger', 'A0');
    if (!ledgerA0) {
      ledgerA0 = issueLeafCertificate(this.certStore.rootA, 'ledger', ledgerSans);
      this.certStore.saveProfile('ledger', 'A0', ledgerA0);
    }

    let ordersB0 = this.certStore.loadProfile('orders', 'B0');
    if (!ordersB0) {
      ordersB0 = issueLeafCertificate(this.certStore.rootB, 'orders', ordersSans);
      this.certStore.saveProfile('orders', 'B0', ordersB0);
    }

    let ledgerB0 = this.certStore.loadProfile('ledger', 'B0');
    if (!ledgerB0) {
      ledgerB0 = issueLeafCertificate(this.certStore.rootB, 'ledger', ledgerSans);
      this.certStore.saveProfile('ledger', 'B0', ledgerB0);
    }

    const isEphemeral = this.ephemeralPorts;
    const ledgerPort = isEphemeral ? 0 : 8445;
    const ledgerMgmt = isEphemeral ? 0 : 18445;
    const ordersPort = isEphemeral ? 0 : 8444;
    const ordersMgmt = isEphemeral ? 0 : 18444;
    const gatewayPort = isEphemeral ? 0 : 8443;
    const gatewayMgmt = isEphemeral ? 0 : 18443;

    const ledger = new SampleServiceInstance({
      name: 'ledger',
      port: ledgerPort,
      managementPort: ledgerMgmt,
      activeProfile: ledgerA0,
      trustedCaPem: this.certStore.rootA.certPem,
      managementToken: this.managementToken
    });

    const orders = new SampleServiceInstance({
      name: 'orders',
      port: ordersPort,
      managementPort: ordersMgmt,
      activeProfile: ordersA0,
      trustedCaPem: this.certStore.rootA.certPem,
      managementToken: this.managementToken,
      downstream: { name: 'ledger', port: ledgerPort }
    });

    const gateway = new SampleServiceInstance({
      name: 'gateway',
      port: gatewayPort,
      managementPort: gatewayMgmt,
      activeProfile: gatewayA0,
      trustedCaPem: this.certStore.rootA.certPem,
      managementToken: this.managementToken,
      downstream: { name: 'orders', port: ordersPort }
    });

    this.services.set('gateway', gateway);
    this.services.set('orders', orders);
    this.services.set('ledger', ledger);

    // Start CA issuance proxy
    this.caProxyServer = http.createServer((req, res) => {
      // Authenticate and authorize issuer operations
      const authHeader = req.headers['authorization'];
      if (!authHeader || authHeader !== `Bearer ${this.managementToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'UNAUTHORIZED',
            message: 'Missing or invalid management bearer token for CA issuance'
          })
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/issue') {
        if (this.proxyFaultEnabled) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'CA_PROXY_UNAVAILABLE',
              message: 'HTTP 502 Bad Gateway: CA Issuance Proxy network partition simulated'
            })
          );
          return;
        }

        let body = '';
        let bodyLength = 0;
        const MAX_BODY_SIZE = 16384; // 16KB limit

        req.on('data', (c) => {
          bodyLength += c.length;
          if (bodyLength > MAX_BODY_SIZE) {
            req.destroy();
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', message: 'Request exceeds maximum size limit' }));
            return;
          }
          body += c;
        });

        req.on('end', () => {
          if (res.writableEnded) return;
          try {
            const data = JSON.parse(body);
            const validServices = ['gateway', 'orders', 'ledger'];
            if (!validServices.includes(data.serviceName)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'INVALID_SERVICE', message: `Invalid serviceName: ${data.serviceName}` }));
              return;
            }
            if (data.caName !== 'A' && data.caName !== 'B') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'INVALID_CA', message: `Invalid caName: ${data.caName}` }));
              return;
            }

            const ca = data.caName === 'B' ? this.certStore.rootB : this.certStore.rootA;
            const sanList = [data.serviceName, 'localhost', '127.0.0.1'];
            const cert = issueLeafCertificate(ca, data.serviceName, sanList);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ profile: cert }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.caProxyServer!.listen(this.caProxyPort, '127.0.0.1', () => {
        this.caProxyPort = (this.caProxyServer!.address() as any).port;
        resolve();
      });
      this.caProxyServer!.on('error', reject);
    });

    await Promise.all([gateway.start(), orders.start(), ledger.start()]);

    if (isEphemeral) {
      const actualLedgerPort = (ledger.httpsServer.address() as any).port;
      const actualOrdersPort = (orders.httpsServer.address() as any).port;
      orders.downstream = { name: 'ledger', port: actualLedgerPort };
      gateway.downstream = { name: 'orders', port: actualOrdersPort };
    }
  }

  public validateFence(fence: number): boolean {
    if (fence < this.highestAcceptedFence) {
      return false;
    }
    this.highestAcceptedFence = fence;
    return true;
  }

  public async issueNewProfileAsync(
    serviceName: string,
    caName: 'A' | 'B',
    profileName: string
  ): Promise<IssuedCertificate> {
    if (this.caProxyServer && this.caProxyServer.listening) {
      const response = await fetch(`http://127.0.0.1:${this.caProxyPort}/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.managementToken}`
        },
        body: JSON.stringify({ serviceName, caName, profileName })
      });

      if (!response.ok) {
        const errJson: any = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${response.status} Bad Gateway: CA Issuance Proxy network partition simulated`);
      }

      const resData: any = await response.json();
      const cert: IssuedCertificate = resData.profile;
      this.certStore.saveProfile(serviceName, profileName, cert);
      return cert;
    }

    // Direct issuance fallback if proxy server is unstarted (e.g. isolated test doubles)
    const ca = caName === 'A' ? this.certStore.rootA : this.certStore.rootB;
    const sanList = [serviceName, 'localhost', '127.0.0.1'];
    const cert = issueLeafCertificate(ca, serviceName, sanList);
    this.certStore.saveProfile(serviceName, profileName, cert);
    return cert;
  }

  public issueNewProfile(
    serviceName: string,
    caName: 'A' | 'B',
    profileName: string
  ): IssuedCertificate {
    if (this.proxyFaultEnabled && caName === 'A') {
      throw new Error('HTTP 502 Bad Gateway: CA Issuance Proxy network partition simulated');
    }

    const ca = caName === 'A' ? this.certStore.rootA : this.certStore.rootB;
    const sanList = [serviceName, 'localhost', '127.0.0.1'];
    const cert = issueLeafCertificate(ca, serviceName, sanList);
    this.certStore.saveProfile(serviceName, profileName, cert);
    return cert;
  }

  public installProfile(serviceName: string, profile: IssuedCertificate, fence?: number): void {
    if (fence !== undefined && !this.validateFence(fence)) {
      throw new Error(`STALE_FENCE_AUTHORITY: fence ${fence} is lower than highest accepted ${this.highestAcceptedFence}`);
    }
    const service = this.services.get(serviceName);
    if (!service) throw new Error(`Unknown service: ${serviceName}`);
    service.installedProfile = profile;
  }

  public reloadServiceContext(serviceName: string, fence?: number): void {
    if (fence !== undefined && !this.validateFence(fence)) {
      throw new Error(`STALE_FENCE_AUTHORITY: fence ${fence} is lower than highest accepted ${this.highestAcceptedFence}`);
    }
    const service = this.services.get(serviceName);
    if (!service) throw new Error(`Unknown service: ${serviceName}`);
    service.reloadContext();
  }

  public setServiceTrust(serviceName: string, trustedCaPem: string, fence?: number): void {
    if (fence !== undefined && !this.validateFence(fence)) {
      throw new Error(`STALE_FENCE_AUTHORITY: fence ${fence} is lower than highest accepted ${this.highestAcceptedFence}`);
    }
    const service = this.services.get(serviceName);
    if (!service) throw new Error(`Unknown service: ${serviceName}`);
    service.updateTrust(trustedCaPem);
  }

  public setIssuanceProxyFault(enabled: boolean): void {
    this.proxyFaultEnabled = enabled;
  }

  public async executeApplicationRequest(caPem?: string): Promise<{
    success: boolean;
    statusCode?: number;
    data?: any;
    error?: string;
    errorCode?: string;
    durationMs: number;
  }> {
    const certPem = caPem || `${this.certStore.rootA.certPem}\n${this.certStore.rootB.certPem}`;
    const start = process.hrtime.bigint();

    const gatewayPort = this.getServicePort('gateway') || 8443;

    return new Promise((resolve) => {
      const req = https.request(
        {
          host: '127.0.0.1',
          port: gatewayPort,
          path: '/api/sample',
          method: 'GET',
          servername: 'gateway',
          ca: certPem,
          rejectUnauthorized: true,
          timeout: 4000
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            const elapsed = Math.round(Number(process.hrtime.bigint() - start) / 10_000) / 100;
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve({ success: true, statusCode: res.statusCode, data: JSON.parse(body), durationMs: elapsed });
              } catch {
                resolve({ success: true, statusCode: res.statusCode, data: body, durationMs: elapsed });
              }
            } else {
              let parsedBody: any;
              try {
                parsedBody = JSON.parse(body);
              } catch {
                parsedBody = body;
              }
              resolve({
                success: false,
                statusCode: res.statusCode,
                error: `HTTP ${res.statusCode} from gateway`,
                data: parsedBody,
                durationMs: elapsed
              });
            }
          });
        }
      );

      req.on('error', (err: any) => {
        const elapsed = Math.round(Number(process.hrtime.bigint() - start) / 10_000) / 100;
        resolve({
          success: false,
          error: err.message,
          errorCode: err.code,
          durationMs: elapsed
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const elapsed = Math.round(Number(process.hrtime.bigint() - start) / 10_000) / 100;
        resolve({
          success: false,
          error: 'Connection to gateway timed out',
          errorCode: 'ETIMEDOUT',
          durationMs: elapsed
        });
      });

      req.end();
    });
  }

  public async resetToBaseline(fence?: number): Promise<void> {
    if (fence !== undefined && !this.validateFence(fence)) {
      throw new Error(`STALE_FENCE_AUTHORITY: fence ${fence} is lower than highest accepted ${this.highestAcceptedFence}`);
    }

    this.proxyFaultEnabled = false;

    const gatewayA0 = this.certStore.loadProfile('gateway', 'A0')!;
    const ordersA0 = this.certStore.loadProfile('orders', 'A0')!;
    const ledgerA0 = this.certStore.loadProfile('ledger', 'A0')!;
    const rootAPem = this.certStore.rootA.certPem;

    for (const [name, service] of this.services.entries()) {
      let baselineProfile = ordersA0;
      if (name === 'gateway') baselineProfile = gatewayA0;
      if (name === 'ledger') baselineProfile = ledgerA0;

      service.installedProfile = baselineProfile;
      service.trustedCaPem = rootAPem;
      service.reloadContext();
    }
  }

  public async stop(): Promise<void> {
    if (this.caProxyServer) {
      await new Promise<void>((resolve) => this.caProxyServer!.close(() => resolve()));
    }
    for (const service of this.services.values()) {
      await service.stop();
    }
  }
}
