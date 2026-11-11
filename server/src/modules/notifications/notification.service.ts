import type { NotificationDto, NotificationType } from '@kodav/shared';
import type { Types } from 'mongoose';
import { logger } from '../../config/logger.js';
import { emitTo } from '../../lib/socket.js';
import { Notification, type NotificationDoc } from '../support/support.model.js';
import { User } from '../users/user.model.js';

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

export function toNotificationDto(n: NotificationDoc & { _id: Types.ObjectId }): NotificationDto {
  return {
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Notification en base + poussée en direct (cloche et toast) ; jamais bloquante. */
export async function notify(
  users: (Types.ObjectId | string | null | undefined)[],
  input: NotificationInput,
) {
  const unique = [...new Set(users.filter(Boolean).map(String))];
  if (!unique.length) return;
  try {
    const docs = await Notification.insertMany(
      unique.map((user) => ({ user, body: '', link: '', ...input })),
    );
    for (const doc of docs) {
      emitTo([`user:${String(doc.user)}`], 'notification:new', toNotificationDto(doc.toObject()));
    }
  } catch (err) {
    logger.error({ err }, 'Notification impossible');
  }
}

/** Notifie tous les administrateurs actifs. */
export async function notifyAdmins(input: NotificationInput) {
  const admins = await User.find({ role: 'admin', isActive: true }, { _id: 1 }).lean();
  await notify(
    admins.map((a) => a._id),
    input,
  );
}
