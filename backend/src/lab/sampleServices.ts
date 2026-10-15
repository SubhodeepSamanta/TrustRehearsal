import https from 'https';
import http from 'http';
import { IssuedCertificate } from './ca.js';

export interface SampleServiceConfig {
  name: string;
  port: number;
  managementPort: number;
  activeProfile: IssuedCertificate;
  trustedCaPem: string;
}

export class SampleServiceInstance {
  public name: string;
  public port: number;
  public managementPort: number;
  public installedProfile: IssuedCertificate;
  public servingProfile: IssuedCertificate;
  public trustedCaPem: string;

  private httpsServer!: https.Server;
  private mgmtServer!: http.Server;
  private running: boolean = false;

  constructor(config: SampleServiceConfig) {
    this.name = config.name;
    this.port = config.port;
    this.managementPort = config.managementPort;
    this.installedProfile = config.activeProfile;
    this.servingProfile = config.activeProfile;
    this.trustedCaPem = config.trustedCaPem;
  }

  public reloadContext(): void {
    this.servingProfile = this.installedProfile;
    this.httpsServer.setSecureContext({
      cert: this.servingProfile.certPem,
      key: this.servingProfile.keyPem,
      ca: this.trustedCaPem
    });
  }

  public updateTrust(caPem: string): void {
    this.trustedCaPem = caPem;
    this.httpsServer.setSecureContext({
      cert: this.servingProfile.certPem,
      key: this.servingProfile.keyPem,
      ca: this.trustedCaPem
    });
  }

  public async start(): Promise<void> {
    if (this.running) return;

    const options: https.ServerOptions = {
      cert: this.servingProfile.certPem,
      key: this.servingProfile.keyPem,
      ca: this.trustedCaPem,
      rejectUnauthorized: true
    };

    this.httpsServer = https.createServer(options, (req, res) => {
      if (req.url === '/api/sample' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            service: this.name,
            servingFingerprint: this.servingProfile.fingerprint,
            timestamp: new Date().toISOString()
          })
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.mgmtServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        if (req.method === 'GET' && req.url === '/mgmt/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              name: this.name,
              installedFingerprint: this.installedProfile.fingerprint,
              servingFingerprint: this.servingProfile.fingerprint
            })
          );
        } else if (req.method === 'POST' && req.url === '/mgmt/install-profile') {
          try {
            const data = JSON.parse(body);
            this.installedProfile = data.profile;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'installed' }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        } else if (req.method === 'POST' && req.url === '/mgmt/reload-context') {
          try {
            this.reloadContext();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'reloaded' }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        } else if (req.method === 'POST' && req.url === '/mgmt/update-trust') {
          try {
            const data = JSON.parse(body);
            this.updateTrust(data.trustedCaPem);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'trust_updated' }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    await Promise.all([
      new Promise<void>((resolve) => this.httpsServer.listen(this.port, '127.0.0.1', () => resolve())),
      new Promise<void>((resolve) => this.mgmtServer.listen(this.managementPort, '127.0.0.1', () => resolve()))
    ]);

    this.running = true;
  }

  public async stop(): Promise<void> {
    if (!this.running) return;
    await Promise.all([
      new Promise<void>((resolve) => this.httpsServer.close(() => resolve())),
      new Promise<void>((resolve) => this.mgmtServer.close(() => resolve()))
    ]);
    this.running = false;
  }
}
