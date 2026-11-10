import path from 'node:path';
import {
  INTERVENTION_MODE_LABELS,
  PROFILE_META,
  formatCiPhone,
  formatFcfa,
  type Brand,
  type QuoteDto,
  type Range,
} from '@kodav/shared';
import PDFDocument from 'pdfkit';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const FONTS = {
  regular: path.join(ASSETS, 'fonts/Inter-Regular.ttf'),
  semibold: path.join(ASSETS, 'fonts/Inter-SemiBold.ttf'),
  display: path.join(ASSETS, 'fonts/PlusJakartaSans-Bold.ttf'),
};
const LOGO = path.join(ASSETS, 'brand/kodav-logo-horizontal.png');

const NAVY = '#0b1b33';
const MUTED = '#5b6b80';
const LINE = '#dfe4ec';
const SUNKEN = '#f4f6f9';

/** Les espaces insécables fines d'Intl ne sont pas dans toutes les polices : espace simple. */
const clean = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ');
const money = (amount: number) => clean(formatFcfa(amount));
const number = (amount: number) => clean(new Intl.NumberFormat('fr-FR').format(amount));
const range = (r: Range) =>
  r.min === r.max ? money(r.min) : `${number(r.min)} – ${number(r.max)} FCFA`;
const date = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Abidjan' }).format(
    new Date(iso),
  );
const isRealPhone = (phone: string) => /^\+225\d{10}$/.test(phone);

type Row = { label: string; detail?: string; qty: string; unit: string; total: string };

/**
 * PDF d'un devis. Avant envoi par l'équipe, c'est une estimation (fourchettes) ;
 * une fois envoyé, il reprend les lignes et montants définitifs.
 */
export function renderQuotePdf(quote: QuoteDto, brand: Brand): Promise<Buffer> {
  const final =
    Boolean(quote.finalTotals) && ['envoye', 'accepte', 'refuse', 'expire'].includes(quote.status);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 64, left: 48, right: 48 },
    bufferPages: true,
    info: {
      Title: `${final ? 'Devis' : 'Estimation'} ${quote.reference}`,
      Author: brand.legalName,
    },
  });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('semibold', FONTS.semibold);
  doc.registerFont('display', FONTS.display);

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  // En-tête : logo et coordonnées de l'entreprise.
  doc.image(LOGO, left, 44, { height: 36 });
  const companyLines = [
    brand.legalName,
    brand.address,
    isRealPhone(brand.phone) ? formatCiPhone(brand.phone) : '',
    brand.email,
  ].filter(Boolean);
  doc.font('regular').fontSize(9).fillColor(MUTED);
  doc.text(companyLines.join('\n'), left, 46, { width, align: 'right' });

  // Titre et référence.
  doc.moveDown(2);
  let y = 118;
  doc.font('display').fontSize(22).fillColor(NAVY);
  doc.text(final ? 'Devis' : 'Estimation de votre demande', left, y);
  y = doc.y + 4;
  doc.font('semibold').fontSize(10).fillColor(NAVY).text(quote.reference, left, y);
  doc.font('regular').fillColor(MUTED);
  const dates = [`Demande du ${date(quote.submittedAt)}`];
  if (final && quote.validUntil) dates.push(`Valable jusqu’au ${date(quote.validUntil)}`);
  doc.text(dates.join('  ·  '), left, doc.y + 2);

  // Bloc client et intervention.
  y = doc.y + 16;
  const colWidth = (width - 16) / 2;
  const blockTop = y;
  const client = [
    quote.contact.company,
    quote.contact.name,
    quote.contact.email,
    formatCiPhone(quote.contact.phone),
  ].filter(Boolean);
  const intervention = [
    `Profil : ${PROFILE_META[quote.contact.profile]?.label ?? '—'}`,
    `Mode : ${INTERVENTION_MODE_LABELS[quote.mode]}`,
    quote.commune ? `Commune : ${quote.commune}` : '',
    quote.address ? `Adresse : ${quote.address}` : '',
    `Délai : ${quote.estimate.urgency.label}`,
  ].filter(Boolean);
  const block = (title: string, lines: string[], x: number) => {
    doc
      .font('semibold')
      .fontSize(8)
      .fillColor(MUTED)
      .text(title.toUpperCase(), x + 12, blockTop + 10, {
        width: colWidth - 24,
        characterSpacing: 0.6,
      });
    doc
      .font('regular')
      .fontSize(10)
      .fillColor(NAVY)
      .text(lines.join('\n'), x + 12, doc.y + 4, {
        width: colWidth - 24,
      });
    return doc.y;
  };
  const h = Math.max(
    block('Client', client, left),
    block('Intervention', intervention, left + colWidth + 16),
  );
  doc
    .save()
    .roundedRect(left, blockTop, colWidth, h - blockTop + 10, 6)
    .strokeColor(LINE)
    .stroke();
  doc
    .roundedRect(left + colWidth + 16, blockTop, colWidth, h - blockTop + 10, 6)
    .stroke()
    .restore();
  y = h + 26;

  // Tableau des lignes.
  // Les fourchettes de l'estimation demandent des colonnes de montants plus larges.
  const widths = final ? [0.46, 0.1, 0.2, 0.24] : [0.36, 0.1, 0.25, 0.29];
  const cols = [
    { key: 'label', title: 'Désignation', w: width * widths[0]!, align: 'left' as const },
    { key: 'qty', title: 'Qté', w: width * widths[1]!, align: 'right' as const },
    { key: 'unit', title: 'Prix unitaire', w: width * widths[2]!, align: 'right' as const },
    { key: 'total', title: 'Total', w: width * widths[3]!, align: 'right' as const },
  ];
  const rows: Row[] = final
    ? quote.finalItems.map((i) => ({
        label: i.label,
        detail: i.description,
        qty: `${i.quantity}${i.unitLabel ? ` ${i.unitLabel}${i.quantity > 1 ? 's' : ''}` : ''}`,
        unit: money(i.unitPrice),
        total: money(i.total),
      }))
    : quote.estimate.lines.map((l) => ({
        label: l.name,
        detail: l.options.map((o) => `${o.label} : ${o.value}`).join(' · '),
        qty:
          l.pricingMode === 'par_unite'
            ? `${l.quantity} ${l.unitLabel}${l.quantity > 1 ? 's' : ''}`
            : '1',
        unit: l.onQuote ? '—' : range(l.unit),
        total: l.onQuote ? 'Sur devis' : range(l.total),
      }));

  const header = () => {
    doc.save().rect(left, y, width, 22).fill(SUNKEN).restore();
    let x = left;
    doc.font('semibold').fontSize(8.5).fillColor(MUTED);
    for (const c of cols) {
      doc.text(c.title, x + 8, y + 7, { width: c.w - 16, align: c.align });
      x += c.w;
    }
    y += 26;
  };
  header();
  for (const row of rows) {
    doc.font('semibold').fontSize(10);
    const labelH = doc.heightOfString(row.label, { width: cols[0]!.w - 16 });
    doc.font('regular').fontSize(8.5);
    const detailH = row.detail ? doc.heightOfString(row.detail, { width: cols[0]!.w - 16 }) + 2 : 0;
    const rowH = Math.max(labelH + detailH, 14) + 12;
    if (y + rowH > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
    }
    let x = left;
    doc
      .font('semibold')
      .fontSize(10)
      .fillColor(NAVY)
      .text(row.label, x + 8, y, { width: cols[0]!.w - 16 });
    if (row.detail) {
      doc
        .font('regular')
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(row.detail, x + 8, doc.y + 2, {
          width: cols[0]!.w - 16,
        });
    }
    x += cols[0]!.w;
    doc.font('regular').fontSize(9.5).fillColor(NAVY);
    for (const c of cols.slice(1)) {
      doc.text(row[c.key as keyof Row] ?? '', x + 8, y, { width: c.w - 16, align: c.align });
      x += c.w;
    }
    y += rowH;
    doc
      .save()
      .moveTo(left, y - 6)
      .lineTo(left + width, y - 6)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke()
      .restore();
  }

  // Totaux.
  const totals: [string, string, boolean?][] = [];
  if (final && quote.finalTotals) {
    const t = quote.finalTotals;
    totals.push(['Sous-total', money(t.subtotal)]);
    if (t.discount) totals.push(['Remise', `- ${money(t.discount)}`]);
    if (t.travelFee) totals.push(['Déplacement', money(t.travelFee)]);
    totals.push(['Total', money(t.total), true]);
  } else {
    const e = quote.estimate;
    totals.push(['Sous-total', range(e.subtotal)]);
    if (e.volumeDiscount.max) totals.push(['Remise volume', `- ${range(e.volumeDiscount)}`]);
    if (e.urgency.percent) totals.push([`Urgence (${e.urgency.label})`, range(e.urgency.amount)]);
    if (e.travel.status === 'included')
      totals.push([`Déplacement (${e.travel.commune})`, money(e.travel.fee)]);
    if (e.travel.status === 'on_quote') totals.push(['Déplacement hors Abidjan', 'Sur devis']);
    totals.push(['Total estimé', range(e.total), true]);
  }
  y += 6;
  const totalsX = left + width * 0.4;
  const totalsW = width * 0.6;
  const labelW = totalsW * 0.45 - 8;
  const valueW = totalsW * 0.55 - 8;
  for (const [label, value, strong] of totals) {
    doc.font(strong ? 'semibold' : 'regular').fontSize(strong ? 11 : 9.5);
    const rowH = Math.max(
      doc.heightOfString(label, { width: labelW }),
      doc.heightOfString(value, { width: valueW }),
    );
    if (strong) {
      doc
        .save()
        .rect(totalsX, y - 6, totalsW, rowH + 12)
        .fill(NAVY)
        .restore();
      doc.fillColor('#ffffff');
    } else {
      doc.fillColor(NAVY);
    }
    doc.text(label, totalsX + 8, y, { width: labelW });
    doc.text(value, totalsX + totalsW * 0.45, y, { width: valueW, align: 'right' });
    y += rowH + (strong ? 18 : 8);
  }

  // Notes et mentions.
  y += 8;
  const notes: string[] = [];
  if (!final) {
    notes.push(
      'Estimation indicative et non contractuelle, calculée à partir de vos réponses. Notre équipe vous adresse un devis définitif après étude de votre demande.',
    );
    if (quote.estimate.hasOnQuoteItems) {
      notes.push('Les prestations « sur devis » sont chiffrées après un échange avec vous.');
    }
  }
  if (quote.estimate.isPlaceholderPrice && !final) {
    notes.push('Les tarifs affichés sont des tarifs d’exemple, susceptibles d’évoluer.');
  }
  if (quote.clientNotes) notes.push(`Votre message : ${quote.clientNotes}`);
  notes.push('Montants en francs CFA (FCFA).');
  doc.font('regular').fontSize(8.5).fillColor(MUTED);
  doc.text(notes.join('\n\n'), left, y, { width });

  // Pied de page numéroté.
  const range_ = doc.bufferedPageRange();
  for (let i = 0; i < range_.count; i++) {
    doc.switchToPage(range_.start + i);
    // Écrire sous la marge basse ajouterait une page : marge levée le temps du pied de page.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(8).fillColor(MUTED);
    doc.text(
      `${brand.legalName} · ${quote.reference} · page ${i + 1}/${range_.count}`,
      left,
      doc.page.height - 40,
      { width, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
