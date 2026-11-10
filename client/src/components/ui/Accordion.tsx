import { ChevronDown } from 'lucide-react';
import { Accordion as RadixAccordion } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

export function Accordion({
  items,
  className,
}: {
  items: { id: string; title: string; content: ReactNode }[];
  className?: string;
}) {
  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      className={cn(
        'divide-y divide-line rounded-lg border border-line bg-surface-raised',
        className,
      )}
    >
      {items.map((item) => (
        <RadixAccordion.Item key={item.id} value={item.id}>
          <RadixAccordion.Header asChild>
            <h3>
              <RadixAccordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-label text-ink hover:bg-surface-sunken/60 sm:text-body sm:font-semibold">
                {item.title}
                <ChevronDown
                  className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </RadixAccordion.Trigger>
            </h3>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="overflow-hidden px-5 text-body-sm text-ink-muted data-[state=closed]:animate-[accordion-up_200ms_ease-out] data-[state=open]:animate-[accordion-down_200ms_ease-out]">
            <div className="pb-4">{item.content}</div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
