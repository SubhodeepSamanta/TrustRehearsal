import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { IssuedCertificate } from './ca.js';

export interface SampleServiceConfig {
  name: string;
  port: number;
  managementPort: number;
  activeProfile: IssuedCertificate;
  trustedCaPem: string;
  managementToken?: string;
  downstream?: {
    name: string;
    port: number;
    host?: string;
  };
}

export class SampleServiceInstance {
  public name: string;
  public port: number;
  public managementPort: number;
  public installedProfile: IssuedCertificate;
  public servingProfile: IssuedCertificate;
  public trustedCaPem: string;
  public managementToken: string;
  public downstream?: { name: string; port: number; host?: string };

  public httpsServer!: https.Server;
  public mgmtServer!: http.Server;
  private running: boolean = false;

  constructor(config: SampleServiceConfig) {
    this.name = config.name;
    this.port = config.port;
    this.managementPort = config.managementPort;
    this.installedProfile = config.activeProfile;
    this.servingProfile = config.activeProfile;
    this.trustedCaPem = config.trustedCaPem;
    this.managementToken = config.managementToken || crypto.randomBytes(24).toString('hex');
    this.downstream = config.downstream;
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

  public async forwardDownstream(): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
    const downstream = this.downstream;
    if (!downstream) {
      return { success: true };
    }

    return new Promise((resolve) => {
      const req = https.request(
        {
          host: downstream.host || '127.0.0.1',
          port: downstream.port,
          path: '/api/sample',
          method: 'GET',
          servername: downstream.name,
          ca: this.trustedCaPem,
          rejectUnauthorized: true,
          timeout: 4000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve({ success: true, data: JSON.parse(data) });
              } catch {
                resolve({ success: true, data });
              }
            } else {
              resolve({
                success: false,
                error: `HTTP ${res.statusCode} from ${downstream.name}`,
                data
              });
            }
          });
        }
      );

      req.on('error', (err: any) => {
        resolve({
          success: false,
          error: err.message,
          errorCode: err.code
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: `Connection to ${downstream.name} timed out`, errorCode: 'ETIMEDOUT' });
      });

      req.end();
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

    this.httpsServer = https.createServer(options, async (req, res) => {
      if (req.url === '/api/sample') {
        if (this.downstream) {
          const downstreamResult = await this.forwardDownstream();
          if (!downstreamResult.success) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                service: this.name,
                pathSuccess: false,
                servingFingerprint: this.servingProfile.fingerprint,
                downstreamError: downstreamResult.error,
                downstreamErrorCode: downstreamResult.errorCode,
                downstreamTarget: this.downstream.name,
                timestamp: new Date().toISOString()
              })
            );
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              service: this.name,
              pathSuccess: true,
              servingFingerprint: this.servingProfile.fingerprint,
              downstream: downstreamResult.data,
              timestamp: new Date().toISOString()
            })
          );
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              service: this.name,
              pathSuccess: true,
              servingFingerprint: this.servingProfile.fingerprint,
              timestamp: new Date().toISOString()
            })
          );
        }
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            service: this.name,
            servingFingerprint: this.servingProfile.fingerprint,
            status: 'healthy',
            timestamp: new Date().toISOString()
          })
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.mgmtServer = http.createServer((req, res) => {
      const authHeader = req.headers['authorization'];
      const expectedAuth = `Bearer ${this.managementToken}`;

      if (authHeader !== expectedAuth) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'UNAUTHORIZED_MANAGEMENT',
            message: 'Valid management token required'
          })
        );
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) {
          req.destroy();
        }
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
            if (!data.profile?.certPem || !data.profile?.keyPem || !data.profile?.fingerprint) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid certificate profile payload' }));
              return;
            }
            this.installedProfile = data.profile;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'installed', fingerprint: this.installedProfile.fingerprint }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        } else if (req.method === 'POST' && req.url === '/mgmt/reload-context') {
          try {
            this.reloadContext();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'reloaded', servingFingerprint: this.servingProfile.fingerprint }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        } else if (req.method === 'POST' && req.url === '/mgmt/update-trust') {
          try {
            const data = JSON.parse(body);
            if (!data.trustedCaPem || typeof data.trustedCaPem !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'trustedCaPem string required' }));
              return;
            }
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
