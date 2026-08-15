import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex flex-col gap-3 sm:mb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-sm sm:flex">
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 hidden max-w-2xl text-sm leading-snug text-muted-foreground sm:block">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
