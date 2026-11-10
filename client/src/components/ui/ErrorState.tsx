import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={CloudOff}
      title={message ?? t('states.error')}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {t('states.retry')}
          </Button>
        )
      }
    />
  );
}
