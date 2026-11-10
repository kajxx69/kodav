import type { ReactNode } from 'react';

/** Carte centrale des pages d'authentification. */
export function AuthCard({
  title,
  lead,
  children,
  footer,
  wide = false,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
      <div className="rounded-lg border border-line bg-surface-raised p-6 shadow-md sm:p-8">
        <h1 className="text-h2">{title}</h1>
        {lead && <p className="mt-2 text-body text-ink-muted">{lead}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-6 text-center text-body-sm text-ink-muted">{footer}</p>}
    </div>
  );
}
