import { MAX_ATTACHMENTS, type TicketDetailDto, type TicketMessageDto } from '@kodav/shared';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { FileText, Lock, Paperclip, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, toast } from '~/components/ui';
import { apiRequest, openProtectedFile } from '~/lib/api';
import { cn } from '~/lib/cn';
import { formatDateTime } from '~/lib/format';
import { useTicketLive, useTypingSignal } from '~/lib/realtime';
import { useAuthStore } from '~/stores/auth';

const sizeLabel = (bytes: number) =>
  bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} Mo` : `${Math.ceil(bytes / 1000)} Ko`;

function Message({
  ticketId,
  message,
  mine,
}: {
  ticketId: string;
  message: TicketMessageDto;
  mine: boolean;
}) {
  const staff = message.author.role !== 'client';
  return (
    <li className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3 text-body-sm',
          message.isInternal
            ? 'border border-dashed border-warning bg-warning-soft text-ink'
            : mine
              ? 'bg-slate text-on-band dark:bg-surface-sunken dark:text-ink'
              : 'border border-line bg-surface-raised text-ink',
        )}
      >
        {message.isInternal && (
          <p className="mb-1 flex items-center gap-1 text-caption font-semibold text-warning">
            <Lock className="size-3.5" aria-hidden />
            Note interne, invisible pour le client
          </p>
        )}
        <p className="whitespace-pre-line break-words">{message.body}</p>
        {message.attachments.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() =>
                    openProtectedFile(
                      `/tickets/${ticketId}/messages/${message.id}/attachments/${a.id}`,
                    ).catch((err: Error) =>
                      toast('Pièce jointe indisponible', {
                        description: err.message,
                        variant: 'error',
                      }),
                    )
                  }
                  className="inline-flex items-center gap-1.5 underline underline-offset-2"
                >
                  <FileText className="size-4 shrink-0" aria-hidden />
                  {a.name} <span className="opacity-70">({sizeLabel(a.size)})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="px-1 text-caption text-ink-muted">
        {mine ? 'Vous' : message.author.name}
        {!mine && staff && ' · KODAV'} · {formatDateTime(message.createdAt)}
      </p>
    </li>
  );
}

type ConversationProps = {
  ticket: TicketDetailDto;
  queryKey: QueryKey;
  /** Équipe : notes internes possibles. */
  staff?: boolean;
};

/** Fil de discussion en temps réel : messages, pièces jointes, saisie en cours. */
export function TicketConversation({ ticket, queryKey, staff = false }: ConversationProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [internal, setInternal] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const signalTyping = useTypingSignal(ticket.id);

  const append = (message: TicketMessageDto) =>
    queryClient.setQueryData<TicketDetailDto>(queryKey, (old) =>
      old && !old.messages.some((m) => m.id === message.id)
        ? { ...old, messages: [...old.messages, message], lastMessageAt: message.createdAt }
        : old,
    );

  useTicketLive(ticket.id, {
    onMessage: ({ message }) => {
      append(message);
      setTyping(null);
    },
    onUpdated: () => void queryClient.invalidateQueries({ queryKey }),
    onTyping: ({ userId, name }) => {
      if (userId === user?.id) return;
      setTyping(name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(null), 4000);
    },
  });
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const count = ticket.messages.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('body', body);
      if (internal) form.append('isInternal', 'true');
      for (const f of files) form.append('attachments', f);
      return apiRequest<TicketMessageDto>(`/tickets/${ticket.id}/messages`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess(message) {
      append(message);
      setBody('');
      setFiles([]);
      setInternal(false);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const closed = ticket.status === 'ferme';
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4" aria-label="Conversation" aria-live="polite">
        {ticket.messages.map((m) => (
          <Message key={m.id} ticketId={ticket.id} message={m} mine={m.author.id === user?.id} />
        ))}
        <li ref={endRef} aria-hidden className="h-px" />
      </ol>
      <p className="min-h-5 text-caption text-ink-muted" aria-live="polite">
        {typing ? `${typing} est en train d’écrire…` : ''}
      </p>

      {closed ? (
        <Alert>Ce ticket est fermé. Pour un nouveau problème, ouvrez une nouvelle demande.</Alert>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          {send.isError && <Alert variant="danger">{send.error.message}</Alert>}
          <label htmlFor="ticket-reply" className="sr-only">
            Votre message
          </label>
          <textarea
            id="ticket-reply"
            rows={3}
            maxLength={5000}
            value={body}
            placeholder={internal ? 'Note pour l’équipe…' : 'Écrivez votre message…'}
            onChange={(e) => {
              setBody(e.target.value);
              if (!internal) signalTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) send.mutate();
            }}
            className={cn(
              'w-full resize-y rounded-md border border-field-border bg-surface-raised px-3 py-2 text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              internal && 'border-warning bg-warning-soft',
            )}
          />
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-caption"
                >
                  {f.name} ({sizeLabel(f.size)})
                  <button
                    type="button"
                    aria-label={`Retirer ${f.name}`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="rounded-sm p-0.5 hover:bg-line"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {files.length < MAX_ATTACHMENTS && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-label text-ink-muted hover:bg-surface-sunken hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
                  <Paperclip className="size-4" aria-hidden />
                  Joindre
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      // Copie avant de vider le champ : sa FileList est vidée avec lui.
                      const picked = Array.from(e.target.files ?? []);
                      const tooBig = picked.find((f) => f.size > 5 * 1024 * 1024);
                      if (tooBig)
                        toast('Fichier trop lourd', {
                          description: `${tooBig.name} dépasse 5 Mo.`,
                          variant: 'error',
                        });
                      setFiles(
                        [...files, ...picked.filter((f) => f.size <= 5 * 1024 * 1024)].slice(
                          0,
                          MAX_ATTACHMENTS,
                        ),
                      );
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {staff && (
                <Checkbox
                  label="Note interne"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
              )}
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={!body.trim()}
              loading={send.isPending}
            >
              <Send aria-hidden />
              {internal ? 'Ajouter la note' : 'Envoyer'}
            </Button>
          </div>
          <p className="text-caption text-ink-muted">
            Images JPEG, PNG ou PDF, 5 Mo maximum, {MAX_ATTACHMENTS} fichiers au plus.
          </p>
        </form>
      )}
    </div>
  );
}
