import type { TicketDetailDto, TicketMessageDto } from '@kodav/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '~/lib/queryClient';
import type { TypingEvent, TicketMessageEvent } from '~/lib/realtime';
import { useAuthStore } from '~/stores/auth';
import { SlaIndicator } from './TicketBadges';
import { TicketConversation } from './TicketConversation';
import '~/lib/i18n';

const live: {
  onMessage?: (e: TicketMessageEvent) => void;
  onTyping?: (e: TypingEvent) => void;
} = {};
vi.mock('~/lib/realtime', () => ({
  useTicketLive: (_id: string, h: typeof live) => Object.assign(live, h),
  useTypingSignal: () => () => undefined,
}));

const message = (
  id: string,
  authorId: string,
  body: string,
  extra: Partial<TicketMessageDto> = {},
): TicketMessageDto => ({
  id,
  author: {
    id: authorId,
    name: authorId === 'u1' ? 'Awa Koné' : 'Koffi Test',
    role: authorId === 'u1' ? 'client' : 'technicien',
  },
  body,
  isInternal: false,
  attachments: [],
  createdAt: '2026-11-10T10:00:00.000Z',
  ...extra,
});

const ticket: TicketDetailDto = {
  id: 't1',
  reference: 'TCK-2026-0001',
  subject: 'Imprimante bloquée',
  category: 'materiel',
  priority: 'haute',
  status: 'en_cours',
  statusHistory: [],
  client: null,
  asset: null,
  assignee: null,
  slaDueAt: '2026-11-12T10:00:00.000Z',
  slaHours: 48,
  firstResponseAt: null,
  resolvedAt: null,
  satisfaction: null,
  lastMessageAt: '2026-11-10T10:00:00.000Z',
  unread: 0,
  createdAt: '2026-11-10T10:00:00.000Z',
  messages: [message('m1', 'u1', 'Elle n’imprime plus.')],
};

function renderConversation(staff: boolean) {
  const client = createQueryClient();
  client.setQueryData(['t'], ticket);
  const Wrapper = () => {
    const data = client.getQueryData<TicketDetailDto>(['t'])!;
    return <TicketConversation ticket={data} queryKey={['t']} staff={staff} />;
  };
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Wrapper />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, view, Wrapper };
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'jeton',
    user: { id: 'u1' } as never,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SlaIndicator', () => {
  const base = {
    slaHours: 48,
    resolvedAt: null,
    status: 'en_cours' as const,
    createdAt: '2026-11-10T08:00:00.000Z',
  };
  it('passe du vert à l’orange puis au rouge, et indique si le délai est tenu', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T09:00:00.000Z'));
    const { rerender } = render(
      <SlaIndicator ticket={{ ...base, slaDueAt: '2026-11-12T08:00:00.000Z' }} />,
    );
    expect(screen.getByText(/47 h restantes/)).toHaveClass('text-success');
    // 15 min restantes sur 75 : moins d'un quart du délai.
    rerender(<SlaIndicator ticket={{ ...base, slaDueAt: '2026-11-10T09:15:00.000Z' }} />);
    expect(screen.getByText(/moins d’1 h restantes/)).toHaveClass('text-warning');
    rerender(<SlaIndicator ticket={{ ...base, slaDueAt: '2026-11-10T06:00:00.000Z' }} />);
    expect(screen.getByText(/Délai dépassé de 3 h/)).toHaveClass('text-danger');
    rerender(
      <SlaIndicator
        ticket={{
          ...base,
          status: 'resolu',
          resolvedAt: '2026-11-10T09:30:00.000Z',
          slaDueAt: '2026-11-11T08:00:00.000Z',
        }}
      />,
    );
    expect(screen.getByText('Délai cible tenu')).toBeInTheDocument();
  });
});

describe('TicketConversation', () => {
  it('réserve les notes internes à l’équipe', () => {
    renderConversation(false);
    expect(screen.queryByLabelText('Note interne')).not.toBeInTheDocument();
  });

  it('envoie un message, affiche les réponses et la saisie en direct', async () => {
    const posted: FormData[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        posted.push(init.body as FormData);
        return Promise.resolve({
          status: 201,
          json: () =>
            Promise.resolve({
              success: true,
              data: message('m2', 'u1', 'Redémarrée, toujours bloquée.'),
            }),
        });
      }),
    );
    const { client, view, Wrapper } = renderConversation(false);
    fireEvent.change(screen.getByLabelText('Votre message'), {
      target: { value: 'Redémarrée, toujours bloquée.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]!.get('body')).toBe('Redémarrée, toujours bloquée.');
    expect(posted[0]!.get('isInternal')).toBeNull();

    act(() => live.onTyping!({ ticketId: 't1', userId: 'u2', name: 'Koffi' }));
    expect(screen.getByText('Koffi est en train d’écrire…')).toBeInTheDocument();
    act(() =>
      live.onMessage!({ ticketId: 't1', message: message('m3', 'u2', 'Je regarde à distance.') }),
    );
    view.rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Wrapper />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Je regarde à distance.')).toBeInTheDocument();
    expect(screen.queryByText('Koffi est en train d’écrire…')).not.toBeInTheDocument();
    expect(client.getQueryData<TicketDetailDto>(['t'])!.messages.map((m) => m.id)).toEqual([
      'm1',
      'm2',
      'm3',
    ]);
  });
});
