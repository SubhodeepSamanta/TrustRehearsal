import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'images')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_cover_visual():
    fig, ax = plt.subplots(figsize=(7.5, 2.8), dpi=300)
    ax.set_facecolor('#f8fafc')
    fig.patch.set_facecolor('#f8fafc')

    # Root CAs
    b_roota = patches.FancyBboxPatch((0.4, 1.55), 2.2, 0.95, boxstyle='round,pad=0.1', facecolor='#0f172a', edgecolor='#1e293b', linewidth=1.5)
    b_rootb = patches.FancyBboxPatch((4.9, 1.55), 2.2, 0.95, boxstyle='round,pad=0.1', facecolor='#0369a1', edgecolor='#0284c7', linewidth=1.5)
    ax.add_patch(b_roota)
    ax.add_patch(b_rootb)

    ax.text(1.5, 2.15, 'ROOT CA A (Baseline)', color='white', weight='bold', fontsize=8.5, ha='center', va='center')
    ax.text(1.5, 1.82, 'RSA-2048 · SHA-256\nExpires 2036-10-15', color='#cbd5e1', fontsize=6.8, ha='center', va='center')

    ax.text(6.0, 2.15, 'ROOT CA B (Target)', color='white', weight='bold', fontsize=8.5, ha='center', va='center')
    ax.text(6.0, 1.82, 'RSA-2048 · SHA-256\nDual-Trust Rollover Target', color='#e0f2fe', fontsize=6.8, ha='center', va='center')

    # Leaves
    b_leaf_a0 = patches.FancyBboxPatch((0.4, 0.25), 1.8, 0.85, boxstyle='round,pad=0.08', facecolor='#ffffff', edgecolor='#94a3b8', linewidth=1.2)
    b_leaf_a1 = patches.FancyBboxPatch((2.55, 0.25), 1.9, 0.85, boxstyle='round,pad=0.08', facecolor='#eff6ff', edgecolor='#2563eb', linewidth=1.2)
    b_leaf_b0 = patches.FancyBboxPatch((5.0, 0.25), 2.0, 0.85, boxstyle='round,pad=0.08', facecolor='#f0fdf4', edgecolor='#059669', linewidth=1.2)
    ax.add_patch(b_leaf_a0)
    ax.add_patch(b_leaf_a1)
    ax.add_patch(b_leaf_b0)

    ax.text(1.3, 0.75, 'Profile A0 (orders)', color='#0f172a', weight='bold', fontsize=8, ha='center', va='center')
    ax.text(1.3, 0.48, 'Serving Leaf Certificate\nSigned by Root A', color='#64748b', fontsize=6.5, ha='center', va='center')

    ax.text(3.5, 0.75, 'Profile A1 (orders)', color='#1e40af', weight='bold', fontsize=8, ha='center', va='center')
    ax.text(3.5, 0.48, 'Renewed on Disk (S01)\nPending Context Reload', color='#3b82f6', fontsize=6.5, ha='center', va='center')

    ax.text(6.0, 0.75, 'Profile B0 (orders/ledger)', color='#065f46', weight='bold', fontsize=8, ha='center', va='center')
    ax.text(6.0, 0.48, 'Migrated Leaf (S03)\nSigned by Root B', color='#059669', fontsize=6.5, ha='center', va='center')

    # Arrows
    ax.annotate('', xy=(1.3, 1.15), xytext=(1.3, 1.55), arrowprops=dict(arrowstyle='->', color='#64748b', lw=1.2))
    ax.annotate('', xy=(3.5, 1.15), xytext=(2.0, 1.55), arrowprops=dict(arrowstyle='->', color='#2563eb', lw=1.2, ls='--'))
    ax.annotate('', xy=(6.0, 1.15), xytext=(6.0, 1.55), arrowprops=dict(arrowstyle='->', color='#0284c7', lw=1.2))

    # Reload indicator between A0 and A1
    ax.annotate('Reload', xy=(2.5, 0.68), xytext=(2.25, 0.68),
                ha='center', va='center', fontsize=6.5, color='#dc2626', weight='bold',
                arrowprops=dict(arrowstyle='->', color='#dc2626', lw=1.2))

    ax.set_xlim(0, 7.5)
    ax.set_ylim(0, 2.7)
    ax.axis('off')
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, 'cover_trust_transition.png')
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f'Wrote {out_path}')

def generate_system_context():
    fig, ax = plt.subplots(figsize=(8.5, 4.4), dpi=300)
    ax.set_facecolor('#ffffff')
    fig.patch.set_facecolor('#ffffff')

    # Two deployment zones: Public Viewer vs Local Lab
    zone_pub = patches.FancyBboxPatch((0.3, 0.3), 3.6, 3.8, boxstyle='round,pad=0.15', facecolor='#f8fafc', edgecolor='#cbd5e1', linewidth=1.5, ls='--')
    zone_lab = patches.FancyBboxPatch((4.3, 0.3), 3.9, 3.8, boxstyle='round,pad=0.15', facecolor='#f0f9ff', edgecolor='#bae6fd', linewidth=1.5)
    ax.add_patch(zone_pub)
    ax.add_patch(zone_lab)

    ax.text(2.1, 3.9, 'PUBLIC VIEWER ARCHITECTURE (Static / Jamstack)', color='#334155', weight='bold', fontsize=8, ha='center')
    ax.text(6.25, 3.9, 'LOCAL OPERATOR LAB (Full Node.js + MongoDB)', color='#0369a1', weight='bold', fontsize=8, ha='center')

    # Public items
    b_vis = patches.FancyBboxPatch((0.6, 2.8), 3.0, 0.75, boxstyle='round,pad=0.08', facecolor='#ffffff', edgecolor='#94a3b8', linewidth=1.2)
    b_spa = patches.FancyBboxPatch((0.6, 1.6), 3.0, 0.85, boxstyle='round,pad=0.08', facecolor='#ffffff', edgecolor='#3b82f6', linewidth=1.2)
    b_data = patches.FancyBboxPatch((0.6, 0.5), 3.0, 0.75, boxstyle='round,pad=0.08', facecolor='#f1f5f9', edgecolor='#94a3b8', linewidth=1.2)
    ax.add_patch(b_vis)
    ax.add_patch(b_spa)
    ax.add_patch(b_data)

    ax.text(2.1, 3.25, 'Public Visitor / Evaluator', color='#0f172a', weight='bold', fontsize=7.5, ha='center')
    ax.text(2.1, 3.0, 'No credentials · Read-only exploration', color='#64748b', fontsize=6.2, ha='center')

    ax.text(2.1, 2.1, 'React 18 Single Page App (Vite)', color='#1d4ed8', weight='bold', fontsize=7.5, ha='center')
    ax.text(2.1, 1.8, 'Static Adapter · Zod Schema Validation', color='#475569', fontsize=6.2, ha='center')

    ax.text(2.1, 0.95, 'Immutable Snapshots (/data/snapshots.json)', color='#334155', weight='bold', fontsize=7.5, ha='center')
    ax.text(2.1, 0.7, '9 canonical runs · Zero secrets / private keys', color='#64748b', fontsize=6.2, ha='center')

    ax.annotate('', xy=(2.1, 2.5), xytext=(2.1, 2.8), arrowprops=dict(arrowstyle='->', color='#2563eb', lw=1.2))
    ax.annotate('', xy=(2.1, 1.3), xytext=(2.1, 1.6), arrowprops=dict(arrowstyle='->', color='#2563eb', lw=1.2))

    # Lab items
    b_op = patches.FancyBboxPatch((4.6, 2.9), 3.3, 0.65, boxstyle='round,pad=0.08', facecolor='#ffffff', edgecolor='#0284c7', linewidth=1.2)
    b_api = patches.FancyBboxPatch((4.6, 2.05), 3.3, 0.65, boxstyle='round,pad=0.08', facecolor='#ffffff', edgecolor='#0284c7', linewidth=1.2)
    b_eng = patches.FancyBboxPatch((4.6, 1.2), 3.3, 0.65, boxstyle='round,pad=0.08', facecolor='#ffffff', edgecolor='#0284c7', linewidth=1.2)
    b_ctrl = patches.FancyBboxPatch((4.6, 0.45), 3.3, 0.55, boxstyle='round,pad=0.08', facecolor='#e0f2fe', edgecolor='#38bdf8', linewidth=1.2)
    ax.add_patch(b_op)
    ax.add_patch(b_api)
    ax.add_patch(b_eng)
    ax.add_patch(b_ctrl)

    ax.text(6.25, 3.3, 'Authenticated Operator (Session + CSRF)', color='#0f172a', weight='bold', fontsize=7.2, ha='center')
    ax.text(6.25, 3.08, 'Password exchange -> HttpOnly cookie', color='#64748b', fontsize=6.0, ha='center')

    ax.text(6.25, 2.45, 'Express API Gateway (Port 4000)', color='#0369a1', weight='bold', fontsize=7.2, ha='center')
    ax.text(6.25, 2.22, 'Session validation · Fencing check · SSE stream', color='#475569', fontsize=6.0, ha='center')

    ax.text(6.25, 1.6, 'Worker Engine & TLS Probe', color='#0369a1', weight='bold', fontsize=7.2, ha='center')
    ax.text(6.25, 1.37, 'Lease acquisition · Phase driver · Fresh TLS handshakes', color='#475569', fontsize=6.0, ha='center')

    ax.text(6.25, 0.8, 'Lab Controller & PKI Manager (node-forge)', color='#0f172a', weight='bold', fontsize=7.2, ha='center')
    ax.text(6.25, 0.58, 'Loopback mgmt (18440-18445) · Root A / B · gateway/orders/ledger', color='#0284c7', fontsize=5.8, ha='center')

    ax.annotate('', xy=(6.25, 2.75), xytext=(6.25, 2.9), arrowprops=dict(arrowstyle='->', color='#0284c7', lw=1.2))
    ax.annotate('', xy=(6.25, 1.9), xytext=(6.25, 2.05), arrowprops=dict(arrowstyle='->', color='#0284c7', lw=1.2))
    ax.annotate('', xy=(6.25, 1.05), xytext=(6.25, 1.2), arrowprops=dict(arrowstyle='->', color='#0284c7', lw=1.2))

    ax.set_xlim(0, 8.5)
    ax.set_ylim(0, 4.3)
    ax.axis('off')
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, 'architecture_system_context.png')
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f'Wrote {out_path}')

def generate_topology_diagram():
    fig, ax = plt.subplots(figsize=(8.0, 3.2), dpi=300)
    ax.set_facecolor('#ffffff')
    fig.patch.set_facecolor('#ffffff')

    # Gateway, Orders, Ledger
    b_gw = patches.FancyBboxPatch((0.5, 0.8), 1.9, 1.6, boxstyle='round,pad=0.1', facecolor='#f8fafc', edgecolor='#3b82f6', linewidth=1.5)
    b_ord = patches.FancyBboxPatch((3.05, 0.8), 1.9, 1.6, boxstyle='round,pad=0.1', facecolor='#f8fafc', edgecolor='#0284c7', linewidth=1.5)
    b_led = patches.FancyBboxPatch((5.6, 0.8), 1.9, 1.6, boxstyle='round,pad=0.1', facecolor='#f8fafc', edgecolor='#059669', linewidth=1.5)
    ax.add_patch(b_gw)
    ax.add_patch(b_ord)
    ax.add_patch(b_led)

    # Gateway labels
    ax.text(1.45, 2.15, 'GATEWAY', color='#1e3a8a', weight='bold', fontsize=8.5, ha='center')
    ax.text(1.45, 1.9, 'Port 8443 (HTTPS)', color='#475569', fontsize=6.8, ha='center')
    ax.text(1.45, 1.6, 'Mgmt Port: 18443', color='#64748b', fontsize=6.2, ha='center')
    ax.text(1.45, 1.3, 'Trust: Root A (or A+B)', color='#2563eb', weight='bold', fontsize=6.5, ha='center')
    ax.text(1.45, 1.0, 'Leaf: gatewayA0', color='#0f172a', fontsize=6.2, ha='center')

    # Orders labels
    ax.text(4.0, 2.15, 'ORDERS', color='#0369a1', weight='bold', fontsize=8.5, ha='center')
    ax.text(4.0, 1.9, 'Port 8444 (HTTPS)', color='#475569', fontsize=6.8, ha='center')
    ax.text(4.0, 1.6, 'Mgmt Port: 18444', color='#64748b', fontsize=6.2, ha='center')
    ax.text(4.0, 1.3, 'Trust: Root A (or A+B)', color='#0284c7', weight='bold', fontsize=6.5, ha='center')
    ax.text(4.0, 1.0, 'Leaf: ordersA0 / A1 / B0', color='#0f172a', fontsize=6.2, ha='center')

    # Ledger labels
    ax.text(6.55, 2.15, 'LEDGER', color='#065f46', weight='bold', fontsize=8.5, ha='center')
    ax.text(6.55, 1.9, 'Port 8445 (HTTPS)', color='#475569', fontsize=6.8, ha='center')
    ax.text(6.55, 1.6, 'Mgmt Port: 18445', color='#64748b', fontsize=6.2, ha='center')
    ax.text(6.55, 1.3, 'Trust: Root A', color='#64748b', fontsize=6.5, ha='center')
    ax.text(6.55, 1.0, 'Leaf: ledgerA0 / B0', color='#047857', weight='bold', fontsize=6.2, ha='center')

    # Arrows between services
    ax.annotate('', xy=(3.0, 1.7), xytext=(2.45, 1.7),
                arrowprops=dict(arrowstyle='->', color='#2563eb', lw=1.8))
    ax.text(2.72, 1.9, 'HTTPS\nStrict TLS', fontsize=6, color='#1d4ed8', ha='center', weight='bold')

    ax.annotate('', xy=(5.55, 1.7), xytext=(5.0, 1.7),
                arrowprops=dict(arrowstyle='->', color='#0284c7', lw=1.8))
    ax.text(5.27, 1.9, 'HTTPS\nStrict TLS', fontsize=6, color='#0369a1', ha='center', weight='bold')

    # Client arrow to gateway
    ax.annotate('', xy=(0.45, 1.7), xytext=(0.0, 1.7),
                arrowprops=dict(arrowstyle='->', color='#64748b', lw=1.5))
    ax.text(0.2, 1.9, 'External / Test\nClient', fontsize=6, color='#475569', ha='center')

    # Application request trace
    ax.annotate('Real HTTP Trace: GET / -> orders/order-status -> ledger/ledger-entry',
                xy=(4.0, 0.45), xytext=(4.0, 0.45), fontsize=7, color='#334155', weight='bold', ha='center')

    ax.set_xlim(-0.1, 7.8)
    ax.set_ylim(0.2, 2.7)
    ax.axis('off')
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, 'topology_data_plane.png')
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f'Wrote {out_path}')

def generate_s03_sequence():
    fig, ax = plt.subplots(figsize=(8.5, 4.0), dpi=300)
    ax.set_facecolor('#ffffff')
    fig.patch.set_facecolor('#ffffff')

    steps = [
        ('1. Negative Control', 'Switch orders to B0 while gateway trusts Root A only.\nResult: TLS Handshake strictly rejected (Expected failure).', '#fee2e2', '#b91c1c'),
        ('2. Expand Caller Trust', 'Configure dual trust (Root A + Root B) on gateway & orders.\nResult: Baseline A0 traffic continues authenticated.', '#e0f2fe', '#0369a1'),
        ('3. Migrate Ledger (Callee)', 'Install & reload ledgerB0 while orders trusts Root A+B.\nResult: orders -> ledger TLS handshake verified over Root B.', '#eff6ff', '#1d4ed8'),
        ('4. Migrate Orders (Callee)', 'Install & reload ordersB0 while gateway trusts Root A+B.\nResult: gateway -> orders TLS handshake verified over Root B.', '#eff6ff', '#1d4ed8'),
        ('5. Prune Old Trust', 'Remove Root A from gateway & orders caller trust (B-only).\nResult: Callers accept Root B; reject any legacy Root A.', '#fef3c7', '#b45309'),
        ('6. Final E2E Application Probe', 'Execute real HTTPS request gateway -> orders -> ledger.\nResult: HTTP 200 Success; full chain verified over Root B.', '#f0fdf4', '#15803d')
    ]

    for i, (title, desc, bg, fg) in enumerate(steps):
        row = i // 2
        col = i % 2
        x = 0.4 + col * 3.9
        y = 2.6 - row * 1.25

        box = patches.FancyBboxPatch((x, y), 3.6, 1.05, boxstyle='round,pad=0.08', facecolor=bg, edgecolor=fg, linewidth=1.2)
        ax.add_patch(box)
        ax.text(x + 0.15, y + 0.78, title, color=fg, weight='bold', fontsize=7.5)
        ax.text(x + 0.15, y + 0.38, desc, color='#1e293b', fontsize=6.2)

    # Arrow from 1 to 2, 2 to 3, etc.
    ax.annotate('', xy=(3.8, 3.1), xytext=(4.1, 3.1), arrowprops=dict(arrowstyle='->', color='#64748b', lw=1.2))
    ax.annotate('', xy=(4.1, 1.9), xytext=(3.8, 1.9), arrowprops=dict(arrowstyle='<-', color='#64748b', lw=1.2))
    ax.annotate('', xy=(3.8, 0.65), xytext=(4.1, 0.65), arrowprops=dict(arrowstyle='->', color='#64748b', lw=1.2))

    ax.set_xlim(0, 8.2)
    ax.set_ylim(-0.2, 3.9)
    ax.axis('off')
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, 's03_migration_flow.png')
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f'Wrote {out_path}')

def generate_state_machine():
    fig, ax = plt.subplots(figsize=(8.5, 3.2), dpi=300)
    ax.set_facecolor('#ffffff')
    fig.patch.set_facecolor('#ffffff')

    states = [
        ('queued', 0.5, 1.6, '#f1f5f9', '#475569'),
        ('preparing', 2.0, 1.6, '#e0f2fe', '#0284c7'),
        ('running', 3.7, 1.6, '#dbeafe', '#2563eb'),
        ('recovering', 5.6, 1.6, '#fef3c7', '#d97706'),
        ('completed', 7.4, 2.2, '#dcfce7', '#15803d'),
        ('failed / interrupted / timed_out', 7.4, 1.0, '#fee2e2', '#b91c1c')
    ]

    for name, x, y, bg, fg in states:
        w = 1.4 if 'failed' not in name else 1.8
        h = 0.7 if 'failed' not in name else 0.8
        bx = patches.FancyBboxPatch((x - w/2, y - h/2), w, h, boxstyle='round,pad=0.08', facecolor=bg, edgecolor=fg, linewidth=1.2)
        ax.add_patch(bx)
        ax.text(x, y, name, color=fg, weight='bold', fontsize=7.2, ha='center', va='center')

    # Transitions
    ax.annotate('', xy=(1.3, 1.6), xytext=(1.05, 1.6), arrowprops=dict(arrowstyle='->', color='#64748b', lw=1.2))
    ax.annotate('', xy=(2.9, 1.6), xytext=(2.6, 1.6), arrowprops=dict(arrowstyle='->', color='#0284c7', lw=1.2))
    ax.annotate('', xy=(4.8, 1.6), xytext=(4.35, 1.6), arrowprops=dict(arrowstyle='->', color='#2563eb', lw=1.2))

    # From recovering to completed or failed
    ax.annotate('', xy=(6.55, 2.2), xytext=(6.2, 1.8), arrowprops=dict(arrowstyle='->', color='#15803d', lw=1.2))
    ax.annotate('', xy=(6.55, 1.0), xytext=(6.2, 1.4), arrowprops=dict(arrowstyle='->', color='#b91c1c', lw=1.2))

    # Direct error jump to recovering
    ax.annotate('Cancel / Deadline / Error', xy=(5.6, 2.05), xytext=(4.2, 2.4),
                fontsize=6.2, color='#b91c1c', weight='bold',
                arrowprops=dict(arrowstyle='->', color='#b91c1c', lw=1.0, connectionstyle='arc3,rad=-0.2'))

    ax.set_xlim(-0.4, 8.6)
    ax.set_ylim(0.3, 2.8)
    ax.axis('off')
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, 'state_machine_lifecycle.png')
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f'Wrote {out_path}')

def generate_tls_probe():
    fig, ax = plt.subplots(figsize=(8.0, 3.4), dpi=300)
    ax.set_facecolor('#ffffff')
    fig.patch.set_facecolor('#ffffff')

    # Lifelines
    ax.plot([1.2, 1.2], [0.3, 2.9], color='#94a3b8', lw=1.2, ls='--')
    ax.plot([6.8, 6.8], [0.3, 2.9], color='#94a3b8', lw=1.2, ls='--')

    b_w = patches.FancyBboxPatch((0.4, 2.9), 1.6, 0.45, boxstyle='round,pad=0.05', facecolor='#1e293b', edgecolor='#0f172a')
    b_s = patches.FancyBboxPatch((6.0, 2.9), 1.6, 0.45, boxstyle='round,pad=0.05', facecolor='#0284c7', edgecolor='#0369a1')
    ax.add_patch(b_w)
    ax.add_patch(b_s)
    ax.text(1.2, 3.12, 'Worker (TLS Probe)', color='white', weight='bold', fontsize=7.2, ha='center')
    ax.text(6.8, 3.12, 'HTTPS Target Service', color='white', weight='bold', fontsize=7.2, ha='center')

    messages = [
        (2.6, '1. TCP Handshake (Fresh socket, no pooling)', '->', '#64748b'),
        (2.2, '2. TLS ClientHello (Explicit SNI: servername, caPem)', '->', '#2563eb'),
        (1.8, '3. TLS ServerHello + X.509 Certificate Chain', '<-', '#0284c7'),
        (1.4, '4. Strict Chain & SAN Validation (rejectUnauthorized: true)', 'self', '#059669'),
        (1.0, '5. Extract Leaf SHA-256 Fingerprint, Serial, Timing', 'self', '#059669'),
        (0.6, '6. Explicit Socket Termination & Event Emission', '->', '#64748b')
    ]

    for y, text, direction, color in messages:
        if direction == '->':
            ax.annotate('', xy=(6.7, y), xytext=(1.3, y), arrowprops=dict(arrowstyle='->', color=color, lw=1.2))
            ax.text(4.0, y + 0.08, text, color=color, fontsize=6.5, ha='center', weight='bold')
        elif direction == '<-':
            ax.annotate('', xy=(1.3, y), xytext=(6.7, y), arrowprops=dict(arrowstyle='->', color=color, lw=1.2))
            ax.text(4.0, y + 0.08, text, color=color, fontsize=6.5, ha='center', weight='bold')
        elif direction == 'self':
            ax.annotate('', xy=(1.2, y - 0.15), xytext=(1.2, y + 0.15),
                        arrowprops=dict(arrowstyle='->', color=color, lw=1.2, connectionstyle='arc3,rad=-1.2'))
            ax.text(2.8, y, text, color=color, fontsize=6.2, weight='bold')

    ax.set_xlim(0, 8.0)
    ax.set_ylim(0.2, 3.5)
    ax.axis('off')
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, 'tls_probe_sequence.png')
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f'Wrote {out_path}')

if __name__ == '__main__':
    generate_cover_visual()
    generate_system_context()
    generate_topology_diagram()
    generate_s03_sequence()
    generate_state_machine()
    generate_tls_probe()
    print('All diagrams generated successfully!')
