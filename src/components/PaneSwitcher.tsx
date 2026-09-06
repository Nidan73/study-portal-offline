import React from 'react';
import { LucideIcon } from 'lucide-react';

export type PaneOption<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

/**
 * The small tool switcher used above the two left-hand panes.
 *
 * Deliberately the same shape as the right panel's `panel-tab-*` strip, so the
 * three switchable areas read as one system rather than three inventions.
 */
export function PaneSwitcher<T extends string>({
  idPrefix,
  options,
  value,
  onChange,
  label,
  trailing
}: {
  /** Button ids become `${idPrefix}-${option.id}`, for tests and shortcuts. */
  idPrefix: string;
  options: ReadonlyArray<PaneOption<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-1.5 px-0.5">
      <div
        role="tablist"
        aria-label={label}
        className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-xl overflow-x-auto no-scrollbar min-w-0"
      >
        {options.map(({ id, label: optionLabel, icon: Icon }) => {
          const isActive = value === id;
          return (
            <button
              key={id}
              id={`${idPrefix}-${id}`}
              role="tab"
              aria-selected={isActive}
              title={optionLabel}
              aria-label={optionLabel}
              onClick={() => onChange(id)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 ease-fluid ${
                isActive
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
              <span className="hidden min-[1500px]:inline">{optionLabel}</span>
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}
