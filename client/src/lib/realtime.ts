import type {
  AppointmentStatus,
  NotificationDto,
  TicketMessageDto,
  TicketStatus,
} from '@kodav/shared';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '~/stores/auth';
import { API_URL } from './api';

export type AppointmentEvent = {
  id: string;
  reference: string;
  status: AppointmentStatus;
  at: string;
  technicianFirstName: string | null;
};
export type TicketMessageEvent = { ticketId: string; message: TicketMessageDto };
export type TicketUpdatedEvent = {
  id: string;
  status: TicketStatus;
  priority: string;
  assignee: string | null;
};
export type TypingEvent = { ticketId: string; userId: string; name: string };

const ORIGIN = new URL(API_URL).origin;

function open(auth: Record<string, string>) {
  return io(ORIGIN, {
    path: '/socket.io',
    auth,
    withCredentials: true,
    // Réseau mobile instable : reconnexion automatique, sans abandon.
    reconnectionDelayMax: 10_000,
  });
}

/**
 * Une seule connexion par session : partagée par la cloche, les tickets et les
 * interventions. Les salles rejointes sont rejouées à chaque reconnexion.
 */
let shared: { token: string; socket: Socket; rooms: Map<string, number> } | null = null;

function userSocket(token: string) {
  if (shared?.token !== token) {
    const rooms = shared?.rooms ?? new Map<string, number>();
    shared?.socket.disconnect();
    const socket = open({ token });
    socket.on('connect', () => {
      for (const room of rooms.keys()) {
        const [kind, id] = room.split(':');
        socket.emit(`${kind}:join`, id);
      }
    });
    shared = { token, socket, rooms };
  }
  return shared.socket;
}

function joinRoom(socket: Socket, kind: 'ticket' | 'appointment', id: string) {
  const key = `${kind}:${id}`;
  const rooms = shared!.rooms;
  rooms.set(key, (rooms.get(key) ?? 0) + 1);
  if (socket.connected) socket.emit(`${kind}:join`, id);
  return () => {
    const n = (rooms.get(key) ?? 1) - 1;
    if (n <= 0) rooms.delete(key);
    else rooms.set(key, n);
  };
}

type Room = { kind: 'ticket' | 'appointment'; id: string | null | undefined };

/** Abonnement à un événement de la connexion de l'utilisateur ; `room` rejoint une salle. */
function useUserEvent<T>(event: string, onEvent: (payload: T) => void, room?: Room) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const roomKind = room?.kind;
  const roomId = room?.id;
  const needsRoom = Boolean(room);
  useEffect(() => {
    if (!accessToken || (needsRoom && !roomId)) return;
    const socket = userSocket(accessToken);
    const listener = (payload: T) => handler.current(payload);
    socket.on(event, listener);
    const leave = roomKind && roomId ? joinRoom(socket, roomKind, roomId) : undefined;
    return () => {
      socket.off(event, listener);
      leave?.();
    };
  }, [accessToken, event, roomKind, roomId, needsRoom]);
}

/**
 * Écoute en direct d'une intervention : session de l'utilisateur connecté, ou jeton de
 * suivi en lecture seule (page publique /suivi).
 */
export function useAppointmentLive(
  appointmentId: string | null | undefined,
  onEvent: (event: AppointmentEvent) => void,
  trackingToken?: string,
) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useUserEvent<AppointmentEvent>(
    'appointment:status',
    (e) => {
      if (!trackingToken && e.id === appointmentId) handler.current(e);
    },
    { kind: 'appointment', id: trackingToken ? null : appointmentId },
  );
  // Suivi public : connexion dédiée, la salle ne contient que cette intervention.
  useEffect(() => {
    if (!trackingToken || !appointmentId) return;
    const socket = open({ trackingToken });
    socket.on('appointment:status', (e: AppointmentEvent) => handler.current(e));
    return () => {
      socket.disconnect();
    };
  }, [appointmentId, trackingToken]);
}

/** Flux de l'équipe (techniciens, admins) : tout changement d'intervention. */
export function useStaffLive(onEvent: (event: AppointmentEvent) => void) {
  useUserEvent('appointment:status', onEvent);
}

export function useNotificationsLive(onEvent: (n: NotificationDto) => void) {
  useUserEvent('notification:new', onEvent);
}

export function useTicketsLive(onEvent: (e: TicketUpdatedEvent) => void) {
  useUserEvent('ticket:updated', onEvent);
}

/** Conversation d'un ticket : messages, changements et indicateur de saisie. */
export function useTicketLive(
  ticketId: string,
  handlers: {
    onMessage: (e: TicketMessageEvent) => void;
    onUpdated: (e: TicketUpdatedEvent) => void;
    onTyping: (e: TypingEvent) => void;
  },
) {
  useUserEvent<TicketMessageEvent>(
    'ticket:message',
    (e) => {
      if (e.ticketId === ticketId) handlers.onMessage(e);
    },
    { kind: 'ticket', id: ticketId },
  );
  useUserEvent<TicketUpdatedEvent>('ticket:updated', (e) => {
    if (e.id === ticketId) handlers.onUpdated(e);
  });
  useUserEvent<TypingEvent>('ticket:typing', (e) => {
    if (e.ticketId === ticketId) handlers.onTyping(e);
  });
}

/** Signale la saisie, au plus une fois toutes les 2 secondes. */
export function useTypingSignal(ticketId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const last = useRef(0);
  return () => {
    if (!accessToken || Date.now() - last.current < 2000) return;
    last.current = Date.now();
    userSocket(accessToken).emit('ticket:typing', ticketId);
  };
}

/** Déconnexion : la connexion partagée est fermée. */
export function closeRealtime() {
  shared?.socket.disconnect();
  shared = null;
}
