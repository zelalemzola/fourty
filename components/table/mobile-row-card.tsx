"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailField = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

/** Mobile list card with explicit column labels + optional click for details. */
export function MobileRowCard({
  fields,
  onClick,
  actions,
  className,
  eyebrow,
}: {
  fields: DetailField[];
  onClick?: () => void;
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
}) {
  const clickable = Boolean(onClick);

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
        className="space-y-2.5"
      >
        {eyebrow && <div className="text-xs text-muted-foreground">{eyebrow}</div>}

        {/* Column legend */}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border/50 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {fields.map((f) => (
            <span key={f.label}>{f.label}</span>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {fields.map((f) => (
            <div
              key={f.label}
              className={cn(f.fullWidth && "col-span-2")}
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {f.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
                {f.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {actions && (
        <div
          className="mt-2.5 flex justify-end border-t border-border/50 pt-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </li>
  );
}
