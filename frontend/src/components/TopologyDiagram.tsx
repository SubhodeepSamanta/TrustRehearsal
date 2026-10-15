import { useState } from 'react';
import { Server, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';

interface ServiceNodeData {
  id: string;
  name: string;
  role: string;
  port: number;
  configuredIssuer: string;
  installedProfile: string;
  servingFingerprint?: string | null;
  installedFingerprint?: string | null;
  status: string;
}

interface EdgeData {
  id: string;
  caller: string;
  callee: string;
  servername: string;
  expectedTrustProfile: string;
}

interface TopologyDiagramProps {
  services: ServiceNodeData[];
  edges: EdgeData[];
}

export default function TopologyDiagram({ services, edges }: TopologyDiagramProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('orders');
  const selectedNode = services.find((s) => s.id === selectedNodeId) || services[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Visual SVG / Hybrid Topology */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: '32px 24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          {services.map((service, index) => {
            const isSelected = selectedNodeId === service.id;
            return (
              <div key={service.id} style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 200 }}>
                <button
                  onClick={() => setSelectedNodeId(service.id)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--surface-muted)',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Server size={18} color={isSelected ? 'var(--accent)' : 'var(--ink-secondary)'} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                        {service.name}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      color: 'var(--ink-secondary)',
                      border: '1px solid var(--line)'
                    }}>
                      Port {service.port}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--ink-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>Issuer: <strong>{service.configuredIssuer}</strong></div>
                    <div>Installed Profile: <strong>{service.installedProfile}</strong></div>
                    {service.servingFingerprint && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                        Serving: {service.servingFingerprint.slice(0, 12)}...
                      </div>
                    )}
                  </div>
                </button>

                {index < services.length - 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <ArrowRight size={20} color="var(--ink-muted)" />
                    <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 600 }}>TLS</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Node Details Panel */}
      {selectedNode && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="var(--accent)" />
              {selectedNode.name} Cryptographic State
            </h3>
            <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <CheckCircle2 size={14} /> Service Verified
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16
          }}>
            <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Configured CA Issuer
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {selectedNode.configuredIssuer}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2 }}>
                Trust root authority recognized in the lab
              </div>
            </div>

            <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Installed Certificate (Disk)
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                Profile {selectedNode.installedProfile}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', marginTop: 2 }}>
                {selectedNode.installedFingerprint ? `${selectedNode.installedFingerprint.slice(0, 24)}...` : 'Matches active profile'}
              </div>
            </div>

            <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Observed Serving Certificate (Handshake)
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {selectedNode.servingFingerprint ? 'Active TLS Context' : 'Baseline Profile'}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', marginTop: 2 }}>
                {selectedNode.servingFingerprint || 'Observing live handshake'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Edge Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            Dependency Edges & Caller Trust Boundaries
          </h4>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--line)', color: 'var(--ink-secondary)' }}>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Edge ID</th>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Caller</th>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Callee</th>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Servername (SNI)</th>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Caller Trust Profile</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => (
              <tr key={edge.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{edge.id}</td>
                <td style={{ padding: '12px 20px', fontWeight: 500 }}>{edge.caller}</td>
                <td style={{ padding: '12px 20px', fontWeight: 500 }}>{edge.callee}</td>
                <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)' }}>{edge.servername}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {edge.expectedTrustProfile}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
