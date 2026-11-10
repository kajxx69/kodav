import { Monitor, Moon, Sun } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { cn } from '~/lib/cn';
import { useThemeStore, type ThemePreference } from '~/stores/theme';

const options: { value: ThemePreference; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'grid size-10 place-items-center rounded-md text-ink hover:bg-surface-sunken',
          className,
        )}
        aria-label={t('theme.label')}
      >
        <Sun className="size-5 dark:hidden" aria-hidden />
        <Moon className="hidden size-5 dark:block" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-40 rounded-md border border-line bg-surface-raised p-1 shadow-md"
        >
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(v) => setPreference(v as ThemePreference)}
          >
            {options.map(({ value, icon: Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-body-sm text-ink outline-none data-[highlighted]:bg-surface-sunken data-[state=checked]:text-label"
              >
                <Icon className="size-4" aria-hidden />
                {t(`theme.${value}`)}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
