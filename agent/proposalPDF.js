import PDFDocument from 'pdfkit';

const COLORS = {
  primary: '#1a1a2e',
  accent: '#4f46e5',
  accentLight: '#818cf8',
  green: '#10b981',
  red: '#ef4444',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  bg: '#f9fafb',
};

function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgb(hex) {
  return hexToRGB(hex);
}

export function generateProposalPDF(proposal) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // minus margins

    // ── Header bar ──────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);

    doc.fillColor('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('PROJECT PROPOSAL', 50, 22);

    doc.fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.accentLight)
      .text('Prepared by Vishal · Full Stack Developer · Mumbai, India', 50, 50);

    // Valid until tag (top right)
    const validDate = new Date();
    validDate.setDate(validDate.getDate() + (proposal.validDays || 7));
    doc.fillColor('#ffffff')
      .fontSize(9)
      .text(`Valid until: ${validDate.toDateString()}`, 350, 30, { width: 200, align: 'right' });

    doc.moveDown(3);

    // ── Project title block ──────────────────────────────────────
    let y = 100;

    doc.rect(50, y, pageWidth, 50)
      .fill(COLORS.bg);

    doc.fillColor(COLORS.accent)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(proposal.projectTitle, 65, y + 10, { width: pageWidth - 30 });

    doc.fillColor(COLORS.muted)
      .fontSize(10)
      .font('Helvetica')
      .text(`Prepared for: ${proposal.clientName}`, 65, y + 30);

    y += 65;

    // ── Project Understanding ────────────────────────────────────
    y = sectionHeader(doc, 'PROJECT UNDERSTANDING', y, pageWidth);

    doc.fillColor(COLORS.text)
      .fontSize(10.5)
      .font('Helvetica')
      .text(proposal.projectUnderstanding, 50, y, { width: pageWidth, lineGap: 4 });

    y = doc.y + 20;

    // ── Deliverables ─────────────────────────────────────────────
    y = sectionHeader(doc, 'SCOPE & DELIVERABLES', y, pageWidth);

    const included = proposal.deliverables.filter(d => d.included);
    const excluded = proposal.deliverables.filter(d => !d.included);

    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COLORS.muted).text('INCLUDED', 50, y);
    y = doc.y + 4;

    for (const d of included) {
      doc.circle(58, y + 4, 3).fill(COLORS.green);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(d.item, 70, y, { width: pageWidth - 20 });
      y = doc.y + 3;
    }

    if (excluded.length > 0) {
      y += 6;
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COLORS.muted).text('NOT INCLUDED (out of scope)', 50, y);
      y = doc.y + 4;

      for (const d of excluded) {
        doc.circle(58, y + 4, 3).fill(COLORS.red);
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(d.item, 70, y, { width: pageWidth - 20 });
        y = doc.y + 3;
      }
    }

    y = doc.y + 20;

    // ── Timeline ─────────────────────────────────────────────────
    // New page if less than 200px left
    if (y > 580) { doc.addPage(); y = 50; }

    y = sectionHeader(doc, `TIMELINE  (${proposal.totalDays} working days)`, y, pageWidth);

    const phaseW = pageWidth / proposal.timeline.length;

    // Phase boxes
    for (let i = 0; i < proposal.timeline.length; i++) {
      const phase = proposal.timeline[i];
      const x = 50 + i * phaseW;
      const boxW = phaseW - 6;

      doc.rect(x, y, boxW, 56).fill(i % 2 === 0 ? COLORS.accent : COLORS.primary);

      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(phase.phase, x + 6, y + 6, { width: boxW - 10 });

      doc.fillColor(COLORS.accentLight)
        .font('Helvetica')
        .fontSize(8)
        .text(phase.duration, x + 6, y + 22, { width: boxW - 10 });

      doc.fillColor('#d1d5db')
        .fontSize(7.5)
        .text(phase.description, x + 6, y + 34, { width: boxW - 10 });
    }

    y += 70;

    // ── Investment ────────────────────────────────────────────────
    if (y > 560) { doc.addPage(); y = 50; }

    y = sectionHeader(doc, 'INVESTMENT', y, pageWidth);

    // Breakdown table
    for (const line of proposal.price.breakdown) {
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
        .text(`• ${line.label}`, 50, y, { width: pageWidth - 80 });
      doc.fillColor(COLORS.accent).font('Helvetica-Bold')
        .text(`${proposal.price.symbol}${line.amount.toLocaleString()}`, 50, y, { width: pageWidth, align: 'right' });
      y = doc.y + 4;
    }

    // Divider
    y += 4;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    y += 8;

    // Total
    doc.rect(50, y, pageWidth, 36).fill(COLORS.accent);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
      .text('TOTAL PROJECT COST', 65, y + 10);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
      .text(`${proposal.price.symbol}${proposal.price.amount.toLocaleString()}`, 65, y + 8, { width: pageWidth - 30, align: 'right' });

    y += 50;

    // Payment split
    doc.rect(50, y, pageWidth / 2 - 4, 40).fill(COLORS.bg);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('DUE NOW (50% upfront)', 60, y + 6);
    doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(14)
      .text(`${proposal.price.symbol}${proposal.price.upfront.toLocaleString()}`, 60, y + 18);

    doc.rect(50 + pageWidth / 2 + 4, y, pageWidth / 2 - 4, 40).fill(COLORS.bg);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('ON DELIVERY', 60 + pageWidth / 2 + 4, y + 6);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(14)
      .text(`${proposal.price.symbol}${proposal.price.onDelivery.toLocaleString()}`, 60 + pageWidth / 2 + 4, y + 18);

    y += 56;

    // ── Terms ─────────────────────────────────────────────────────
    if (y > 620) { doc.addPage(); y = 50; }

    y = sectionHeader(doc, 'TERMS & CONDITIONS', y, pageWidth);

    for (const term of proposal.terms) {
      doc.rect(50, y, 3, 10).fill(COLORS.accent);
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.5)
        .text(term, 60, y, { width: pageWidth - 10 });
      y = doc.y + 5;
    }

    y = doc.y + 20;

    // ── Footer CTA ────────────────────────────────────────────────
    if (y > 680) { doc.addPage(); y = 50; }

    doc.rect(50, y, pageWidth, 60).fill(COLORS.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
      .text('Ready to get started?', 65, y + 10);
    doc.fillColor(COLORS.accentLight).font('Helvetica').fontSize(10)
      .text('Reply to this email or WhatsApp +91-XXXXXXXXXX  ·  vishal.buildss@gmail.com', 65, y + 28);
    doc.fillColor(COLORS.muted).fontSize(8)
      .text('github.com/vishal8291  ·  Mumbai, India  ·  Available to start within 24h', 65, y + 44);

    doc.end();
  });
}

function sectionHeader(doc, title, y, width) {
  doc.rect(50, y, width, 1).fill(COLORS.accent);
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9)
    .text(title, 50, y + 5, { characterSpacing: 1 });
  return doc.y + 10;
}
