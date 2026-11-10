import type http from 'node:http';
import type { UserRole } from '@kodav/shared';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let io: Server | null = null;

type SocketIdentity =
  { kind: 'user'; userId: string; role: UserRole } | { kind: 'tracking'; appointmentId: string };

const TRACKING_TTL = '2h';

/** Jeton de lecture seule pour la page publique /suivi : une seule intervention. */
export function signTrackingToken(appointmentId: string) {
  return jwt.sign({ scope: 'tracking', apt: appointmentId }, env.JWT_ACCESS_SECRET, {
    expiresIn: TRACKING_TTL,
    algorithm: 'HS256',
  });
}

function identify(socket: Socket): SocketIdentity | null {
  const auth = socket.handshake.auth as { token?: unknown; trackingToken?: unknown };
  try {
    if (typeof auth.token === 'string') {
      const p = jwt.verify(auth.token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as {
        sub: string;
        role: UserRole;
        scope?: string;
      };
      if (p.scope) return null;
      return { kind: 'user', userId: p.sub, role: p.role };
    }
    if (typeof auth.trackingToken === 'string') {
      const p = jwt.verify(auth.trackingToken, env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
      }) as { scope?: string; apt?: string };
      if (p.scope === 'tracking' && p.apt) return { kind: 'tracking', appointmentId: p.apt };
    }
  } catch {
    return null;
  }
  return null;
}

export type SocketAccess = {
  appointment: (userId: string, role: UserRole, id: string) => Promise<boolean>;
  /** « staff » : voit aussi les notes internes ; null : aucun accès. */
  ticket: (userId: string, role: UserRole, id: string) => Promise<'client' | 'staff' | null>;
  displayName: (userId: string) => Promise<string>;
};

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Temps réel : connexion authentifiée (jeton d'accès ou jeton de suivi), salles
 * `user:<id>`, `staff`, `appointment:<id>` (suivi) et `ticket:<id>` (+ `ticket:<id>:staff`
 * pour les notes internes).
 */
export function initSocket(server: http.Server, access: SocketAccess) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });
  io.use((socket, next) => {
    const identity = identify(socket);
    if (!identity) return next(new Error('UNAUTHORIZED'));
    socket.data.identity = identity;
    next();
  });
  io.on('connection', (socket) => {
    const identity = socket.data.identity as SocketIdentity;
    if (identity.kind === 'user') {
      void socket.join(`user:${identity.userId}`);
      if (identity.role !== 'client') void socket.join('staff');
    } else {
      void socket.join(`appointment:${identity.appointmentId}`);
    }
    socket.on('appointment:join', async (id: unknown, ack?: (ok: boolean) => void) => {
      if (typeof id !== 'string' || !OBJECT_ID.test(id) || identity.kind !== 'user') {
        ack?.(false);
        return;
      }
      const allowed = await access
        .appointment(identity.userId, identity.role, id)
        .catch(() => false);
      if (allowed) void socket.join(`appointment:${id}`);
      ack?.(allowed);
    });
    socket.on('ticket:join', async (id: unknown, ack?: (ok: boolean) => void) => {
      if (typeof id !== 'string' || !OBJECT_ID.test(id) || identity.kind !== 'user') {
        ack?.(false);
        return;
      }
      const level = await access.ticket(identity.userId, identity.role, id).catch(() => null);
      if (level) {
        void socket.join(`ticket:${id}`);
        if (level === 'staff') void socket.join(`ticket:${id}:staff`);
        socket.data.name ??= await access.displayName(identity.userId).catch(() => '');
      }
      ack?.(Boolean(level));
    });
    // « En train d'écrire » : relayé aux autres participants déjà dans la salle.
    socket.on('ticket:typing', (id: unknown) => {
      if (typeof id !== 'string' || identity.kind !== 'user' || !socket.rooms.has(`ticket:${id}`)) {
        return;
      }
      socket.to(`ticket:${id}`).emit('ticket:typing', {
        ticketId: id,
        userId: identity.userId,
        name: socket.data.name as string,
      });
    });
  });
  logger.info('Temps réel (Socket.io) prêt');
  return io;
}

export function emitTo(rooms: string[], event: string, payload: unknown) {
  if (!io || rooms.length === 0) return;
  io.to(rooms).emit(event, payload);
}

export async function closeSocket() {
  await io?.close();
  io = null;
}
