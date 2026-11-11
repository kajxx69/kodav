import path from 'node:path';
import {
  ASSESSMENT_LEVELS,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SEAT_LABELS,
  PROFILE_META,
  formatCiPhone,
  type AssessmentInput,
  type AssessmentResult,
  type Brand,
} from '@kodav/shared';
import PDFDocument from 'pdfkit';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const NAVY = '#0b1b33';
const MUTED = '#5b6b80';
const LINE = '#dfe4ec';
const SUNKEN = '#f4f6f9';
const LEVEL_COLORS = { bon: '#1f7a4d', moyen: '#a15c07', faible: '#b42318' } as const;

export type ServiceLink = { name: string; url: string };

const date = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Abidjan' }).format(d);

/** Rapport détaillé du bilan : score, points faibles classés, recommandations et services liés. */
export function renderAssessmentPdf(
  input: Pick<AssessmentInput, 'name' | 'email' | 'phone' | 'company' | 'profile' | 'seats'> & {
    answers: Record<string, string>;
    result: AssessmentResult;
    date: Date;
  },
  brand: Brand,
  links: Map<string, ServiceLink>,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 64, left: 48, right: 48 },
    bufferPages: true,
    info: { Title: 'Bilan de santé informatique', Author: brand.legalName },
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
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 20;
  const ensureSpace = (h: number) => {
    if (doc.y + h > bottomLimit()) doc.addPage();
  };

  doc.image(path.join(ASSETS, 'brand/kodav-logo-horizontal.png'), left, 44, { height: 36 });
  doc
    .font('regular')
    .fontSize(9)
    .fillColor(MUTED)
    .text([brand.legalName, brand.email].filter(Boolean).join('\n'), left, 50, {
      width,
      align: 'right',
    });

  doc.font('display').fontSize(22).fillColor(NAVY).text('Bilan de santé informatique', left, 118);
  const who = [
    input.company || input.name,
    PROFILE_META[input.profile].label,
    ASSESSMENT_SEAT_LABELS[input.seats],
  ];
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(MUTED)
    .text(`${who.join('  ·  ')}  ·  ${date(input.date)}`, left, doc.y + 4);
  doc.text(
    `Contact : ${input.name}, ${input.email}, ${formatCiPhone(input.phone)}`,
    left,
    doc.y + 2,
  );

  // Score
  const { result } = input;
  const level = ASSESSMENT_LEVELS[result.level];
  const y = doc.y + 18;
  doc.save().roundedRect(left, y, width, 96, 8).fill(SUNKEN).restore();
  doc
    .font('display')
    .fontSize(36)
    .fillColor(NAVY)
    .text(`${result.score}`, left + 20, y + 18, { continued: true })
    .font('regular')
    .fontSize(14)
    .fillColor(MUTED)
    .text(' / 100');
  doc
    .font('semibold')
    .fontSize(12)
    .fillColor(LEVEL_COLORS[result.level])
    .text(level.label, left + 160, y + 22, { width: width - 180 });
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(NAVY)
    .text(level.summary, left + 160, doc.y + 4, { width: width - 180 });
  const barY = y + 74;
  const barW = width - 40;
  doc
    .save()
    .roundedRect(left + 20, barY, barW, 8, 4)
    .fill(LINE)
    .restore();
  doc
    .save()
    .roundedRect(left + 20, barY, Math.max((barW * result.score) / 100, 8), 8, 4)
    .fill(LEVEL_COLORS[result.level])
    .restore();
  doc.y = y + 120;

  // Points faibles
  doc.font('display').fontSize(14).fillColor(NAVY).text('Vos points d’amélioration', left);
  doc
    .font('regular')
    .fontSize(9.5)
    .fillColor(MUTED)
    .text('Classés du plus urgent au moins urgent.', left, doc.y + 2);
  doc.moveDown(0.8);
  if (!result.weaknesses.length) {
    doc
      .font('regular')
      .fontSize(10)
      .fillColor(NAVY)
      .text('Aucun point faible relevé dans vos réponses.', left);
  }
  result.weaknesses.forEach((w, i) => {
    ensureSpace(110);
    const top = doc.y;
    doc
      .font('semibold')
      .fontSize(11)
      .fillColor(NAVY)
      .text(`${i + 1}. ${w.theme}`, left, top, { width });
    doc
      .font('regular')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Votre réponse : ${w.answer}`, left + 14, doc.y + 2, { width: width - 14 });
    doc
      .font('regular')
      .fontSize(10)
      .fillColor(NAVY)
      .text(w.weakness, left + 14, doc.y + 4, { width: width - 14 });
    doc
      .font('semibold')
      .fontSize(10)
      .text('Recommandation : ', left + 14, doc.y + 4, { width: width - 14, continued: true })
      .font('regular')
      .text(w.recommendation);
    const link = links.get(w.serviceSlug);
    if (link) {
      doc
        .font('regular')
        .fontSize(9)
        .fillColor('#1d5fb8')
        .text(`Service : ${link.name}`, left + 14, doc.y + 4, {
          width: width - 14,
          link: link.url,
          underline: true,
        });
    }
    doc
      .save()
      .moveTo(left, doc.y + 10)
      .lineTo(left + width, doc.y + 10)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke()
      .restore();
    doc.y += 20;
  });

  // Points forts
  const strong = ASSESSMENT_QUESTIONS.filter(
    (q) => !result.weaknesses.some((w) => w.key === q.key),
  );
  if (strong.length) {
    ensureSpace(60);
    doc.moveDown(0.5);
    doc.font('display').fontSize(14).fillColor(NAVY).text('Vos points forts', left);
    doc.moveDown(0.4);
    doc
      .font('regular')
      .fontSize(10)
      .fillColor(NAVY)
      .list(
        strong.map((q) => q.theme),
        left + 6,
        doc.y,
        { bulletRadius: 2, textIndent: 12, width: width - 6 },
      );
  }

  ensureSpace(60);
  doc.moveDown(1.2);
  doc
    .font('regular')
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(
      'Ce bilan repose sur vos réponses et sur un barème indicatif. Il ne remplace pas un audit réalisé sur place par un technicien.',
      left,
      doc.y,
      { width },
    );

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('regular')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${brand.legalName} · Bilan de santé informatique · page ${i + 1}/${pages.count}`,
        left,
        doc.page.height - 40,
        { width, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
