import type { AppointmentStatus } from '@kodav/shared';
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
 * Écoute en direct d'une intervention : session de l'utilisateur connecté, ou jeton de
 * suivi en lecture seule (page publique /suivi). Le rappel reçoit chaque changement.
 */
export function useAppointmentLive(
  appointmentId: string | null | undefined,
  onEvent: (event: AppointmentEvent) => void,
  trackingToken?: string,
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!appointmentId) return;
    const auth: Record<string, string> | null = trackingToken
      ? { trackingToken }
      : accessToken
        ? { token: accessToken }
        : null;
    if (!auth) return;
    const socket: Socket = open(auth);
    socket.on('connect', () => {
      if (!trackingToken) socket.emit('appointment:join', appointmentId);
    });
    socket.on('appointment:status', (event: AppointmentEvent) => {
      // Avec un jeton de suivi, la salle ne contient que cette intervention.
      if (trackingToken || event.id === appointmentId) handler.current(event);
    });
    return () => {
      socket.disconnect();
    };
  }, [appointmentId, trackingToken, accessToken]);
}

/** Flux de l'équipe (techniciens, admins) : tout changement d'intervention. */
export function useStaffLive(onEvent: (event: AppointmentEvent) => void) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!accessToken) return;
    const socket = open({ token: accessToken });
    socket.on('appointment:status', (event: AppointmentEvent) => handler.current(event));
    return () => {
      socket.disconnect();
    };
  }, [accessToken]);
}
