import path from 'node:path';
import {
  INTERVENTION_MODE_LABELS,
  formatCiPhone,
  type AppointmentDto,
  type Brand,
} from '@kodav/shared';
import PDFDocument from 'pdfkit';

const ASSETS = path.resolve(import.meta.dirname, '../../../assets');
const NAVY = '#0b1b33';
const MUTED = '#5b6b80';
const LINE = '#dfe4ec';

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Abidjan',
  })
    .format(new Date(iso))
    .replace(/[\u202f\u00a0]/g, ' ');

const duration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
    : `${minutes} min`;

/** Rapport d'intervention : travaux, temps, matériel, photos et signature du client. */
export function renderReportPdf(
  appointment: AppointmentDto,
  brand: Brand,
  extras: { signature: Buffer | null; photos: Buffer[] },
): Promise<Buffer> {
  const report = appointment.report!;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 64, left: 48, right: 48 },
    bufferPages: true,
    info: { Title: `Rapport ${appointment.reference}`, Author: brand.legalName },
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
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  const ensure = (h: number) => {
    if (doc.y + h > bottomLimit()) doc.addPage();
  };

  doc.image(path.join(ASSETS, 'brand/kodav-logo-horizontal.png'), left, 44, { height: 36 });
  doc.font('regular').fontSize(9).fillColor(MUTED);
  doc.text([brand.legalName, brand.address, brand.email].filter(Boolean).join('\n'), left, 46, {
    width,
    align: 'right',
  });

  doc.font('display').fontSize(22).fillColor(NAVY).text('Rapport d’intervention', left, 118);
  doc
    .font('semibold')
    .fontSize(10)
    .text(appointment.reference, left, doc.y + 4);
  doc
    .font('regular')
    .fillColor(MUTED)
    .text(dateTime(appointment.start), left, doc.y + 2);

  const section = (title: string) => {
    ensure(40);
    doc.moveDown(1.2);
    doc.font('semibold').fontSize(8).fillColor(MUTED).text(title.toUpperCase(), left, doc.y, {
      characterSpacing: 0.6,
    });
    doc
      .moveTo(left, doc.y + 3)
      .lineTo(left + width, doc.y + 3)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.6);
    doc.font('regular').fontSize(10).fillColor(NAVY);
  };

  section('Client et intervention');
  const lines = [
    `${appointment.contact.name} · ${formatCiPhone(appointment.contact.phone)} · ${appointment.contact.email}`,
    `${INTERVENTION_MODE_LABELS[appointment.mode]}${appointment.address.commune ? ` · ${appointment.address.commune}` : ''}${appointment.address.street ? ` · ${appointment.address.street}` : ''}`,
    appointment.service ? `Prestation : ${appointment.service.name}` : '',
    appointment.technician
      ? `Technicien : ${appointment.technician.firstName} ${appointment.technician.lastName}`
      : '',
    `Temps passé : ${duration(report.timeSpentMinutes)}`,
  ].filter(Boolean);
  doc.text(lines.join('\n'), left, doc.y, { width, lineGap: 2 });

  section('Demande');
  doc.text(appointment.description || '—', left, doc.y, { width });

  section('Travaux effectués');
  doc.text(report.workDone || '—', left, doc.y, { width, lineGap: 2 });

  if (report.materials.length) {
    section('Matériel utilisé');
    for (const m of report.materials) {
      ensure(16);
      doc.text(`${m.quantity} × ${m.label}`, left, doc.y, { width });
    }
  }

  if (extras.photos.length) {
    section('Photos');
    const size = (width - 24) / 3;
    let x = left;
    let rowTop = doc.y;
    extras.photos.forEach((photo, i) => {
      if (i % 3 === 0) {
        if (i > 0) rowTop += size + 12;
        if (rowTop + size > bottomLimit()) {
          doc.addPage();
          rowTop = doc.page.margins.top;
        }
        x = left;
      }
      try {
        doc.image(photo, x, rowTop, { fit: [size, size], align: 'center', valign: 'center' });
      } catch {
        // Image illisible : ignorée plutôt que de faire échouer le rapport.
      }
      x += size + 12;
    });
    doc.y = rowTop + size + 8;
  }

  if (report.clientComment) {
    section('Commentaire du client');
    doc.text(report.clientComment, left, doc.y, { width });
  }

  section('Signature du client');
  if (extras.signature && report.signedAt) {
    ensure(110);
    const top = doc.y;
    doc.image(extras.signature, left, top, { fit: [220, 90] });
    doc.font('regular').fontSize(9).fillColor(MUTED);
    doc.text(`${report.signerName ?? ''}, le ${dateTime(report.signedAt)}`, left, top + 96, {
      width,
    });
  } else {
    doc.fillColor(MUTED).text('Rapport non signé.', left, doc.y, { width });
  }

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(8).fillColor(MUTED);
    doc.text(
      `${brand.legalName} · ${appointment.reference} · page ${i + 1}/${pages.count}`,
      left,
      doc.page.height - 40,
      { width, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
