"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailField = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

/** Mobile list card — title + trailing value, then labeled fields. */
export function MobileRowCard({
  fields,
  onClick,
  actions,
  className,
  eyebrow,
  title,
  trailing,
}: {
  fields: DetailField[];
  onClick?: () => void;
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  trailing?: ReactNode;
}) {
  const clickable = Boolean(onClick);
  const heading = title ?? fields[0]?.value;
  const rest = title ? fields : fields.slice(1);

  return (
    <li
      className={cn(
        "mobile-card",
        clickable &&
          "cursor-pointer transition hover:border-accent/40 hover:bg-accent/5 active:scale-[0.995]",
        className
      )}
    >
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (!onClick) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="space-y-3"
      >
        {eyebrow && (
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] font-semibold leading-snug">
            {heading ?? "—"}
          </p>
          {trailing != null && (
            <p className="shrink-0 font-figure text-sm font-semibold tabular-nums">
              {trailing}
            </p>
          )}
        </div>

        {rest.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {rest.map((f) => (
              <div key={f.label} className={cn(f.fullWidth && "col-span-2")}>
                <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {f.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {actions && (
        <div
          className="mt-3 flex justify-end border-t border-border/60 pt-2.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </li>
  );
}
