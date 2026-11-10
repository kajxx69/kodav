import {
  LICENSE_ALERT_DAYS,
  assetInputSchema,
  type AssetDto,
  type NotificationList,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted, type QueryFilter, type Types } from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { decryptSecret, encryptSecret } from '../../lib/crypto.js';
import { AppError, sendOk } from '../../lib/http.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { authenticate, requireRole, type RequestUser } from '../../middlewares/auth.js';
import { notify, toNotificationDto } from '../notifications/notification.service.js';
import { User } from '../users/user.model.js';
import { Asset, AuditLog, Notification, Ticket, type AssetDoc } from './support.model.js';

type LeanAsset = AssetDoc & { _id: Types.ObjectId };
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

function toAssetDto(a: LeanAsset, openTickets: number, keyStored: boolean): AssetDto {
  return {
    id: String(a._id),
    type: a.type,
    name: a.name,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serialNumber,
    location: a.location,
    assignedTo: a.assignedTo,
    purchaseDate: day(a.purchaseDate),
    warrantyUntil: day(a.warrantyUntil),
    status: a.status,
    notes: a.notes,
    license: a.license
      ? {
          product: a.license.product,
          seats: a.license.seats,
          expiresAt: day(a.license.expiresAt),
          keyLast5: a.license.keyLast5,
          keyStored,
        }
      : null,
    openTickets,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Parc de l'utilisateur : celui de son organisation, ou le sien pour un particulier. */
function parkScope(user: RequestUser): QueryFilter<AssetDoc> {
  return user.organization ? { organization: user.organization } : { owner: user._id };
}

async function loadAssets(filter: QueryFilter<AssetDoc>) {
  const assets = await Asset.find(filter)
    .select('+license.keyEncrypted')
    .sort({ type: 1, name: 1 })
    .lean<LeanAsset[]>();
  const counts = await Ticket.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        asset: { $in: assets.map((a) => a._id) },
        status: { $in: ['ouvert', 'en_cours', 'attente_client'] },
      },
    },
    { $group: { _id: '$asset', count: { $sum: 1 } } },
  ]);
  const byAsset = new Map(counts.map((c) => [String(c._id), c.count]));
  return assets.map((a) =>
    toAssetDto(a, byAsset.get(String(a._id)) ?? 0, Boolean(a.license?.keyEncrypted)),
  );
}

/** Données à enregistrer : la clé n'est jamais gardée en clair. */
function assetFields(
  input: ReturnType<typeof assetInputSchema.parse>,
  previous?: LeanAsset | null,
) {
  const { license, purchaseDate, warrantyUntil, ...rest } = input;
  const fields: Record<string, unknown> = {
    ...rest,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    warrantyUntil: warrantyUntil ? new Date(warrantyUntil) : null,
  };
  if (input.type !== 'licence' || !license) {
    fields.license = null;
    return fields;
  }
  const expiresAt = license.expiresAt ? new Date(license.expiresAt) : null;
  const key = license.key.replace(/\s+/g, '');
  const keepPrevious = !key && previous?.license;
  fields.license = {
    product: license.product,
    seats: license.seats,
    expiresAt,
    keyLast5: key ? key.slice(-5) : (previous?.license?.keyLast5 ?? ''),
    ...(key && license.storeKey
      ? { keyEncrypted: encryptSecret(key) }
      : keepPrevious && previous?.license?.keyEncrypted
        ? { keyEncrypted: previous.license.keyEncrypted }
        : {}),
  };
  // Nouvelle date d'expiration : les alertes repartent de zéro.
  if (!previous || day(previous.license?.expiresAt) !== day(expiresAt)) fields.alertsSent = [];
  return fields;
}

export const assetsRouter = Router();
assetsRouter.use(authenticate, requireRole('client'));

assetsRouter.get('/', async (req, res) => {
  sendOk(res, await loadAssets(parkScope(req.user!)));
});

/** Licences qui expirent dans les 60 jours (ou déjà expirées). */
assetsRouter.get('/licenses/expiring', async (req, res) => {
  const limit = new Date(Date.now() + 60 * 24 * 3600_000);
  sendOk(
    res,
    await loadAssets({
      ...parkScope(req.user!),
      type: 'licence',
      status: trusted({ $ne: 'retire' }),
      'license.expiresAt': trusted({ $lte: limit }),
    }),
  );
});

assetsRouter.post('/', async (req, res) => {
  const user = req.user!;
  const input = assetInputSchema.parse(req.body);
  const asset = await Asset.create({
    ...assetFields(input),
    organization: user.organization,
    owner: user.organization ? null : user._id,
  });
  sendOk(res, (await loadAssets({ _id: asset._id }))[0], 201);
});

async function ownedAsset(id: unknown, user: RequestUser) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
    throw AppError.notFound('Équipement introuvable');
  const asset = await Asset.findOne({ _id: id, ...parkScope(user) })
    .select('+license.keyEncrypted')
    .lean<LeanAsset>();
  if (!asset) throw AppError.notFound('Équipement introuvable');
  return asset;
}

assetsRouter.put('/:id', async (req, res) => {
  const previous = await ownedAsset(req.params.id, req.user!);
  const input = assetInputSchema.parse(req.body);
  const fields = assetFields(input, previous);
  await Asset.updateOne({ _id: previous._id }, { $set: fields });
  sendOk(res, (await loadAssets({ _id: previous._id }))[0]);
});

assetsRouter.delete('/:id', async (req, res) => {
  const asset = await ownedAsset(req.params.id, req.user!);
  // Les tickets gardent leur historique : le lien vers l'équipement est simplement retiré.
  await Ticket.updateMany({ asset: asset._id }, { asset: null });
  await Asset.deleteOne({ _id: asset._id });
  sendOk(res, { deleted: true });
});

// --- Admin : clé de licence confiée -------------------------------------------------

export const adminAssetsRouter = Router();
adminAssetsRouter.use(authenticate, requireRole('admin'));

/** Révélation d'une clé confiée : action journalisée (qui, quand, depuis où). */
adminAssetsRouter.post('/:id/reveal-key', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(String(req.params.id)))
    throw AppError.notFound('Équipement introuvable');
  const asset = await Asset.findById(req.params.id).select('+license.keyEncrypted').lean();
  if (!asset?.license?.keyEncrypted)
    throw AppError.notFound('Aucune clé confiée pour cet équipement');
  await AuditLog.create({
    actor: req.user!._id,
    action: 'license.reveal_key',
    entity: 'Asset',
    entityId: asset._id,
    summary: `Clé de ${asset.license.product} (${asset.name})`,
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 200),
  });
  res.set('Cache-Control', 'no-store');
  sendOk(res, { key: decryptSecret(asset.license.keyEncrypted) });
});

// --- Notifications ---------------------------------------------------------------

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user!._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user!._id, readAt: null }),
  ]);
  sendOk(res, { items: items.map(toNotificationDto), unread } satisfies NotificationList);
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(String(req.params.id)))
    throw AppError.notFound('Notification introuvable');
  await Notification.updateOne(
    { _id: req.params.id, user: req.user!._id, readAt: null },
    { readAt: new Date() },
  );
  sendOk(res, { read: true });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user!._id, readAt: null }, { readAt: new Date() });
  sendOk(res, { read: true });
});

// --- Alertes de licences (tâche quotidienne) ---------------------------------------

/** Destinataires : membres de l'organisation, ou le particulier propriétaire. */
async function parkRecipients(asset: LeanAsset) {
  const filter = asset.organization ? { organization: asset.organization } : { _id: asset.owner };
  return User.find(
    { ...filter, isActive: true },
    { email: 1, firstName: 1, notificationPrefs: 1 },
  ).lean();
}

export async function sendLicenseAlerts(now = new Date()) {
  const horizon = new Date(now.getTime() + Math.max(...LICENSE_ALERT_DAYS) * 24 * 3600_000);
  const due = await Asset.find({
    type: 'licence',
    status: trusted({ $ne: 'retire' }),
    'license.expiresAt': trusted({ $lte: horizon }),
  }).lean<LeanAsset[]>();
  let sent = 0;
  for (const asset of due) {
    const expiresAt = asset.license!.expiresAt!;
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 3600_000));
    // Seuil le plus proche atteint et pas encore signalé.
    const threshold = [...LICENSE_ALERT_DAYS]
      .sort((a, b) => a - b)
      .find((d) => daysLeft <= d && !asset.alertsSent.includes(d));
    if (threshold === undefined) continue;
    await Asset.updateOne(
      { _id: asset._id },
      { $addToSet: { alertsSent: { $each: LICENSE_ALERT_DAYS.filter((d) => d >= threshold) } } },
    );
    const recipients = await parkRecipients(asset);
    const when =
      daysLeft <= 0 ? 'a expiré' : `expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
    const title = `Licence ${asset.license!.product} : ${when}`;
    await notify(
      recipients.map((r) => r._id),
      { type: 'license_expiring', title, body: asset.name, link: '/espace-client/parc' },
    );
    for (const r of recipients.filter((r) => r.notificationPrefs?.email !== false)) {
      await sendTemplatedMail({
        to: r.email,
        subject: title,
        greeting: `Bonjour ${r.firstName},`,
        paragraphs: [
          `La licence ${asset.license!.product} (${asset.name}, ${asset.license!.seats} poste${asset.license!.seats > 1 ? 's' : ''}) ${when}, le ${expiresAt.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' })}.`,
          'Nous pouvons vous proposer un renouvellement avec une licence authentique.',
        ],
        action: { label: 'Voir mon parc', url: `${env.CLIENT_URL}/espace-client/parc` },
      }).catch((err: unknown) => logger.error({ err }, 'Email d’alerte de licence'));
    }
    sent++;
  }
  if (sent) logger.info({ count: sent }, 'Alertes de licences envoyées');
  return sent;
}
