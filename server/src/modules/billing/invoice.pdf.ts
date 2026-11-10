import path from 'node:path';
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCiPhone,
  formatFcfa,
  type Brand,
  type InvoiceDto,
} from '@kodav/shared';
import PDFDocument from 'pdfkit';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const NAVY = '#0b1b33';
const MUTED = '#5b6b80';
const LINE = '#dfe4ec';
const SUNKEN = '#f4f6f9';

const clean = (v: string) => v.replace(/[\u202f\u00a0]/g, ' ');
const money = (n: number) => clean(formatFcfa(n));
const date = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Abidjan' }).format(
    new Date(iso),
  );

/** Facture : lignes du devis accepté, TVA paramétrable, règlements et reste dû. */
export function renderInvoicePdf(
  invoice: InvoiceDto,
  brand: Brand,
  settings: { legalMentions: string; bankDetails: string },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 64, left: 48, right: 48 },
    bufferPages: true,
    info: { Title: `Facture ${invoice.reference}`, Author: brand.legalName },
  });
  doc.registerFont('regular', path.join(ASSETS, 'fonts/Inter-Regular.ttf'));
  doc.registerFont('semibold', path.join(ASSETS, 'fonts/Inter-SemiBold.ttf'));
  doc.registerFont('display', path.join(ASSETS, 'fonts/PlusJakartaSans-Bold.ttf'));
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  doc.image(path.join(ASSETS, 'brand/kodav-logo-horizontal.png'), left, 44, { height: 36 });
  const company = [
    brand.legalName,
    brand.address,
    /^\+225\d{10}$/.test(brand.phone) ? formatCiPhone(brand.phone) : '',
    brand.email,
  ].filter(Boolean);
  doc
    .font('regular')
    .fontSize(9)
    .fillColor(MUTED)
    .text(company.join('\n'), left, 46, { width, align: 'right' });

  doc.font('display').fontSize(22).fillColor(NAVY).text('Facture', left, 118);
  doc
    .font('semibold')
    .fontSize(10)
    .text(invoice.reference, left, doc.y + 4);
  doc
    .font('regular')
    .fillColor(MUTED)
    .text(
      `Émise le ${date(invoice.issuedAt)}  ·  Échéance le ${date(invoice.dueAt)}  ·  Devis ${invoice.quote.reference}`,
      left,
      doc.y + 2,
    );
  if (invoice.status === 'annulee') {
    doc
      .font('semibold')
      .fontSize(10)
      .fillColor('#b42318')
      .text('FACTURE ANNULÉE', left, doc.y + 6);
  }

  // Client facturé
  let y = doc.y + 16;
  const b = invoice.billing;
  const billed = [b.company, b.name, b.address, b.email, formatCiPhone(b.phone)].filter(Boolean);
  doc
    .font('semibold')
    .fontSize(8)
    .fillColor(MUTED)
    .text('FACTURÉ À', left + 12, y + 10, { characterSpacing: 0.6 });
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(NAVY)
    .text(billed.join('\n'), left + 12, doc.y + 4, { width: width / 2 });
  const blockBottom = doc.y + 10;
  doc
    .save()
    .roundedRect(left, y, width / 2 + 24, blockBottom - y, 6)
    .strokeColor(LINE)
    .stroke()
    .restore();
  y = blockBottom + 20;

  // Lignes
  const cols = [
    { title: 'Désignation', w: width * 0.46, align: 'left' as const },
    { title: 'Qté', w: width * 0.1, align: 'right' as const },
    { title: 'Prix unitaire', w: width * 0.2, align: 'right' as const },
    { title: 'Total', w: width * 0.24, align: 'right' as const },
  ];
  doc.save().rect(left, y, width, 22).fill(SUNKEN).restore();
  let x = left;
  doc.font('semibold').fontSize(8.5).fillColor(MUTED);
  for (const c of cols) {
    doc.text(c.title, x + 8, y + 7, { width: c.w - 16, align: c.align });
    x += c.w;
  }
  y += 28;
  for (const item of invoice.items) {
    doc.font('semibold').fontSize(10);
    const h =
      doc.heightOfString(item.label, { width: cols[0]!.w - 16 }) +
      (item.description
        ? doc
            .font('regular')
            .fontSize(8.5)
            .heightOfString(item.description, { width: cols[0]!.w - 16 }) + 2
        : 0);
    if (y + h + 12 > doc.page.height - 200) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc
      .font('semibold')
      .fontSize(10)
      .fillColor(NAVY)
      .text(item.label, left + 8, y, { width: cols[0]!.w - 16 });
    if (item.description) {
      doc
        .font('regular')
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(item.description, left + 8, doc.y + 2, { width: cols[0]!.w - 16 });
    }
    const values = [
      `${item.quantity}${item.unitLabel ? ` ${item.unitLabel}${item.quantity > 1 ? 's' : ''}` : ''}`,
      money(item.unitPrice),
      money(item.total),
    ];
    x = left + cols[0]!.w;
    doc.font('regular').fontSize(9.5).fillColor(NAVY);
    values.forEach((v, i) => {
      doc.text(v, x + 8, y, { width: cols[i + 1]!.w - 16, align: 'right' });
      x += cols[i + 1]!.w;
    });
    y += Math.max(h, 14) + 12;
    doc
      .save()
      .moveTo(left, y - 6)
      .lineTo(left + width, y - 6)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke()
      .restore();
  }

  // Totaux
  const rows: [string, string, boolean?][] = [['Sous-total', money(invoice.subtotal)]];
  if (invoice.discount) rows.push(['Remise', `- ${money(invoice.discount)}`]);
  if (invoice.travelFee) rows.push(['Déplacement', money(invoice.travelFee)]);
  rows.push([
    invoice.taxRate ? `TVA ${invoice.taxRate} %` : 'TVA',
    invoice.taxRate ? money(invoice.taxAmount) : 'Non applicable',
  ]);
  rows.push(['Total', money(invoice.total), true]);
  if (invoice.paid) {
    rows.push(['Déjà réglé', `- ${money(invoice.paid)}`]);
    rows.push(['Reste à payer', money(Math.max(invoice.total - invoice.paid, 0)), true]);
  }
  y += 6;
  const tx = left + width * 0.46;
  const tw = width * 0.54;
  for (const [label, value, strong] of rows) {
    if (strong) {
      doc
        .save()
        .rect(tx, y - 5, tw, 24)
        .fill(NAVY)
        .restore();
      doc.font('semibold').fontSize(11).fillColor('#ffffff');
    } else {
      doc.font('regular').fontSize(9.5).fillColor(NAVY);
    }
    doc.text(label, tx + 8, y, { width: tw / 2 - 8 });
    doc.text(value, tx + tw / 2, y, { width: tw / 2 - 8, align: 'right' });
    y += strong ? 30 : 18;
  }

  // Règlements, coordonnées bancaires, mentions
  y += 10;
  doc.font('regular').fontSize(8.5).fillColor(MUTED);
  const notes: string[] = [`Statut : ${INVOICE_STATUS_LABELS[invoice.status]}.`];
  if (invoice.payments.length) {
    notes.push(
      `Règlements reçus : ${invoice.payments
        .map(
          (p) =>
            `${money(p.amount)} le ${date(p.paidAt)} (${PAYMENT_METHOD_LABELS[p.method]}${p.reference ? `, ${p.reference}` : ''})`,
        )
        .join(' ; ')}.`,
    );
  }
  if (settings.bankDetails) notes.push(`Coordonnées de paiement :\n${settings.bankDetails}`);
  if (settings.legalMentions) notes.push(settings.legalMentions);
  notes.push('Montants en francs CFA (FCFA).');
  doc.text(notes.join('\n\n'), left, y, { width });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(8).fillColor(MUTED);
    doc.text(
      `${brand.legalName} · ${invoice.reference} · page ${i + 1}/${pages.count}`,
      left,
      doc.page.height - 40,
      {
        width,
        align: 'center',
        lineBreak: false,
      },
    );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
