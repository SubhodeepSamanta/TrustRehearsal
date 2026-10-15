import { LabCertStore, issueLeafCertificate, IssuedCertificate } from './ca.js';
import { SampleServiceInstance } from './sampleServices.js';

export interface ControllerOptions {
  baseDir?: string;
  controllerSecret?: string;
}

export class LabController {
  public certStore: LabCertStore;
  public services: Map<string, SampleServiceInstance> = new Map();
  public proxyFaultEnabled: boolean = false;
  public highestAcceptedFence: number = 0;
  private secret: string;

  constructor(options: ControllerOptions = {}) {
    this.certStore = new LabCertStore(options.baseDir);
    this.secret = options.controllerSecret || 'dev-lab-secret-never-expose-to-frontend';
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

    const gateway = new SampleServiceInstance({
      name: 'gateway',
      port: 8443,
      managementPort: 18443,
      activeProfile: gatewayA0,
      trustedCaPem: this.certStore.rootA.certPem
    });

    const orders = new SampleServiceInstance({
      name: 'orders',
      port: 8444,
      managementPort: 18444,
      activeProfile: ordersA0,
      trustedCaPem: this.certStore.rootA.certPem
    });

    const ledger = new SampleServiceInstance({
      name: 'ledger',
      port: 8445,
      managementPort: 18445,
      activeProfile: ledgerA0,
      trustedCaPem: this.certStore.rootA.certPem
    });

    this.services.set('gateway', gateway);
    this.services.set('orders', orders);
    this.services.set('ledger', ledger);

    await Promise.all([gateway.start(), orders.start(), ledger.start()]);
  }

  public validateFence(fence: number): boolean {
    if (fence < this.highestAcceptedFence) {
      return false;
    }
    this.highestAcceptedFence = fence;
    return true;
  }

  public issueNewProfile(
    serviceName: string,
    caName: 'A' | 'B',
    profileName: string
  ): IssuedCertificate {
    if (this.proxyFaultEnabled && caName === 'A') {
      throw new Error('ISSUANCE_PROXY_REJECTED: simulated network partition to CA');
    }

    const ca = caName === 'A' ? this.certStore.rootA : this.certStore.rootB;
    const sanList = [serviceName, 'localhost', '127.0.0.1'];
    const cert = issueLeafCertificate(ca, serviceName, sanList);
    this.certStore.saveProfile(serviceName, profileName, cert);
    return cert;
  }

  public installProfile(serviceName: string, profile: IssuedCertificate): void {
    const service = this.services.get(serviceName);
    if (!service) throw new Error(`Unknown service: ${serviceName}`);
    service.installedProfile = profile;
  }

  public reloadServiceContext(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (!service) throw new Error(`Unknown service: ${serviceName}`);
    service.reloadContext();
  }

  public setServiceTrust(serviceName: string, trustedCaPem: string): void {
    const service = this.services.get(serviceName);
    if (!service) throw new Error(`Unknown service: ${serviceName}`);
    service.updateTrust(trustedCaPem);
  }

  public setIssuanceProxyFault(enabled: boolean): void {
    this.proxyFaultEnabled = enabled;
  }

  public async resetToBaseline(): Promise<void> {
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
    for (const service of this.services.values()) {
      await service.stop();
    }
  }
}
