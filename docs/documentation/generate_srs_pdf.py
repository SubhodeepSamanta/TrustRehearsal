import os
import sys
import pymupdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, PageBreak, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS_DIR = os.path.join(ROOT_DIR, 'docs')
IMG_DIR = os.path.join(os.path.dirname(__file__), 'images')
OUTPUT_PDF = os.path.join(ROOT_DIR, 'TrustRehearsal-SRS.pdf')

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 46
PRINTABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_header_footer(self, page_count):
        if self._pageNumber > 1:
            self.saveState()
            self.setFont('Helvetica-Bold', 7.5)
            self.setFillColor(colors.HexColor('#0f172a'))
            self.drawString(MARGIN, PAGE_HEIGHT - 32, 'TrustRehearsal')
            self.setFont('Helvetica', 7.5)
            self.setFillColor(colors.HexColor('#64748b'))
            self.drawString(MARGIN + 62, PAGE_HEIGHT - 32, '· Software Requirements Specification (SRS + HLD + LLD)')
            self.drawRightString(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 32, 'OCTOBER 2026 · V1.0')

            self.setStrokeColor(colors.HexColor('#cbd5e1'))
            self.setLineWidth(0.5)
            self.line(MARGIN, PAGE_HEIGHT - 38, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 38)

            self.line(MARGIN, 40, PAGE_WIDTH - MARGIN, 40)
            self.setFont('Helvetica', 7.5)
            self.setFillColor(colors.HexColor('#64748b'))
            self.drawString(MARGIN, 28, 'SUBHODEEP SAMANTA · FINAL ENGINEERING SPECIFICATION')
            self.drawRightString(PAGE_WIDTH - MARGIN, 28, f'Page {self._pageNumber} of {page_count}')
            self.restoreState()

class BookmarkPageRecorder(Paragraph):
    def __init__(self, text, style, bookmark_name, registry):
        super().__init__(text, style)
        self.bookmark_name = bookmark_name
        self.registry = registry

    def draw(self):
        super().draw()
        page_num = self.canv._pageNumber
        self.registry[self.bookmark_name] = page_num
        self.canv.bookmarkPage(self.bookmark_name)
        self.canv.addOutlineEntry(self.text.split('<')[0].strip(), self.bookmark_name, level=0, closed=False)

def get_doc_styles():
    base = getSampleStyleSheet()

    c_primary = colors.HexColor('#0f172a')
    c_secondary = colors.HexColor('#1e293b')
    c_body = colors.HexColor('#334155')
    c_accent = colors.HexColor('#2563eb')
    c_muted = colors.HexColor('#64748b')

    styles = {
        'CoverBadge': ParagraphStyle('CoverBadge', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#2563eb'), alignment=TA_CENTER, textTransform='uppercase', spaceAfter=8),
        'CoverTitle': ParagraphStyle('CoverTitle', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=26, leading=30, textColor=c_primary, alignment=TA_CENTER, spaceAfter=6),
        'CoverSubtitle': ParagraphStyle('CoverSubtitle', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=c_accent, alignment=TA_CENTER, spaceAfter=8),
        'CoverTagline': ParagraphStyle('CoverTagline', parent=base['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=c_muted, alignment=TA_CENTER, spaceAfter=14),
        'CoverMetaLabel': ParagraphStyle('CoverMetaLabel', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=10, textColor=c_primary),
        'CoverMetaValue': ParagraphStyle('CoverMetaValue', parent=base['Normal'], fontName='Helvetica', fontSize=7.5, leading=10, textColor=c_body),
        'CoverNote': ParagraphStyle('CoverNote', parent=base['Normal'], fontName='Helvetica-Oblique', fontSize=7, leading=9.5, textColor=c_muted, alignment=TA_CENTER),

        'SecHeading': ParagraphStyle('SecHeading', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=c_primary, spaceBefore=4, spaceAfter=6, keepWithNext=True),
        'SubHeading': ParagraphStyle('SubHeading', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=c_accent, spaceBefore=7, spaceAfter=3, keepWithNext=True),
        'SubSubHeading': ParagraphStyle('SubSubHeading', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=8.5, leading=11.5, textColor=c_secondary, spaceBefore=5, spaceAfter=2, keepWithNext=True),

        'Body': ParagraphStyle('Body', parent=base['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=c_body, spaceAfter=5),
        'BodyBold': ParagraphStyle('BodyBold', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=c_primary, spaceAfter=4),
        'Bullet': ParagraphStyle('Bullet', parent=base['Normal'], fontName='Helvetica', fontSize=7.8, leading=10.5, textColor=c_body, leftIndent=10, firstLineIndent=-7, spaceAfter=2.5),
        'CalloutText': ParagraphStyle('CalloutText', parent=base['Normal'], fontName='Helvetica', fontSize=7.6, leading=10.2, textColor=colors.HexColor('#1e3a8a')),

        'TOCItem': ParagraphStyle('TOCItem', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10.5, textColor=c_primary),
        'TOCPage': ParagraphStyle('TOCPage', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10.5, textColor=c_accent, alignment=TA_RIGHT),

        'TableHead': ParagraphStyle('TableHead', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=7.2, leading=9, textColor=colors.HexColor('#0f172a'), alignment=TA_LEFT),
        'TableCell': ParagraphStyle('TableCell', parent=base['Normal'], fontName='Helvetica', fontSize=7, leading=8.8, textColor=c_body),
        'TableCellBold': ParagraphStyle('TableCellBold', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=7, leading=8.8, textColor=c_primary),
        'TableCellCode': ParagraphStyle('TableCellCode', parent=base['Normal'], fontName='Courier', fontSize=6.5, leading=8.2, textColor=colors.HexColor('#0369a1')),

        'FigCaption': ParagraphStyle('FigCaption', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=7.2, leading=9, textColor=c_muted, alignment=TA_CENTER, spaceBefore=3, spaceAfter=8),
    }
    return styles

def create_table_box(data, col_widths, is_header=True):
    t = Table(data, colWidths=col_widths)
    ts = [
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]
    if is_header:
        ts.extend([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
        ])
    t.setStyle(TableStyle(ts))
    return t

def create_callout(text, styles, width=PRINTABLE_WIDTH):
    p = Paragraph(f"<b>Key Engineering Principle:</b> {text}", styles['CalloutText'])
    t = Table([[p]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#eff6ff')),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#93c5fd')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    return t

def build_pdf_story(styles, toc_registry=None):
    story = []
    reg = toc_registry if toc_registry is not None else {}

    cover_img_path = os.path.join(IMG_DIR, 'cover_trust_transition.png')
    s03_img_path = os.path.join(IMG_DIR, 's03_migration_flow.png')
    arch_img_path = os.path.join(IMG_DIR, 'architecture_system_context.png')
    topo_img_path = os.path.join(IMG_DIR, 'topology_data_plane.png')
    probe_img_path = os.path.join(IMG_DIR, 'tls_probe_sequence.png')
    sm_img_path = os.path.join(IMG_DIR, 'state_machine_lifecycle.png')
    ui_overview_path = os.path.join(IMG_DIR, 'app_overview.png')
    ui_timeline_path = os.path.join(IMG_DIR, 'app_run_detail.png')
    ui_env_path = os.path.join(IMG_DIR, 'app_environment.png')
    ui_report_path = os.path.join(IMG_DIR, 'app_export_report.png')

    comp_data = [
        [Paragraph('Component', styles['TableHead']), Paragraph('Location / Package', styles['TableHead']), Paragraph('Operational Responsibilities & Security Boundaries', styles['TableHead'])],
        [Paragraph('Public Web App', styles['TableCellBold']), Paragraph('<code>frontend/</code>', styles['TableCell']), Paragraph('React 18 SPA. Consumes static snapshot JSON or live API; renders timeline, SVG topology, comparison, and printable reports.', styles['TableCell'])],
        [Paragraph('API Gateway', styles['TableCellBold']), Paragraph('<code>backend/src/api/</code>', styles['TableCell']), Paragraph('Express HTTP server. Enforces deployment mode, operator session authentication, CSRF validation, and SSE streaming. Never executes host commands.', styles['TableCell'])],
        [Paragraph('Worker Engine', styles['TableCellBold']), Paragraph('<code>backend/src/worker/</code>', styles['TableCell']), Paragraph('Single autonomous execution driver. Acquires environment leases, enforces fencing tokens, drives scenario state machines, and evaluates assertions.', styles['TableCell'])],
        [Paragraph('Lab Controller', styles['TableCellBold']), Paragraph('<code>backend/src/lab/</code>', styles['TableCell']), Paragraph('Loopback administrative service (:18440-18445). Manages profile switching, context reloads, proxy fault injection, and baseline resets.', styles['TableCell'])],
        [Paragraph('PKI Manager', styles['TableCellBold']), Paragraph('<code>backend/src/lab/ca.ts</code>', styles['TableCell']), Paragraph('In-process X.509 authority using <code>node-forge</code>. Generates Root CA A, Root CA B, and dynamic leaf certificates with exact SANs.', styles['TableCell'])],
        [Paragraph('Sample Services', styles['TableCellBold']), Paragraph('<code>backend/src/lab/sampleServices.ts</code>', styles['TableCell']), Paragraph('Live Node.js HTTPS microservices (gateway :8443, orders :8444, ledger :8445) supporting atomic in-memory context reloads.', styles['TableCell'])],
        [Paragraph('MongoDB Store', styles['TableCellBold']), Paragraph('<code>backend/src/db/</code>', styles['TableCell']), Paragraph('Durable persistence for environments, runs, leases, sessions, and ordered run events. Never stores private keys.', styles['TableCell'])],
    ]

    src_data = [
        [Paragraph('File Path', styles['TableHead']), Paragraph('Module', styles['TableHead']), Paragraph('Implementation Detail & Key Functions', styles['TableHead'])],
        [Paragraph('<code>backend/src/contracts/index.ts</code>', styles['TableCellCode']), Paragraph('Contracts', styles['TableCell']), Paragraph('Defines Zod schemas: <code>RunSchema</code>, <code>RunEventSchema</code>, <code>ReportSchema</code>, <code>AssertionResultSchema</code>.', styles['TableCell'])],
        [Paragraph('<code>backend/src/db/models.ts</code>', styles['TableCellCode']), Paragraph('Database', styles['TableCell']), Paragraph('Mongoose schemas for Environment, Scenario, Run, RunEvent, Lease, Session, and Idempotency.', styles['TableCell'])],
        [Paragraph('<code>backend/src/lab/ca.ts</code>', styles['TableCellCode']), Paragraph('PKI Lab', styles['TableCell']), Paragraph('Generates RSA-2048 keys, self-signs Root CAs A and B, signs leaf certificates with exact SANs.', styles['TableCell'])],
        [Paragraph('<code>backend/src/lab/controller.ts</code>', styles['TableCellCode']), Paragraph('Lab Controller', styles['TableCell']), Paragraph('Manages profile switching, context reloads, proxy fault injection, and baseline resets.', styles['TableCell'])],
        [Paragraph('<code>backend/src/lab/sampleServices.ts</code>', styles['TableCellCode']), Paragraph('Sample Lab', styles['TableCell']), Paragraph('Hosts gateway, orders, ledger HTTPS servers; handles <code>server.setSecureContext()</code> reloads.', styles['TableCell'])],
        [Paragraph('<code>backend/src/lab/probe.ts</code>', styles['TableCellCode']), Paragraph('TLS Probe', styles['TableCell']), Paragraph('Executes fresh TCP/TLS sockets with explicit SNI and caPem; computes peer SHA-256 fingerprint.', styles['TableCell'])],
        [Paragraph('<code>backend/src/worker/engine.ts</code>', styles['TableCellCode']), Paragraph('Worker Engine', styles['TableCell']), Paragraph('State machine driver; lease heartbeats; S01, S02, S03 execution pipelines; assertion evaluation.', styles['TableCell'])],
        [Paragraph('<code>backend/src/api/routes.ts</code>', styles['TableCellCode']), Paragraph('API Gateway', styles['TableCell']), Paragraph('Express routes; session management; CSRF checks; run creation with idempotency; SSE stream.', styles['TableCell'])],
        [Paragraph('<code>frontend/src/api/client.ts</code>', styles['TableCellCode']), Paragraph('Frontend API', styles['TableCell']), Paragraph('Dual-mode client; parses static snapshot queries; rejects mutations in viewer mode.', styles['TableCell'])],
    ]

    stride_data = [
        [Paragraph('STRIDE Category', styles['TableHead']), Paragraph('Threat Vector & Potential Impact', styles['TableHead']), Paragraph('Architectural Defense & Mitigation Control', styles['TableHead'])],
        [Paragraph('<b>Spoofing</b>', styles['TableCellBold']), Paragraph('Attacker impersonates local operator to trigger destructive lab mutations.', styles['TableCell']), Paragraph('Opaque session tokens in <code>HttpOnly</code>, <code>SameSite=Strict</code> cookies; constant-time password comparison; double-submit CSRF validation.', styles['TableCell'])],
        [Paragraph('<b>Tampering</b>', styles['TableCellBold']), Paragraph('Attacker injects arbitrary target hosts or executes malicious shell commands.', styles['TableCell']), Paragraph('Zero arbitrary target parameters; probe targets strictly allowlisted in code constants; zero shell execution or process spawns.', styles['TableCell'])],
        [Paragraph('<b>Repudiation</b>', styles['TableCellBold']), Paragraph('Operator denies initiating scenario mutations or altering baseline profiles.', styles['TableCell']), Paragraph('Immutable append-only MongoDB event stream; monotonic sequence numbers; monotonic fencing tokens logged with every action.', styles['TableCell'])],
        [Paragraph('<b>Information Disclosure</b>', styles['TableCellBold']), Paragraph('Exposure of CA private keys, session tokens, or internal passwords in reports.', styles['TableCell']), Paragraph('Private keys generated in-memory; strictly excluded from database, API responses, and exported snapshots. Automated regex scrubber in export pipeline.', styles['TableCell'])],
        [Paragraph('<b>Denial of Service</b>', styles['TableCellBold']), Paragraph('Flooding run queues or starving environment locks with zombie executions.', styles['TableCell']), Paragraph('Monotonic fencing token validation; unique partial MongoDB index enforcing single active run; hard 180s scenario execution budget.', styles['TableCell'])],
        [Paragraph('<b>Elevation of Privilege</b>', styles['TableCellBold']), Paragraph('Public viewer user attempts to trigger live scenario execution.', styles['TableCell']), Paragraph('Complete physical and logical route decoupling: snapshot adapter returns HTTP 403 <code>LIVE_DISABLED</code>; public viewer package contains no worker.', styles['TableCell'])],
    ]

    rtm_data = [
        [Paragraph('Req ID', styles['TableHead']), Paragraph('Functional Requirement Summary', styles['TableHead']), Paragraph('Verifying Test Suite / Source File', styles['TableHead']), Paragraph('Observed Test Evidence & Outcome', styles['TableHead'])],
        [Paragraph('FR-001', styles['TableCellBold']), Paragraph('Mode & Provenance Display', styles['TableCell']), Paragraph('<code>security-and-viewer.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Provenance persistent; mode badge rendered.', styles['TableCell'])],
        [Paragraph('FR-002', styles['TableCellBold']), Paragraph('Fresh TLS Handshake Probing', styles['TableCell']), Paragraph('<code>tls-proof.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Captured peer SHA-256 fingerprint; 0 pooling.', styles['TableCell'])],
        [Paragraph('FR-003', styles['TableCellBold']), Paragraph('S01 Renewal Without Reload', styles['TableCell']), Paragraph('<code>runs-and-api.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Detected mismatch; context reloaded.', styles['TableCell'])],
        [Paragraph('FR-004', styles['TableCellBold']), Paragraph('Durable Event Persistence', styles['TableCell']), Paragraph('<code>recheck-16.cjs (R18)</code>', styles['TableCellCode']), Paragraph('Passed. Write failure halts execution; returns null ID.', styles['TableCell'])],
        [Paragraph('FR-005', styles['TableCellBold']), Paragraph('Traceable Assertion References', styles['TableCell']), Paragraph('<code>contracts.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. 100% assertions map to valid event IDs.', styles['TableCell'])],
        [Paragraph('FR-006', styles['TableCellBold']), Paragraph('Monotonic Fencing & Locks', styles['TableCell']), Paragraph('<code>runs-and-api.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Duplicate run rejected with HTTP 409 Conflict.', styles['TableCell'])],
        [Paragraph('FR-007', styles['TableCellBold']), Paragraph('Safe Baseline Reset', styles['TableCell']), Paragraph('<code>reset-lab.ts</code>', styles['TableCellCode']), Paragraph('Passed. Baseline restored and verified with live probe.', styles['TableCell'])],
        [Paragraph('FR-008', styles['TableCellBold']), Paragraph('S02 Issuance Proxy Fault', styles['TableCell']), Paragraph('<code>scenarios-s02-s03.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. 3 HTTP 502s observed; data plane uninhibited.', styles['TableCell'])],
        [Paragraph('FR-009', styles['TableCellBold']), Paragraph('S03 Staged Root Rollover', styles['TableCell']), Paragraph('<code>scenarios-s02-s03.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Neg. control rejected; HTTP 200 on Root B.', styles['TableCell'])],
        [Paragraph('FR-010', styles['TableCellBold']), Paragraph('Graceful Run Cancellation', styles['TableCell']), Paragraph('<code>runs-and-api.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Ceased mutations; clean recovery within budget.', styles['TableCell'])],
        [Paragraph('FR-011', styles['TableCellBold']), Paragraph('Structured Evidence Filtering', styles['TableCell']), Paragraph('<code>recheck-16.cjs (P1B)</code>', styles['TableCellCode']), Paragraph('Passed. Query params (limit, afterSeq) sliced correctly.', styles['TableCell'])],
        [Paragraph('FR-012', styles['TableCellBold']), Paragraph('Canonical Report Export', styles['TableCell']), Paragraph('<code>contracts.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. Validates ReportSchema; printable view clean.', styles['TableCell'])],
        [Paragraph('FR-013', styles['TableCellBold']), Paragraph('Run-to-Run Comparison', styles['TableCell']), Paragraph('<code>ComparePage.tsx</code>', styles['TableCellCode']), Paragraph('Passed. Mismatched scenario IDs rejected; diffs shown.', styles['TableCell'])],
        [Paragraph('FR-014', styles['TableCellBold']), Paragraph('Authenticated Operator Actions', styles['TableCell']), Paragraph('<code>security-and-viewer.test.ts</code>', styles['TableCellCode']), Paragraph('Passed. HTTP 401 on missing auth; 403 on invalid CSRF.', styles['TableCell'])],
        [Paragraph('FR-015', styles['TableCellBold']), Paragraph('Public Credential-Free Mode', styles['TableCell']), Paragraph('<code>test-public-viewer.ts</code>', styles['TableCellCode']), Paragraph('Passed. 9/9 checks passed; zero backend requests.', styles['TableCell'])],
        [Paragraph('FR-016', styles['TableCellBold']), Paragraph('Honest Measurement Integrity', styles['TableCell']), Paragraph('<code>recheck-16.cjs (P1C)</code>', styles['TableCellCode']), Paragraph('Passed. Empty snapshots render 0 samples; 503 is UNAVAIL.', styles['TableCell'])],
    ]

    gates_data = [
        [Paragraph('Verification Gate', styles['TableHead']), Paragraph('Required Release Standard', styles['TableHead']), Paragraph('Verification Result', styles['TableHead'])],
        [Paragraph('Dependency Lockfile', styles['TableCellBold']), Paragraph('Pinned dependencies; zero runtime installation research.', styles['TableCell']), Paragraph('Passed. Pinned in <code>package-lock.json</code>.', styles['TableCell'])],
        [Paragraph('TLS Proof Before UI', styles['TableCellBold']), Paragraph('Real socket handshakes before dashboard implementation.', styles['TableCell']), Paragraph('Passed. Verified in <code>tls-proof.test.ts</code>.', styles['TableCell'])],
        [Paragraph('Scenario Reproducibility', styles['TableCellBold']), Paragraph('All 3 scenarios reproduce across clean repetitions.', styles['TableCell']), Paragraph('Passed. 3 clean runs per scenario (9 total).', styles['TableCell'])],
        [Paragraph('Persistence Integrity', styles['TableCellBold']), Paragraph('Event write failures halt execution without false pass.', styles['TableCell']), Paragraph('Passed. Verified in regression test R18.', styles['TableCell'])],
        [Paragraph('Security Boundaries', styles['TableCellBold']), Paragraph('Anonymous mutations denied; zero private keys in exports.', styles['TableCell']), Paragraph('Passed. Verified in security test suite.', styles['TableCell'])],
        [Paragraph('Truthful Measurements', styles['TableCellBold']), Paragraph('Empty snapshots report 0 samples; 503 is UNAVAILABLE.', styles['TableCell']), Paragraph('Passed. Verified in independent review harness.', styles['TableCell'])],
    ]

    # ====================================================
    # PAGE 1: COVER
    # ====================================================
    story.append(Spacer(1, 10))
    story.append(Paragraph("Software Requirements Specification · Architecture & Design Baseline", styles['CoverBadge']))
    story.append(Paragraph("TrustRehearsal", styles['CoverTitle']))
    story.append(Paragraph("Cryptographic Change Rehearsal Platform", styles['CoverSubtitle']))
    story.append(Paragraph("Rehearse cryptographic change. See what breaks before production.", styles['CoverTagline']))
    story.append(Spacer(1, 4))

    cover_img_path = os.path.join(IMG_DIR, 'cover_trust_transition.png')
    if os.path.exists(cover_img_path):
        story.append(Image(cover_img_path, width=440, height=165))
        story.append(Spacer(1, 12))

    meta_data = [
        [Paragraph("Author / Architect", styles['CoverMetaLabel']), Paragraph("Subhodeep Samanta", styles['CoverMetaValue']),
         Paragraph("Target Release", styles['CoverMetaLabel']), Paragraph("Version 1.0 (Production Verified)", styles['CoverMetaValue'])],
        [Paragraph("Publication Date", styles['CoverMetaLabel']), Paragraph("October 16, 2026", styles['CoverMetaValue']),
         Paragraph("Document Status", styles['CoverMetaLabel']), Paragraph("Final Consolidated Specification", styles['CoverMetaValue'])],
        [Paragraph("Primary Workspaces", styles['CoverMetaLabel']), Paragraph("<code>frontend/</code> (React 18), <code>backend/</code> (Node 22/24)", styles['CoverMetaValue']),
         Paragraph("Operating Modes", styles['CoverMetaLabel']), Paragraph("<code>PUBLIC_VIEWER</code> & <code>LOCAL_OPERATOR</code>", styles['CoverMetaValue'])],
        [Paragraph("Security Classification", styles['CoverMetaLabel']), Paragraph("Technical Reference · Credential-Free Public Demo", styles['CoverMetaValue']),
         Paragraph("Verification Status", styles['CoverMetaLabel']), Paragraph("27/27 Vitest Tests · 117 Review Assertions", styles['CoverMetaValue'])],
    ]
    meta_table = Table(meta_data, colWidths=[95, 155, 95, 155])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph("This specification reconciles all architectural planning with the independently verified implementation in repository <code>TrustRehearsal</code>. It exercises server-authenticated TLS handshakes, strict hostname verification, and real certificate reloads across sample microservices. It does not claim mutual TLS, compliance certification, or external company endorsement.", styles['CoverNote']))
    story.append(PageBreak())

    # ====================================================
    # PAGE 2: DOCUMENT CONTROL & TABLE OF CONTENTS
    # ====================================================
    story.append(BookmarkPageRecorder("1. Document Control & Table of Contents", styles['SecHeading'], 'sec_doc_control', reg))
    story.append(Paragraph("This document establishes the authoritative Software Requirements Specification (SRS), High-Level Design (HLD), and Low-Level Design (LLD) for TrustRehearsal. It consolidates initial product briefs, design system rules, data schemas, executable scenario definitions, and post-review verification repairs into a unified engineering artifact.", styles['Body']))

    story.append(Paragraph("1.1 Document Revision History", styles['SubHeading']))
    rev_data = [
        [Paragraph("Version", styles['TableHead']), Paragraph("Date", styles['TableHead']), Paragraph("Author", styles['TableHead']), Paragraph("Summary of Engineering & Verification Scope", styles['TableHead'])],
        [Paragraph("0.1", styles['TableCellBold']), Paragraph("2026-10-15", styles['TableCell']), Paragraph("Subhodeep Samanta", styles['TableCell']), Paragraph("Initial requirements specification, product brief, and scenario definitions.", styles['TableCell'])],
        [Paragraph("0.5", styles['TableCellBold']), Paragraph("2026-10-15", styles['TableCell']), Paragraph("Subhodeep Samanta", styles['TableCell']), Paragraph("Architecture baseline, Zod schema contracts, and lab controller design.", styles['TableCell'])],
        [Paragraph("0.9", styles['TableCellBold']), Paragraph("2026-10-15", styles['TableCell']), Paragraph("Subhodeep Samanta", styles['TableCell']), Paragraph("Verification gates, security boundaries, and static snapshot export adapter.", styles['TableCell'])],
        [Paragraph("1.0", styles['TableCellBold']), Paragraph("2026-10-16", styles['TableCell']), Paragraph("Subhodeep Samanta", styles['TableCell']), Paragraph("Final consolidated SRS/HLD/LLD. Incorporated 16 Oct review repairs: S03 dependency order migration, authenticated CA proxy, honest empty reports, and 27-test Vitest suite.", styles['TableCell'])],
    ]
    story.append(create_table_box(rev_data, [45, 60, 95, 300]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("1.2 Requirement Priority & Implementation Status Taxonomy", styles['SubHeading']))
    tax_data = [
        [Paragraph("Classification", styles['TableHead']), Paragraph("Taxonomy Label", styles['TableHead']), Paragraph("Operational Definition & Acceptance Standard", styles['TableHead'])],
        [Paragraph("Priority", styles['TableCellBold']), Paragraph("P0 (Mandatory)", styles['TableCellBold']), Paragraph("Core requirement for initial demonstrable slice, real TLS handshakes, and cryptographic isolation.", styles['TableCell'])],
        [Paragraph("Priority", styles['TableCellBold']), Paragraph("P1 (Release Target)", styles['TableCellBold']), Paragraph("Core V1 capability: all three scenarios, reporting, comparison, and operator controls.", styles['TableCell'])],
        [Paragraph("Priority", styles['TableCellBold']), Paragraph("P2 (Roadmap)", styles['TableCellBold']), Paragraph("Architectural extension deferred to post-V1 distributed releases (e.g. multi-tenant lab).", styles['TableCell'])],
        [Paragraph("Status", styles['TableCellBold']), Paragraph("Implemented & Verified", styles['TableCellBold']), Paragraph("Code complete, fully functional, and verified by automated tests and independent review harness.", styles['TableCell'])],
        [Paragraph("Status", styles['TableCellBold']), Paragraph("Implemented", styles['TableCellBold']), Paragraph("Implemented in source code and operational; verified during standard development.", styles['TableCell'])],
        [Paragraph("Status", styles['TableCellBold']), Paragraph("Deferred / Planned", styles['TableCellBold']), Paragraph("Formally defined in architecture; scheduled for future multi-process milestones.", styles['TableCell'])],
    ]
    story.append(create_table_box(tax_data, [65, 100, 335]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("1.3 Table of Contents", styles['SubHeading']))
    toc_items = [
        ("1. Document Control & Table of Contents", 'sec_doc_control'),
        ("2. Product Definition & Operational Context", 'sec_product_def'),
        ("3. User Journeys & Concrete Use Cases", 'sec_user_journeys'),
        ("4. Functional Requirements (FR-001 - FR-016)", 'sec_functional_reqs'),
        ("5. Nonfunctional Requirements (NFR-SEC, REL, USA)", 'sec_nfr'),
        ("6. Scenario Specifications (S01, S02, S03)", 'sec_scenarios'),
        ("7. High-Level Design (HLD) & System Architecture", 'sec_hld'),
        ("8. Low-Level Design (LLD) & Data Contracts", 'sec_lld'),
        ("9. Security Architecture & Threat Model", 'sec_security'),
        ("10. User Interface & Evidence Presentation", 'sec_ui'),
        ("11. Verification, Traceability & Test Results", 'sec_verification'),
        ("12. Technical Risks, Limitations & Future Roadmap", 'sec_risks_future'),
        ("13. Glossary of Terms & Authoritative References", 'sec_glossary'),
    ]
    toc_data = []
    for title, b_name in toc_items:
        p_num = reg.get(b_name, '-')
        link_text = f'<a href="#{b_name}">{title}</a>'
        toc_data.append([Paragraph(link_text, styles['TOCItem']), Paragraph(f'<a href="#{b_name}">{p_num}</a>', styles['TOCPage'])])
    t_toc = Table(toc_data, colWidths=[440, 60])
    t_toc.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    # ====================================================
    # PAGE 3: PRODUCT DEFINITION
    # ====================================================
    story.append(BookmarkPageRecorder("2. Product Definition & Operational Context", styles['SecHeading'], 'sec_product_def', reg))
    story.append(Paragraph("2.1 The Core Problem: The Three Structural PKI Disconnects", styles['SubHeading']))
    story.append(Paragraph("In enterprise infrastructure, automated Certificate Lifecycle Management (CLM) systems typically declare victory the moment a certificate authority (CA) successfully issues a cryptographic leaf certificate. However, operational post-mortems reveal that major production outages overwhelmingly occur <i>after</i> successful issuance due to three critical disconnects:", styles['Body']))

    story.append(Paragraph("- <b>The Serving Context Disconnect:</b> Writing a new certificate PEM file to disk does not update the active in-memory TLS context (<code>tls.SecureContext</code>) of long-running daemon processes (e.g. Node.js, Nginx, Envoy). The process continues serving the previous certificate until it expires, causing sudden, catastrophic client failures.", styles['Bullet']))
    story.append(Paragraph("- <b>The Control-Plane vs. Data-Plane Disconnect:</b> Transient network partitions or HTTP 502 Bad Gateway errors on CA issuance proxies cause automation scripts to fail. Untested automation often fails closed or alerts unnecessarily, failing to recognize that existing issued certificates remain completely valid throughout their scheduled lifetime.", styles['Bullet']))
    story.append(Paragraph("- <b>The Caller-Callee Trust Ordering Disconnect:</b> Trust-root migrations (e.g. migrating from Root A to Root B) fail when deep callee microservices switch their serving certificates before upstream callers have expanded their local trust bundles. Downstream dependencies break even when intermediate health probes report success.", styles['Bullet']))

    story.append(Spacer(1, 4))
    story.append(create_callout("A certificate can renew successfully while your application continues serving the old one. TrustRehearsal makes these disconnects observable and verifiable at the network socket layer before changes hit production.", styles))
    story.append(Spacer(1, 6))

    story.append(Paragraph("2.2 Product Objectives & Core Capabilities", styles['SubHeading']))
    story.append(Paragraph("TrustRehearsal provides an observable, reproducible software platform designed to rehearse these exact failure modes against a live microservice topology:", styles['Body']))
    story.append(Paragraph("- <b>Connection-Level Ground Truth:</b> Measures fresh, non-resumed TLS handshakes, SNI negotiation, peer certificate SHA-256 fingerprints, and multi-hop HTTP application transactions.", styles['Bullet']))
    story.append(Paragraph("- <b>Dual Operating Modes:</b> Operates as a completely credential-free, zero-backend public viewer for stakeholders and evaluators, and as an authenticated local execution lab for site reliability engineers.", styles['Bullet']))
    story.append(Paragraph("- <b>Honest Evidence Model:</b> Strictly separates assertion outcomes (e.g. an expected TLS failure in a negative test) from service health, and never invents metrics, samples, or zero-downtime claims.", styles['Bullet']))

    story.append(Paragraph("2.3 Scope Boundaries & Non-Goals", styles['SubHeading']))
    story.append(Paragraph("To ensure technical rigor, the V1 implementation enforces strict scope boundaries:", styles['Body']))
    scope_data = [
        [Paragraph("Dimension", styles['TableHead']), Paragraph("In-Scope (Implemented in V1)", styles['TableHead']), Paragraph("Explicit Non-Goals & Out-of-Scope", styles['TableHead'])],
        [Paragraph("Microservices", styles['TableCellBold']), Paragraph("3 sample HTTPS services: gateway (8443) -> orders (8444) -> ledger (8445).", styles['TableCell']), Paragraph("Arbitrary user-provided URLs, external network scanning, or unseeded hosts.", styles['TableCell'])],
        [Paragraph("PKI Hierarchy", styles['TableCellBold']), Paragraph("Two distinct Root CAs (Root A baseline, Root B target) with RSA-2048 and SHA-256.", styles['TableCell']), Paragraph("Mutual TLS (mTLS) client auth, HSM integrations, or live CRL/OCSP responders.", styles['TableCell'])],
        [Paragraph("Scenarios", styles['TableCellBold']), Paragraph("S01 (Renewal without reload), S02 (Proxy fault), S03 (Staged Root rollover).", styles['TableCell']), Paragraph("PQC Dilithium migration, automated code remediation, or live customer patching.", styles['TableCell'])],
        [Paragraph("Execution", styles['TableCellBold']), Paragraph("Monotonic fencing leases, durable MongoDB persistence, 5s heartbeats.", styles['TableCell']), Paragraph("Multi-tenant cloud orchestration, billing, or distributed Kubernetes operators.", styles['TableCell'])],
    ]
    story.append(create_table_box(scope_data, [75, 215, 210]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 4: USER JOURNEYS & USE CASES
    # ====================================================
    story.append(BookmarkPageRecorder("3. User Journeys & Concrete Use Cases", styles['SecHeading'], 'sec_user_journeys', reg))
    story.append(Paragraph("TrustRehearsal supports two distinct operational personas with completely separated security boundaries:", styles['Body']))

    story.append(Paragraph("3.1 Use Case UC-01: Credential-Free Public Exploration", styles['SubHeading']))
    story.append(Paragraph("<b>Actor:</b> Public Visitor (Evaluator, Auditor, Prospective Collaborator, Engineering Reviewer).<br/>"
                           "<b>Preconditions:</b> Public static distribution hosted on any static HTTP file host (or local Vite preview); zero backend processes, MongoDB instances, or execution credentials required.<br/>"
                           "<b>Normal Execution Flow:</b>", styles['Body']))
    story.append(Paragraph("1. <b>Landing:</b> Visitor navigates to the web application root (<code>/</code>). The application detects <code>VITE_APP_MODE=PUBLIC_VIEWER</code> and loads pre-validated immutable snapshots from <code>/data/snapshots.json</code>.", styles['Bullet']))
    story.append(Paragraph("2. <b>Overview Inspection:</b> The Overview displays the hero trust path, environment health, 3 scenario cards, and 9 canonical recorded executions (3 repetitions each for S01, S02, S03).", styles['Bullet']))
    story.append(Paragraph("3. <b>Scenario Exploration:</b> Visitor selects scenario S03 (Trust-Root Rollover) and inspects the latest recorded run detail (<code>/runs/:id</code>).", styles['Bullet']))
    story.append(Paragraph("4. <b>Evidence Drill-Down:</b> Visitor explores the chronological timeline of 54 discrete events across 6 phases, inspecting peer leaf SHA-256 fingerprints, timing latencies, and strict TLS handshake results.", styles['Bullet']))
    story.append(Paragraph("5. <b>Assertion Verification:</b> Visitor inspects the Assertions panel, confirming that the negative control rejection passed independently from the final application HTTP probe.", styles['Bullet']))
    story.append(Paragraph("6. <b>Run Comparison:</b> Visitor navigates to Compare (<code>/compare</code>), selecting two compatible S03 runs to inspect assertion consistency and phase timing.", styles['Bullet']))
    story.append(Paragraph("7. <b>Report Download:</b> Visitor opens Report (<code>/runs/:id/report</code>), reviews the methodology and measurement scope, and downloads the canonical JSON report artifact.", styles['Bullet']))
    story.append(Paragraph("<b>Alternative Flow (Offline / Network Partition):</b> If <code>snapshots.json</code> cannot be fetched, the interface surfaces an explicit message stating recorded data is unavailable; it never falls back silently to live API requests or fabricated metrics.", styles['Body']))

    story.append(Spacer(1, 4))
    story.append(Paragraph("3.2 Use Case UC-02: Authenticated Local Operator Rehearsal", styles['SubHeading']))
    story.append(Paragraph("<b>Actor:</b> Local Operator (Site Reliability Engineer, PKI Administrator).<br/>"
                           "<b>Preconditions:</b> Local MongoDB active on port 27017, Express backend active on port 4000, sample services active on ports 8443–8445, operator authenticated via local password.<br/>"
                           "<b>Normal Execution Flow:</b>", styles['Body']))
    story.append(Paragraph("1. <b>Session Bootstrap:</b> Operator opens the web UI, enters local credentials, and exchanges them for an <code>HttpOnly</code> secure session cookie and a CSRF token.", styles['Bullet']))
    story.append(Paragraph("2. <b>Environment Audit:</b> Operator navigates to Environment, confirming status is <code>ready</code> and baseline probes against <code>sample-lab</code> succeed.", styles['Bullet']))
    story.append(Paragraph("3. <b>Trigger Execution:</b> Operator selects S01 (Renewal without reload) and clicks 'Start Rehearsal' (<code>POST /api/v1/runs</code> with <code>Idempotency-Key</code>).", styles['Bullet']))
    story.append(Paragraph("4. <b>Lease Acquisition:</b> Worker engine acquires the environment lease, assigns an incremented fencing token, and transitions the run to <code>running</code>.", styles['Bullet']))
    story.append(Paragraph("5. <b>Live Telemetry:</b> UI subscribes to real-time events via Server-Sent Events (<code>GET /api/v1/runs/:id/stream</code>), rendering live phase transitions and TLS handshakes.", styles['Bullet']))
    story.append(Paragraph("6. <b>Fault & Reload:</b> Engine detects leaf mismatch (disk <code>A1</code> vs. served <code>A0</code>), dispatches context reload to <code>orders</code> (:18444), and verifies served <code>A1</code>.", styles['Bullet']))
    story.append(Paragraph("7. <b>Recovery & Teardown:</b> Engine restores baseline profile <code>A0</code>, verifies healthy handshakes, releases the lease, and marks the run <code>completed</code>.", styles['Bullet']))

    story.append(Spacer(1, 4))
    story.append(Paragraph("3.3 Use Case UC-03: Disaster Recovery & Automated Baseline Reset", styles['SubHeading']))
    story.append(Paragraph("<b>Actor:</b> Local Operator or Automated Startup Reconciler.<br/>"
                           "<b>Preconditions:</b> Environment in <code>needs_reset</code> state following a worker crash, persistence failure, or interrupted scenario.<br/>"
                           "<b>Workflow:</b> Dispatch authenticated reset (<code>POST /api/v1/environments/:id/reset</code>). Controller verifies that no unexpired lease is held, clears proxy faults, restores baseline profiles (<code>A0</code>), reloads caller trust to Root A, and executes a real HTTP verification probe (<code>gateway -> orders -> ledger</code>). Transitions environment to <code>ready</code> only upon probe success.", styles['Body']))
    story.append(PageBreak())

    # ====================================================
    # PAGE 5: FUNCTIONAL REQUIREMENTS PART 1 (FR-001 - FR-008)
    # ====================================================
    story.append(BookmarkPageRecorder("4. Functional Requirements (FR-001 - FR-016)", styles['SecHeading'], 'sec_functional_reqs', reg))
    story.append(Paragraph("This section defines the 16 core functional requirements governing TrustRehearsal. Every requirement contains explicit 'shall' statements, acceptance verification criteria, and verified implementation status.", styles['Body']))

    fr_data_p1 = [
        [Paragraph("ID / Priority", styles['TableHead']), Paragraph("Requirement Specification ('Shall' Statement)", styles['TableHead']), Paragraph("Acceptance Verification Standard", styles['TableHead']), Paragraph("Status", styles['TableHead'])],
        [
            Paragraph("<b>FR-001</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>Operating Mode & Provenance Display:</b> The system shall explicitly render the active deployment mode (<code>PUBLIC_VIEWER</code> or <code>LOCAL_OPERATOR</code>) and prominently label all recorded artifacts with immutable provenance tags (<code>recorded_example</code> or <code>live_lab</code>).", styles['TableCell']),
            Paragraph("Navigation bar renders prominent mode badge; recorded runs carry persistent provenance chip; viewer never pretends live execution.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-002</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>Fresh TLS Handshake Probing:</b> The system shall execute fresh, non-resumed TLS handshakes with explicit SNI to capture peer certificate SHA-256 fingerprints, issuer fingerprints, validity windows, and protocol versions.", styles['TableCell']),
            Paragraph("Socket never pools connections; captures exact 64-character hex leaf SHA-256 fingerprint; records exact millisecond handshake latency.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-003</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>S01 Renewal Without Reload Execution:</b> The system shall issue a renewed leaf certificate <code>A1</code>, install it to disk without process restart, detect the serving mismatch against <code>A0</code>, execute an in-memory context reload, and confirm serving <code>A1</code>.", styles['TableCell']),
            Paragraph("Assertions A01-A06 evaluate real event references; mismatch detected independently from live probes; baseline restored cleanly.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-004</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>Durable Event Persistence:</b> The system shall persist every execution event to durable storage prior to SSE broadcast or assertion evaluation. Any persistence failure shall halt execution.", styles['TableCell']),
            Paragraph("Injected MongoDB write failure causes worker to abort scenario progression, return null ID, and enter bounded cleanup.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-005</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>Traceable Assertion Evaluation:</b> Every assertion result shall explicitly reference specific, persisted event IDs, expected values, actual observed values, and detailed explanatory rationales.", styles['TableCell']),
            Paragraph("Reports link assertions to event IDs within the same run; zero dangling, invented, or cross-run event citations.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-006</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>Concurrency Control & Monotonic Fencing:</b> The system shall enforce single-runner mutual exclusion per environment using monotonic integer fencing tokens. Stale workers shall be denied mutation authority.", styles['TableCell']),
            Paragraph("Concurrent run dispatch returns HTTP 409 Conflict; controller rejects operations bearing stale fencing tokens.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-007</b><br/>P0", styles['TableCellBold']),
            Paragraph("<b>Safe Baseline Recovery & Reset:</b> The system shall execute an independent, bounded recovery workflow upon scenario completion, cancellation, or failure, restoring baseline profiles and verifying probes.", styles['TableCell']),
            Paragraph("Recovery restores <code>A0</code> profiles and Root A trust; verifies baseline application probe before setting environment <code>ready</code>.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-008</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>S02 Issuance Proxy Fault Simulation:</b> The system shall route renewal attempts through a controlled loopback proxy, simulate network 502 partitions, verify that existing TLS handshakes continue unimpeded, and complete renewal after path restoration.", styles['TableCell']),
            Paragraph("Exactly 3 failed HTTP renewal attempts observed over proxy; normal service probes stay valid; restored renewal succeeds.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
    ]
    story.append(create_table_box(fr_data_p1, [55, 195, 175, 75]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 6: FUNCTIONAL REQUIREMENTS PART 2 (FR-009 - FR-016)
    # ====================================================
    story.append(Paragraph("4. Functional Requirements (Continued: FR-009 - FR-016)", styles['SecHeading']))
    fr_data_p2 = [
        [Paragraph("ID / Priority", styles['TableHead']), Paragraph("Requirement Specification ('Shall' Statement)", styles['TableHead']), Paragraph("Acceptance Verification Standard", styles['TableHead']), Paragraph("Status", styles['TableHead'])],
        [
            Paragraph("<b>FR-009</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>S03 Staged Root Migration Sequence:</b> The system shall execute a strict staged rollover: (1) negative control, (2) expand caller trust to Root A+B, (3) migrate <code>ledger</code> to B0, (4) migrate <code>orders</code> to B0, (5) prune Root A trust, and (6) verify end-to-end HTTP 200 over Root B.", styles['TableCell']),
            Paragraph("Negative control strictly fails handshake; callee migration strictly precedes trust pruning; final <code>gateway -> orders -> ledger</code> request succeeds.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-010</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Graceful Run Cancellation:</b> The system shall acknowledge operator cancellation requests, cease new experimental phases, execute clean recovery within a reserved budget, and mark the run <code>cancelled</code>.", styles['TableCell']),
            Paragraph("In-flight work terminates within 3 seconds; recovery restores baseline; final lifecycle recorded as <code>cancelled</code>.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-011</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Evidence Filtering & Structured Inspection:</b> The system shall provide structured event filtering by phase, event type, and target service, displaying redacted payloads without exposing private keys.", styles['TableCell']),
            Paragraph("Query parameter parsing (<code>limit</code>, <code>afterSeq</code>) handles sliced pagination; full structured JSON inspection available for every event.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-012</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Canonical JSON & Printable Report Export:</b> The system shall export canonical reports conforming to the shared Zod schema and render clean, printable A4 layouts.", styles['TableCell']),
            Paragraph("Exported JSON validates <code>ReportSchema</code> with zero schema violations; printable view formats cleanly without clipping.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-013</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Run-to-Run Comparison:</b> The system shall support side-by-side comparison of compatible runs sharing the same scenario and environment revision, highlighting assertion diffs and timing variance.", styles['TableCell']),
            Paragraph("Incompatible runs (mismatched scenario ID) rejected; assertion outcomes and duration metrics diffed side-by-side.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-014</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Authenticated Operator Security Boundary:</b> All mutating API endpoints shall enforce secure session authentication, origin verification, and double-submit CSRF token validation.", styles['TableCell']),
            Paragraph("Anonymous requests to <code>/api/v1/runs</code> or <code>/operator/session</code> return HTTP 401; invalid CSRF tokens return HTTP 403.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-015</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Credential-Free Public Static Mode:</b> The public viewer shall operate directly from pre-rendered static assets and snapshot JSON without requiring backend processes, databases, or credentials.", styles['TableCell']),
            Paragraph("Zero API calls dispatched in <code>PUBLIC_VIEWER</code> mode; navigation, timeline, and reports function entirely offline.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
        [
            Paragraph("<b>FR-016</b><br/>P1", styles['TableCellBold']),
            Paragraph("<b>Honest Error Semantics & Empty State Integrity:</b> The system shall accurately represent missing or inconclusive evidence, reporting 0 samples and <code>not_run</code> recovery rather than falling back to fabricated data.", styles['TableCell']),
            Paragraph("Snapshot with zero events renders 0 samples and empty observation windows; backend HTTP 503 surfaces <code>UNAVAILABLE</code>.", styles['TableCell']),
            Paragraph("Implemented & Verified", styles['TableCellBold'])
        ],
    ]
    story.append(create_table_box(fr_data_p2, [55, 195, 175, 75]))
    story.append(Spacer(1, 10))
    story.append(create_callout("All 16 functional requirements are implemented, covered by automated integration test suites, and validated through the 16 October 2026 independent verification review.", styles))
    story.append(PageBreak())

    # ====================================================
    # PAGE 7: NONFUNCTIONAL REQUIREMENTS
    # ====================================================
    story.append(BookmarkPageRecorder("5. Nonfunctional Requirements (NFR-SEC, REL, USA)", styles['SecHeading'], 'sec_nfr', reg))
    story.append(Paragraph("Nonfunctional requirements define operational boundaries, performance budgets, cryptographic safeguards, and accessibility baselines. Measurable engineering targets are explicitly separated from observed verification results:", styles['Body']))

    story.append(Paragraph("5.1 Security, Isolation & Key Safeguards", styles['SubHeading']))
    story.append(Paragraph("• <b>NFR-SEC-01 (Administrative Loopback Isolation):</b> The execution lab binds all management listeners (:18440-18445) and Express API strictly to <code>127.0.0.1</code>. The public distribution exposes zero management routes.", styles['Bullet']))
    story.append(Paragraph("• <b>NFR-SEC-02 (Key Material Scrubbing):</b> Private keys reside exclusively in memory or temporary lab storage. Automated regex sanitization strips all PEM blocks from database models, API responses, and exported snapshots.", styles['Bullet']))
    story.append(Paragraph("• <b>NFR-SEC-03 (Strict Certificate Chain Verification):</b> Under no circumstances is <code>NODE_TLS_REJECT_UNAUTHORIZED=0</code> permitted. Every probe and microservice enforces strict hostname and chain validation.", styles['Bullet']))

    story.append(Paragraph("5.2 Reliability, Recovery Budgets & Monotonic Fencing", styles['SubHeading']))
    story.append(Paragraph("• <b>NFR-REL-01 (Bounded Timeouts):</b> Probe sockets enforce a 3,000 ms timeout; controller operations enforce a 5,000 ms timeout; scenario executions enforce a 180-second hard deadline, reserving at least 30 seconds for baseline recovery.", styles['Bullet']))
    story.append(Paragraph("• <b>NFR-REL-02 (Lease Expiry & Heartbeats):</b> Execution leases expire after 20 seconds with active 5-second heartbeats. Monotonically incrementing integer fencing tokens reject stale workers.", styles['Bullet']))
    story.append(Paragraph("• <b>NFR-REL-03 (Baseline Recovery Determinism):</b> Any unhandled error, persistence failure, or cancelled run automatically invokes recovery. If baseline probes fail, the environment transitions to <code>needs_reset</code>.", styles['Bullet']))

    story.append(Paragraph("5.3 Usability, Accessibility & Portability Targets vs. Observed Results", styles['SubHeading']))
    nfr_table_data = [
        [Paragraph("Category", styles['TableHead']), Paragraph("ID / Attribute", styles['TableHead']), Paragraph("Target Requirement Specification", styles['TableHead']), Paragraph("Independently Observed Verification", styles['TableHead'])],
        [
            Paragraph("Security", styles['TableCellBold']), Paragraph("<b>NFR-SEC-01</b><br/>Isolation", styles['TableCell']),
            Paragraph("No Docker socket mounting; loopback binding for management plane (18440-18445); anonymous mutations rejected.", styles['TableCell']),
            Paragraph("Verified. Loopback bindings enforced; anonymous POST returns HTTP 401 Unauthorized.", styles['TableCell'])
        ],
        [
            Paragraph("Security", styles['TableCellBold']), Paragraph("<b>NFR-SEC-02</b><br/>Key Scrubbing", styles['TableCell']),
            Paragraph("Zero private key PEM blocks or secrets in MongoDB, API responses, or exported snapshot files.", styles['TableCell']),
            Paragraph("Verified. Regex security scan of snapshots confirms zero private key markers or secrets.", styles['TableCell'])
        ],
        [
            Paragraph("Security", styles['TableCellBold']), Paragraph("<b>NFR-SEC-03</b><br/>Strict TLS", styles['TableCell']),
            Paragraph("Zero TLS verification bypass. <code>NODE_TLS_REJECT_UNAUTHORIZED=0</code> prohibited across all code.", styles['TableCell']),
            Paragraph("Verified. Negative control strictly rejects untrusted leaf; no global bypass exists.", styles['TableCell'])
        ],
        [
            Paragraph("Reliability", styles['TableCellBold']), Paragraph("<b>NFR-REL-01</b><br/>Timing Bounds", styles['TableCell']),
            Paragraph("Probe socket timeout 3,000ms; controller timeout 5,000ms; scenario deadline 180s with 30s reserved recovery.", styles['TableCell']),
            Paragraph("Verified. Individual TLS handshakes complete in 8-25ms; total scenario runs 6-12s.", styles['TableCell'])
        ],
        [
            Paragraph("Reliability", styles['TableCellBold']), Paragraph("<b>NFR-REL-02</b><br/>Lease Safety", styles['TableCell']),
            Paragraph("Worker lease 20s with 5s heartbeat; monotonic fencing token increments on every acquisition.", styles['TableCell']),
            Paragraph("Verified. Expired leases rejected; duplicate run dispatch returns 409 Conflict.", styles['TableCell'])
        ],
        [
            Paragraph("Usability", styles['TableCellBold']), Paragraph("<b>NFR-USA-01</b><br/>Responsiveness", styles['TableCell']),
            Paragraph("Clean layout across 1440x900 desktop, 1280x800 laptop, 768px tablet, and 390px mobile viewport.", styles['TableCell']),
            Paragraph("Verified. Mobile audit at 390px viewport confirmed zero horizontal page overflow.", styles['TableCell'])
        ],
        [
            Paragraph("Accessibility", styles['TableCellBold']), Paragraph("<b>NFR-ACC-01</b><br/>WCAG 2.1 AA", styles['TableCell']),
            Paragraph("Semantic HTML, full keyboard navigation, visible focus rings, and WCAG AA contrast.", styles['TableCell']),
            Paragraph("Verified. Clean focus outlines, accessible dialog modals, and high-contrast chips.", styles['TableCell'])
        ],
    ]
    story.append(create_table_box(nfr_table_data, [60, 75, 185, 180]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 8: SCENARIO SPECIFICATIONS (S01 & S02)
    # ====================================================
    story.append(BookmarkPageRecorder("6. Scenario Specifications (S01, S02, S03)", styles['SecHeading'], 'sec_scenarios', reg))
    story.append(Paragraph("TrustRehearsal implements three canonical, reproducible scenario pipelines. Each scenario adheres to a strict formal contract: baseline verification, controlled fault injection, independent observation, assertion evaluation, and guaranteed baseline recovery.", styles['Body']))

    story.append(Paragraph("6.1 S01: Renewal Without Application Reload (Version 1)", styles['SubHeading']))
    story.append(Paragraph("<b>Purpose:</b> Prove that disk-level certificate replacement does not update the active in-memory TLS serving context.<br/>"
                           "<b>Baseline Topology:</b> <code>orders</code> serves leaf <code>ordersA0</code> (Root A). Callers trust Root A. Initial probes confirm active authentication.", styles['Body']))
    story.append(Paragraph("- <b>Phase 1 (Setup):</b> Probe baseline. Record initial served fingerprint <code>ordersA0</code>.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 2 (Issuance):</b> Issue renewed certificate <code>ordersA1</code> with identical SANs (<code>orders</code>, <code>localhost</code>, <code>127.0.0.1</code>) and new cryptographic keypair.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 3 (Install to Disk):</b> Write <code>ordersA1</code> to disk storage without reloading the process TLS context.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 4 (Observation):</b> Probe <code>orders</code> over 5 fresh connections. Assert served fingerprint remains <code>ordersA0</code> while disk profile is <code>ordersA1</code>. Flag mismatch.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 5 (Context Reload):</b> Dispatch reload request to loopback endpoint (:18444). Server executes <code>server.setSecureContext()</code> without restarting the process.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 6 (Verification):</b> Probe 5 fresh connections. Confirm served fingerprint is now <code>ordersA1</code>.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 7 (Recovery):</b> Restore baseline profile <code>ordersA0</code>, reload context, and verify baseline health.", styles['Bullet']))

    story.append(Spacer(1, 4))
    story.append(Paragraph("6.2 S02: Issuance-Path Unavailability (Version 1)", styles['SubHeading']))
    story.append(Paragraph("<b>Purpose:</b> Demonstrate that failure of the certificate issuance infrastructure does not degrade active data-plane TLS communication for currently valid certificates.<br/>"
                           "<b>Baseline Topology:</b> All services serve baseline profiles (<code>A0</code>) valid for >30 days. Proxy permits renewal requests.", styles['Body']))
    story.append(Paragraph("- <b>Phase 1 (Fault Injection):</b> Enable simulated network partition on issuance proxy (:18440), causing it to return HTTP 502 Bad Gateway for renewal requests.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 2 (Renewal Attempts):</b> Worker attempts renewal 3 times at 2-second intervals. All 3 requests traverse the proxy and fail with HTTP 502.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 3 (Data Plane Observation):</b> Concurrently execute 5 fresh TLS probes against <code>gateway</code> and <code>orders</code>. Verify 100% successful handshakes and valid data-plane traffic.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 4 (Fault Cleared & Renewal):</b> Restore proxy to relay mode. Successfully issue <code>ordersA1</code> through restored path, install, reload, and verify.", styles['Bullet']))
    story.append(Paragraph("- <b>Phase 5 (Recovery):</b> Restore baseline profile <code>ordersA0</code>, reload context, and verify baseline health.", styles['Bullet']))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Summary of S01 & S02 Formal Assertions", styles['SubHeading']))
    s01_s02_assertions = [
        [Paragraph("Scenario", styles['TableHead']), Paragraph("Assertion ID & Label", styles['TableHead']), Paragraph("Evaluation Target & Expected Outcome", styles['TableHead']), Paragraph("Verified Status", styles['TableHead'])],
        [Paragraph("S01", styles['TableCellBold']), Paragraph("<code>A01_certificate_issued</code>", styles['TableCellCode']), Paragraph("Issued fingerprint != baseline fingerprint.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("S01", styles['TableCellBold']), Paragraph("<code>A03_mismatch_detected</code>", styles['TableCellCode']), Paragraph("Served fingerprint (A0) differs from disk profile (A1).", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("S01", styles['TableCellBold']), Paragraph("<code>A05_served_renewed</code>", styles['TableCellCode']), Paragraph("Served fingerprint matches A1 after context reload.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("S02", styles['TableCellBold']), Paragraph("<code>A01_proxy_fault_active</code>", styles['TableCellCode']), Paragraph("Issuance attempts correctly fail with HTTP 502.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("S02", styles['TableCellBold']), Paragraph("<code>A02_data_plane_unaffected</code>", styles['TableCellCode']), Paragraph("Data-plane TLS handshakes remain 100% valid.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("S02", styles['TableCellBold']), Paragraph("<code>A03_restored_issuance</code>", styles['TableCellCode']), Paragraph("Renewal completes successfully upon proxy restoration.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
    ]
    story.append(create_table_box(s01_s02_assertions, [50, 140, 240, 70]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 9: SCENARIO SPECIFICATIONS (S03: STAGED ROOT ROLLOVER)
    # ====================================================
    story.append(Paragraph("6. Scenario Specifications (Continued: S03 Staged Rollover)", styles['SecHeading']))
    story.append(Paragraph("6.3 S03: Staged Root A-to-B Rollover (Version 1)", styles['SubHeading']))
    story.append(Paragraph("<b>Purpose:</b> Demonstrate the precise caller trust and callee identity migration order required to execute a zero-outage CA rollover.<br/>"
                           "<b>Downstream Dependency Ordering Invariant:</b> Upstream callers must expand trust before callees migrate, and all in-scope callees must migrate before callers prune old trust. A real end-to-end application request must succeed <i>after</i> trust pruning.", styles['Body']))

    if os.path.exists(s03_img_path):
        story.append(Image(s03_img_path, width=470, height=205))
        story.append(Paragraph("Figure 1: S03 Staged Root Migration Flow: Negative Control -> Expand Trust -> Migrate Ledger -> Migrate Orders -> Prune Root A -> Verify End-to-End Application Request.", styles['FigCaption']))

    story.append(Paragraph("<b>S03 Step-by-Step Execution Sequence:</b>", styles['BodyBold']))
    story.append(Paragraph("1. <b>Step 1 (Negative Control):</b> Temporarily switch <code>orders</code> to <code>ordersB0</code> (signed by Root B) while <code>gateway</code> trusts Root A only. Handshake strictly fails with <code>UNABLE_TO_VERIFY_LEAF_SIGNATURE</code>. This expected failure validates that security controls are actively enforced. Baseline restored.", styles['Bullet']))
    story.append(Paragraph("2. <b>Step 2 (Expand Caller Trust):</b> Configure dual trust (Root A + Root B) on <code>gateway</code> and <code>orders</code>. Baseline Root A traffic continues authenticated without disruption.", styles['Bullet']))
    story.append(Paragraph("3. <b>Step 3 (Migrate Deepest Callee):</b> Migrate <code>ledger</code> to <code>ledgerB0</code>. Probe <code>orders -> ledger</code> succeeds via Root B while upstream continues on Root A.", styles['Bullet']))
    story.append(Paragraph("4. <b>Step 4 (Migrate Intermediate Callee):</b> Migrate <code>orders</code> to <code>ordersB0</code>. Probe <code>gateway -> orders</code> succeeds via Root B.", styles['Bullet']))
    story.append(Paragraph("5. <b>Step 5 (Prune Legacy Trust):</b> Remove Root A from <code>gateway</code> and <code>orders</code> trust stores, leaving only Root B active.", styles['Bullet']))
    story.append(Paragraph("6. <b>Step 6 (End-to-End Application Probe):</b> Execute a real multi-hop HTTPS request: <code>gateway (8443) -> orders (8444) -> ledger (8445)</code>. Must return HTTP 200 OK over Root B.", styles['Bullet']))
    story.append(Spacer(1, 4))

    s03_assertions = [
        [Paragraph("Assertion ID", styles['TableHead']), Paragraph("Formal Acceptance Target", styles['TableHead']), Paragraph("Cryptographic Evidence Observed", styles['TableHead']), Paragraph("Status", styles['TableHead'])],
        [Paragraph("<code>A01_negative_control_rejected</code>", styles['TableCellCode']), Paragraph("Root B leaf rejected by Root A caller.", styles['TableCell']), Paragraph("Observed TLS error: UNABLE_TO_VERIFY_LEAF_SIGNATURE.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("<code>A02_dual_trust_established</code>", styles['TableCellCode']), Paragraph("Dual trust accepts Root A baseline traffic.", styles['TableCell']), Paragraph("5/5 successful handshakes against ordersA0.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("<code>A03_callees_migrated</code>", styles['TableCellCode']), Paragraph("Callees migrated in dependency order.", styles['TableCell']), Paragraph("ledgerB0 verified, then ordersB0 verified.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
        [Paragraph("<code>A04_trust_pruned_and_e2e_verified</code>", styles['TableCellCode']), Paragraph("Root A pruned; E2E request succeeds.", styles['TableCell']), Paragraph("Final application request: HTTP 200 over Root B.", styles['TableCell']), Paragraph("Passed", styles['TableCellBold'])],
    ]
    story.append(create_table_box(s03_assertions, [145, 145, 150, 60]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 10: HIGH-LEVEL DESIGN (HLD) & SYSTEM CONTEXT
    # ====================================================
    story.append(BookmarkPageRecorder("7. High-Level Design (HLD) & System Architecture", styles['SecHeading'], 'sec_hld', reg))
    story.append(Paragraph("TrustRehearsal decouples execution from observation through two distinct operational architectures sharing a single, runtime-validated contract schema.", styles['Body']))

    if os.path.exists(arch_img_path):
        story.append(Image(arch_img_path, width=475, height=230))
        story.append(Paragraph("Figure 2: System Context Diagram: Public Viewer (Static Jamstack) vs. Local Operator Lab (Express, Worker, PKI Controller, HTTPS Services).", styles['FigCaption']))

    story.append(Paragraph("7.1 Component Responsibilities & Separation of Concerns", styles['SubHeading']))
    story.append(create_table_box(comp_data, [95, 120, 285]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 11: HLD (CONTINUED: TOPOLOGY & TRADEOFFS)
    # ====================================================
    story.append(Paragraph("7. High-Level Design (HLD) (Continued)", styles['SecHeading']))
    story.append(Paragraph("7.2 Microservice Topology & Data Plane Architecture", styles['SubHeading']))
    story.append(Paragraph("The microservice data plane models a typical multi-tier enterprise transaction: an external request hits the edge <code>gateway</code>, which calls internal service <code>orders</code>, which in turn queries <code>ledger</code>. Every outbound connection performs strict server-certificate and hostname validation against its designated local trust bundle.", styles['Body']))

    if os.path.exists(topo_img_path):
        story.append(Image(topo_img_path, width=470, height=180))
        story.append(Paragraph("Figure 3: Data Plane Topology: gateway (:8443) -> orders (:8444) -> ledger (:8445) with configured SANs and caller trust stores.", styles['FigCaption']))

    story.append(Paragraph("7.3 Architectural Decisions & Tradeoff Analysis", styles['SubHeading']))
    story.append(Paragraph("During Phase 0 and Phase 1, several key architectural decisions were evaluated and locked:", styles['Body']))
    story.append(Paragraph("- <b>In-Process Node-Forge PKI vs. Dockerized Step-CA:</b> While early planning documents proposed external Step-CA containers, the implementation adopted an in-process, pure JavaScript PKI manager (<code>node-forge</code>). This eliminates host Docker socket mounting, prevents privileged container vulnerabilities, and ensures 100% deterministic, cross-platform execution on Windows, macOS, and Linux without external daemon dependencies.", styles['Bullet']))
    story.append(Paragraph("- <b>Server-Sent Events (SSE) vs. WebSockets:</b> Telemetry during scenario execution is strictly unidirectional (server-to-client). SSE was chosen over WebSockets because it operates seamlessly over standard HTTP proxies, provides native reconnection semantics via <code>Last-Event-ID</code>, and eliminates bidirectional socket state complexity.", styles['Bullet']))
    story.append(Paragraph("- <b>Static Snapshot Adapter vs. Live Backend Proxy:</b> For the public viewer, pre-exporting sanitized, validated JSON snapshots eliminates the need to run an active backend in public hosting environments. This completely closes the attack surface against the execution engine.", styles['Bullet']))
    story.append(PageBreak())

    # ====================================================
    # PAGE 12: LOW-LEVEL DESIGN (LLD) (SOURCE FILES & PROBE)
    # ====================================================
    story.append(BookmarkPageRecorder("8. Low-Level Design (LLD) & Data Contracts", styles['SecHeading'], 'sec_lld', reg))
    story.append(Paragraph("Low-Level Design details the exact file structures, state machines, TLS socket probes, database schemas, and REST API contracts implemented across the codebase.", styles['Body']))

    story.append(Paragraph("8.1 Source Code Layout & Responsibilities", styles['SubHeading']))
    story.append(create_table_box(src_data, [155, 75, 270]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("8.2 Fresh TLS Probe Sequence & Handshake Architecture", styles['SubHeading']))
    story.append(Paragraph("The probe mechanism implemented in <code>backend/src/lab/probe.ts</code> guarantees that every observation reflects an authentic, unpooled cryptographic handshake:", styles['Body']))

    if os.path.exists(probe_img_path):
        story.append(Image(probe_img_path, width=470, height=190))
        story.append(Paragraph("Figure 4: Fresh-Connection TLS Probe Sequence: Raw TCP Handshake -> TLS ClientHello (SNI) -> ServerHello + Chain -> Strict Validation -> Fingerprint Extraction -> Socket Destruction.", styles['FigCaption']))

    story.append(PageBreak())

    # ====================================================
    # PAGE 13: LLD (CONTINUED: STATE MACHINE & API TABLE)
    # ====================================================
    story.append(Paragraph("8. Low-Level Design (LLD) (Continued)", styles['SecHeading']))
    story.append(Paragraph("8.3 Execution Engine Lifecycle State Machine", styles['SubHeading']))
    story.append(Paragraph("Scenario execution transitions through a strictly bounded state machine. Cancellation, deadline expiration, or unexpected errors immediately route execution into the <code>recovering</code> phase to restore baseline configurations before reaching a terminal state:", styles['Body']))

    if os.path.exists(sm_img_path):
        story.append(Image(sm_img_path, width=470, height=165))
        story.append(Paragraph("Figure 5: Run Lifecycle State Machine: queued -> preparing -> running -> recovering -> completed / failed / cancelled / interrupted / timed_out.", styles['FigCaption']))

    story.append(Paragraph("8.4 Complete REST API Route Specification", styles['SubHeading']))
    api_data = [
        [Paragraph("HTTP Route", styles['TableHead']), Paragraph("Supported Mode", styles['TableHead']), Paragraph("Request Body / Params", styles['TableHead']), Paragraph("Response & Status Codes", styles['TableHead'])],
        [Paragraph("<code>GET /meta</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("None", styles['TableCell']), Paragraph("200: <code>{ mode, capabilities, version }</code>", styles['TableCell'])],
        [Paragraph("<code>GET /health</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("None", styles['TableCell']), Paragraph("200: Process liveness indicator.", styles['TableCell'])],
        [Paragraph("<code>GET /ready</code>", styles['TableCellCode']), Paragraph("Local Only", styles['TableCell']), Paragraph("None", styles['TableCell']), Paragraph("200: Dependency readiness (DB, Lab).", styles['TableCell'])],
        [Paragraph("<code>GET /environments</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("None", styles['TableCell']), Paragraph("200: Environment summary array.", styles['TableCell'])],
        [Paragraph("<code>GET /environments/:id</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("<code>:id</code>", styles['TableCell']), Paragraph("200: Topology, nodes, edges, state.", styles['TableCell'])],
        [Paragraph("<code>GET /scenarios</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("None", styles['TableCell']), Paragraph("200: Scenario definitions array.", styles['TableCell'])],
        [Paragraph("<code>GET /scenarios/:id</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("<code>:id</code>", styles['TableCell']), Paragraph("200: Full scenario plan and phases.", styles['TableCell'])],
        [Paragraph("<code>GET /runs</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("<code>?cursor=&limit=</code>", styles['TableCell']), Paragraph("200: Paginated run summaries.", styles['TableCell'])],
        [Paragraph("<code>GET /runs/:id</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("<code>:id</code>", styles['TableCell']), Paragraph("200: Run detail, lifecycle, assertions.", styles['TableCell'])],
        [Paragraph("<code>GET /runs/:id/events</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("<code>?afterSeq=&limit=</code>", styles['TableCell']), Paragraph("200: Sliced persisted events array.", styles['TableCell'])],
        [Paragraph("<code>GET /runs/:id/stream</code>", styles['TableCellCode']), Paragraph("Local Only", styles['TableCell']), Paragraph("<code>Last-Event-ID</code>", styles['TableCell']), Paragraph("200: Real-time SSE event stream.", styles['TableCell'])],
        [Paragraph("<code>GET /runs/:id/report</code>", styles['TableCellCode']), Paragraph("Both", styles['TableCell']), Paragraph("<code>:id</code>", styles['TableCell']), Paragraph("200: Canonical validated report JSON.", styles['TableCell'])],
        [Paragraph("<code>POST /operator/session</code>", styles['TableCellCode']), Paragraph("Local Only", styles['TableCell']), Paragraph("<code>{ password }</code>", styles['TableCell']), Paragraph("200: Session cookie + CSRF token.", styles['TableCell'])],
        [Paragraph("<code>POST /runs</code>", styles['TableCellCode']), Paragraph("Local Only", styles['TableCell']), Paragraph("<code>{ scenarioId, ... }</code>", styles['TableCell']), Paragraph("202: <code>{ runId, lifecycle: 'queued' }</code>", styles['TableCell'])],
        [Paragraph("<code>POST /runs/:id/cancel</code>", styles['TableCellCode']), Paragraph("Local Only", styles['TableCell']), Paragraph("<code>:id</code>", styles['TableCell']), Paragraph("200: Cancellation acknowledged.", styles['TableCell'])],
        [Paragraph("<code>POST /environments/:id/reset</code>", styles['TableCellCode']), Paragraph("Local Only", styles['TableCell']), Paragraph("<code>:id</code>", styles['TableCell']), Paragraph("202: Reset job queued.", styles['TableCell'])],
    ]
    story.append(create_table_box(api_data, [130, 65, 115, 190]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 14: SECURITY ARCHITECTURE & THREAT MODEL
    # ====================================================
    story.append(BookmarkPageRecorder("9. Security Architecture & Threat Model", styles['SecHeading'], 'sec_security', reg))
    story.append(Paragraph("Security design in TrustRehearsal is rooted in strict boundary isolation, defense-in-depth, and cryptographic hygiene.", styles['Body']))

    story.append(Paragraph("9.1 STRIDE Threat Analysis & Applied Mitigations", styles['SubHeading']))
    story.append(create_table_box(stride_data, [85, 195, 220]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("9.2 Security Invariants & Defense-in-Depth Controls", styles['SubHeading']))
    story.append(Paragraph("- <b>Loopback Interface Binding:</b> The administrative management plane (:18440-18445) and Express API bind strictly to <code>127.0.0.1</code>. Under no circumstances are management ports published to external interfaces.", styles['Bullet']))
    story.append(Paragraph("- <b>Bearer Authentication on CA Proxy:</b> Loopback issuance and management operations require a secret Bearer authorization token. Requests omitting or providing an invalid token are denied with HTTP 401 Unauthorized.", styles['Bullet']))
    story.append(Paragraph("- <b>Bounded Request Payloads:</b> All API and management endpoints enforce a strict 16 KB body size limit, mitigating memory exhaustion attacks from malformed payloads.", styles['Bullet']))
    story.append(Paragraph("- <b>Strict Hostname & Chain Verification:</b> Node.js TLS verification is never bypassed. All internal clients enforce <code>rejectUnauthorized: true</code>, ensuring that untrusted or mismatched certificates trigger authentic handshake rejections.", styles['Bullet']))
    story.append(Paragraph("- <b>Scrubbed Snapshot Exports:</b> The snapshot generation script (<code>exportRuns.ts</code>) enforces an automated regex scan ensuring zero PEM private key markers, session hashes, or internal secrets enter the public distribution.", styles['Bullet']))
    story.append(PageBreak())

    # ====================================================
    # PAGE 15: UI & EVIDENCE PRESENTATION (PART 1)
    # ====================================================
    story.append(BookmarkPageRecorder("10. User Interface & Evidence Presentation", styles['SecHeading'], 'sec_ui', reg))
    story.append(Paragraph("The user interface adheres to a clean, restrained enterprise aesthetic utilizing a 208px fixed navigation rail, subtle status chips, and responsive data tables.", styles['Body']))

    story.append(Paragraph("10.1 UI Views & Real Application Visual Evidence", styles['SubHeading']))

    if os.path.exists(ui_overview_path):
        story.append(Image(ui_overview_path, width=470, height=215))
        story.append(Paragraph("Figure 6: Application Overview: Mode badge, Hero trust path, Environment health summary, Scenario catalog cards, and Recent execution activity.", styles['FigCaption']))

    story.append(Spacer(1, 4))
    if os.path.exists(ui_timeline_path):
        story.append(Image(ui_timeline_path, width=470, height=215))
        story.append(Paragraph("Figure 7: Run Detail & SSE Timeline: Interactive phase disclosures, peer leaf SHA-256 fingerprints, assertion results, and raw structured JSON inspection.", styles['FigCaption']))

    story.append(PageBreak())

    # ====================================================
    # PAGE 16: UI & EVIDENCE PRESENTATION (PART 2)
    # ====================================================
    story.append(Paragraph("10. User Interface & Evidence Presentation (Continued)", styles['SecHeading']))

    if os.path.exists(ui_env_path):
        story.append(Image(ui_env_path, width=470, height=185))
        story.append(Paragraph("Figure 8: Environment Topology: Interactive SVG graph (gateway -> orders -> ledger) with node metadata and caller trust profiles.", styles['FigCaption']))

    story.append(Spacer(1, 4))
    if os.path.exists(ui_report_path):
        story.append(Image(ui_report_path, width=470, height=185))
        story.append(Paragraph("Figure 9: Canonical Report View: Validated methodology, observation windows, assertion outcomes, and clean printable A4 format.", styles['FigCaption']))

    story.append(Paragraph("10.2 Navigation & Information Hierarchy Analysis", styles['SubHeading']))
    story.append(Paragraph("The UI prioritizes rapid evidence discovery for technical reviewers. A visitor landing on the Overview grasps the core PKI trust path within 60 seconds, drills down into exact SHA-256 fingerprints within 2 minutes, and downloads a canonical report within 5 minutes. The layout strictly enforces that disabled controls (e.g. Start Rehearsal in public mode) are never rendered enabled to unauthenticated visitors.", styles['Body']))
    story.append(PageBreak())

    # ====================================================
    # PAGE 17: VERIFICATION & TRACEABILITY (RTM)
    # ====================================================
    story.append(BookmarkPageRecorder("11. Verification, Traceability & Test Results", styles['SecHeading'], 'sec_verification', reg))
    story.append(Paragraph("Verification in TrustRehearsal is multi-tiered, spanning contract unit tests, live TLS socket proofs, API integration tests, scenario executions, and external review harnesses.", styles['Body']))

    story.append(Paragraph("11.1 Requirement Traceability Matrix", styles['SubHeading']))
    story.append(create_table_box(rtm_data, [45, 125, 135, 195]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 18: VERIFICATION RESULTS & ACCEPTANCE GATES
    # ====================================================
    story.append(Paragraph("11. Verification, Traceability & Test Results (Continued)", styles['SecHeading']))
    story.append(Paragraph("11.2 Independent Verification Results & Review Findings", styles['SubHeading']))
    story.append(Paragraph("Verification was conducted across three distinct test execution harnesses:", styles['Body']))

    story.append(Paragraph("<b>1. Automated Vitest Suite (Repository Unit & Integration Tests):</b>", styles['BodyBold']))
    story.append(Paragraph("- <b>Result:</b> 27 of 27 automated tests passing across 6 suites (Execution time: 36.99s).<br/>"
                           "- <b>Suites:</b> <code>contracts.test.ts</code>, <code>tls-proof.test.ts</code>, <code>runs-and-api.test.ts</code>, <code>scenarios-s02-s03.test.ts</code>, <code>security-and-viewer.test.ts</code>, <code>regressions-review16.test.ts</code>.<br/>"
                           "- <b>Coverage:</b> Validates schema contracts, atomic certificate reloads, concurrent lease conflicts, S02/S03 scenario pipelines, CSRF denial, and regression checks R16, R17, and R18.", styles['Body']))

    story.append(Paragraph("<b>2. Independent Targeted Review Harness (<code>recheck-16.cjs</code>):</b>", styles['BodyBold']))
    story.append(Paragraph("- <b>Result:</b> 8 of 8 targeted defect checks passed cleanly:<br/>"
                           "  - <i>real-chain-and-management:</i> Baseline application path HTTP 200; missing management token rejected with HTTP 401.<br/>"
                           "  - <i>s03-before-cleanup:</i> All 4 assertions pass; final application request HTTP 200; <code>ledger</code> confirmed on Root B.<br/>"
                           "  - <i>issuance-fault-network:</i> HTTP renewal request traversed proxy and returned HTTP 502 Bad Gateway.<br/>"
                           "  - <i>anonymous-issuer:</i> Anonymous CA <code>POST /issue</code> rejected with HTTP 401 Unauthorized.<br/>"
                           "  - <i>event-persistence-failure:</i> Injected write failure properly halted run progression without false pass.<br/>"
                           "  - <i>api-503-silent-fallback:</i> Backend HTTP 503 truthfully surfaces <code>UNAVAILABLE</code> rather than recorded fallback.<br/>"
                           "  - <i>static-events-query:</i> Static query string parsing correctly handles <code>limit</code> and <code>afterSeq</code>.<br/>"
                           "  - <i>static-report-missing-evidence:</i> Empty snapshots truthfully report 0 samples and <code>not_run</code> recovery.", styles['Body']))

    story.append(Paragraph("<b>3. External Public Viewer Verification Harness:</b>", styles['BodyBold']))
    story.append(Paragraph("- <b>Result:</b> 117 assertions passed across the 9 recorded canonical runs.<br/>"
                           "- <b>Clarification on Review Evidence:</b> The 117-assertion harness is an external independent review script (<code>final-viewer-check.cjs</code>) executed during review auditing. It is not an internal bundled npm command, but serves as formal third-party audit evidence validating snapshot integrity, routing, and write denial.", styles['Body']))

    story.append(Paragraph("11.3 Release Acceptance Gate Checklist", styles['SubHeading']))
    story.append(create_table_box(gates_data, [110, 240, 150]))
    story.append(PageBreak())

    # ====================================================
    # PAGE 19: RISKS, FUTURE WORK, GLOSSARY & REFERENCES
    # ====================================================
    story.append(BookmarkPageRecorder("12. Technical Risks, Limitations & Future Roadmap", styles['SecHeading'], 'sec_risks_future', reg))
    story.append(Paragraph("12.1 Known Limitations of Current Implementation", styles['SubHeading']))
    story.append(Paragraph("- <b>Single-Process Loopback Topology:</b> All sample services run within a single Node.js runtime on distinct loopback ports rather than separate container network namespaces. While this eliminates Docker socket risks, it does not evaluate inter-container bridge networking delays.", styles['Bullet']))
    story.append(Paragraph("- <b>Server-Authenticated TLS Only:</b> The V1 release focuses exclusively on server-authenticated TLS. Mutual TLS (mTLS) client certificate verification is deferred to subsequent milestones.", styles['Bullet']))
    story.append(Paragraph("- <b>Periodic Sample Windows:</b> Probe observations represent periodic sample bursts (e.g. 5 to 30 handshakes) rather than continuous high-concurrency production saturation.", styles['Bullet']))

    story.append(Paragraph("12.2 Post-V1 Architecture Roadmap", styles['SubHeading']))
    story.append(Paragraph("- <b>Multi-Container Lab Topology (V2):</b> Containerize sample services into isolated OCI containers orchestrated via Docker Compose, utilizing dedicated loopback bridge networks without mounting host Docker sockets.", styles['Bullet']))
    story.append(Paragraph("- <b>Post-Quantum Cryptography (PQC) Rehearsals:</b> Rehearse hybrid classical/PQC leaf and root transitions (e.g. ML-DSA / Dilithium) to evaluate TLS handshake packet fragmentation and legacy client rejection.", styles['Bullet']))
    story.append(Paragraph("- <b>Automated GitOps CI/CD Integration:</b> Webhook integrations enabling pull-request previews to rehearse cryptographic changes in ephemeral staging environments prior to production merges.", styles['Bullet']))

    story.append(Spacer(1, 4))
    story.append(BookmarkPageRecorder("13. Glossary of Terms & Authoritative References", styles['SecHeading'], 'sec_glossary', reg))
    story.append(Paragraph("13.1 Glossary of Terms", styles['SubHeading']))
    story.append(Paragraph("- <b>Certificate Authority (CA):</b> An authoritative entity issuing X.509 certificates that cryptographically bind public keys to identities.<br/>"
                           "- <b>Subject Alternative Name (SAN):</b> An X.509 extension specifying hostnames, IP addresses, or URIs secured by the certificate.<br/>"
                           "- <b>Server Name Indication (SNI):</b> A TLS client extension indicating the target server hostname at the start of the handshake.<br/>"
                           "- <b>SHA-256 Fingerprint:</b> The 64-character hexadecimal SHA-256 digest of a certificate's raw DER-encoded bytes.<br/>"
                           "- <b>Dual Trust:</b> A transitional configuration where client trust bundles include both expiring and target Root CAs.<br/>"
                           "- <b>Fencing Token:</b> A monotonic integer preventing stale or partitioned workers from applying outdated state mutations.<br/>"
                           "- <b>Negative Control:</b> An experiment step intentionally designed to trigger an authentication failure, proving security checks are active.", styles['Body']))

    story.append(Paragraph("13.2 Authoritative Standards & References", styles['SubHeading']))
    story.append(Paragraph("1. <b>RFC 5280:</b> Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile.<br/>"
                           "2. <b>RFC 8446:</b> The Transport Layer Security (TLS) Protocol Version 1.3.<br/>"
                           "3. <b>RFC 6125:</b> Representation and Verification of Domain-Based Application Service Identity within Internet PKI.<br/>"
                           "4. <b>NIST SP 800-52 Rev. 2:</b> Guidelines for the Selection, Configuration, and Use of TLS Implementations.<br/>"
                           "5. <b>Project Repository:</b> <code>https://github.com/SubhodeepSamanta/TrustRehearsal.git</code>", styles['Body']))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceBefore=6, spaceAfter=8))
    story.append(Paragraph("TrustRehearsal Engineering Specification · Version 1.0 · Authored by Subhodeep Samanta", styles['CoverNote']))

    return story

def generate_pdf():
    styles = get_doc_styles()

    # Pass 1: Collect bookmark page numbers
    print("Pass 1: Recording Table of Contents page numbers...")
    toc_registry = {}
    doc_pass1 = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN
    )
    story_pass1 = build_pdf_story(styles, toc_registry)
    doc_pass1.build(story_pass1, canvasmaker=NumberedCanvas)
    print(f"Recorded {len(toc_registry)} section page numbers: {toc_registry}")

    # Pass 2: Render final PDF with accurate TOC links and page numbers
    print("Pass 2: Generating final PDF with accurate TOC...")
    doc_pass2 = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN
    )
    story_pass2 = build_pdf_story(styles, toc_registry)
    doc_pass2.build(story_pass2, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {OUTPUT_PDF}")

    # Inspect and enrich with PyMuPDF
    doc_fitz = pymupdf.open(OUTPUT_PDF)
    num_pages = len(doc_fitz)
    print(f"Final PDF Page Count: {num_pages} pages")

    # Set document outline (TOC)
    outline_entries = [
        [1, '1. Document Control & Table of Contents', toc_registry.get('sec_doc_control', 2)],
        [1, '2. Product Definition & Operational Context', toc_registry.get('sec_product_def', 3)],
        [1, '3. User Journeys & Concrete Use Cases', toc_registry.get('sec_user_journeys', 4)],
        [1, '4. Functional Requirements (FR-001 - FR-016)', toc_registry.get('sec_functional_reqs', 5)],
        [1, '5. Nonfunctional Requirements (NFR-SEC, REL, USA)', toc_registry.get('sec_nfr', 7)],
        [1, '6. Scenario Specifications (S01, S02, S03)', toc_registry.get('sec_scenarios', 8)],
        [1, '7. High-Level Design (HLD) & System Architecture', toc_registry.get('sec_hld', 10)],
        [1, '8. Low-Level Design (LLD) & Data Contracts', toc_registry.get('sec_lld', 12)],
        [1, '9. Security Architecture & Threat Model', toc_registry.get('sec_security', 14)],
        [1, '10. User Interface & Evidence Presentation', toc_registry.get('sec_ui', 15)],
        [1, '11. Verification, Traceability & Test Results', toc_registry.get('sec_verification', 17)],
        [1, '12. Technical Risks, Limitations & Future Roadmap', toc_registry.get('sec_risks_future', 19)],
        [1, '13. Glossary of Terms & Authoritative References', toc_registry.get('sec_glossary', 19)],
    ]
    doc_fitz.set_toc(outline_entries)

    # Enrich internal links on Page 2 (TOC page)
    page_2 = doc_fitz[1]
    links = page_2.get_links()
    target_pages = [
        toc_registry.get('sec_doc_control', 2),
        toc_registry.get('sec_product_def', 3),
        toc_registry.get('sec_user_journeys', 4),
        toc_registry.get('sec_functional_reqs', 5),
        toc_registry.get('sec_nfr', 7),
        toc_registry.get('sec_scenarios', 8),
        toc_registry.get('sec_hld', 10),
        toc_registry.get('sec_lld', 12),
        toc_registry.get('sec_security', 14),
        toc_registry.get('sec_ui', 15),
        toc_registry.get('sec_verification', 17),
        toc_registry.get('sec_risks_future', 19),
        toc_registry.get('sec_glossary', 19),
    ]

    for i, l in enumerate(links):
        idx = i // 2
        if idx < len(target_pages):
            l['page'] = target_pages[idx] - 1
            page_2.delete_link(l)
            page_2.insert_link(l)

    # Render Cover Preview to docs/images/srs-cover.png
    cover_preview_path = os.path.join(DOCS_DIR, 'images', 'srs-cover.png')
    page_1 = doc_fitz[0]
    pix = page_1.get_pixmap(dpi=200)
    pix.save(cover_preview_path)
    print(f"Saved cover preview image to {cover_preview_path} ({os.path.getsize(cover_preview_path)} bytes)")

    doc_fitz.save(OUTPUT_PDF, incremental=True, encryption=pymupdf.PDF_ENCRYPT_KEEP)
    doc_fitz.close()

    return num_pages

if __name__ == '__main__':
    generate_pdf()
