import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiGrid({
  children,
  className,
  cols = 4,
}: {
  children: React.ReactNode;
  className?: string;
  /** Desktop column count preference */
  cols?: 3 | 4 | 5;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5 sm:gap-3",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "xl:grid-cols-4",
        cols === 5 && "xl:grid-cols-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
  className,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  trend?: number;
  tone?: "default" | "warn" | "success" | "accent";
  className?: string;
}) {
  const tones = {
    default: "border-border",
    warn: "border-amber-500/35",
    success: "border-emerald-500/35",
    accent: "border-accent/35",
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm sm:p-3.5",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)]",
        "dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_6px_16px_rgba(0,0,0,0.28)]",
        tones[tone],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
            {title}
          </p>
          <p className="mt-1 truncate font-figure text-lg font-semibold leading-tight text-foreground sm:mt-1.5 sm:text-xl">
            {value}
          </p>
          {hint && (
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
              {hint}
            </p>
          )}
          {typeof trend === "number" && (
            <p
              className={cn(
                "mt-1 text-[11px] font-medium sm:mt-1.5 sm:text-xs",
                trend >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}% vs prior
            </p>
          )}
        </div>
        <div className="shrink-0 rounded-lg bg-muted/80 p-1.5 text-muted-foreground sm:p-2">
          <Icon className="size-3.5 sm:size-4" />
        </div>
      </div>
    </div>
  );
}
