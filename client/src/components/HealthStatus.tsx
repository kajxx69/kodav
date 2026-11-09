import { useEffect, useState } from 'react';
import type { Health } from '@kodav/shared';
import { apiGet } from '~/lib/api';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; health: Health };

export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    apiGet<Health>('/health', { signal: controller.signal })
      .then((res) =>
        setState(res.success ? { kind: 'ready', health: res.data } : { kind: 'error' }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, []);

  if (state.kind === 'loading') return <p role="status">Vérification de l'API…</p>;
  if (state.kind === 'error') return <p role="status">API injoignable.</p>;

  const { health } = state;
  return (
    <p role="status">
      API : {health.status === 'ok' ? 'opérationnelle' : 'dégradée'} · base de données :{' '}
      {health.database === 'connected' ? 'connectée' : 'déconnectée'}
    </p>
  );
}
