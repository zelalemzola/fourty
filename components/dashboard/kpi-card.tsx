"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

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
        "grid grid-cols-2 gap-3 sm:gap-4",
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

type KpiTone = "default" | "warn" | "success" | "accent";
export type KpiFill = "surface" | "navy" | "navySoft" | "coral" | "warn" | "success";
type KpiPattern = "hatch" | "dots" | "rings" | "grid" | "wave" | "arcs";

const PATTERNS: KpiPattern[] = [
  "hatch",
  "dots",
  "rings",
  "grid",
  "wave",
  "arcs",
];

function hashKey(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function resolveFill(
  tone: KpiTone,
  featured: boolean,
  title: string,
  fill?: KpiFill
): KpiFill {
  if (featured) return "navy";
  if (fill) return fill;
  if (tone === "accent") return "coral";
  if (tone === "warn") return "warn";
  if (tone === "success") return "success";
  return hashKey(title) % 3 === 0 ? "navySoft" : "surface";
}

function resolvePattern(
  fill: KpiFill,
  title: string
): KpiPattern {
  if (fill === "navy") return "rings";
  if (fill === "coral") return "hatch";
  if (fill === "warn") return "dots";
  if (fill === "success") return "grid";
  return PATTERNS[hashKey(title) % PATTERNS.length];
}

export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
  className,
  featured = false,
  fill: fillProp,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  trend?: number;
  tone?: KpiTone;
  className?: string;
  /** Full-width hero metric on small screens */
  featured?: boolean;
  fill?: KpiFill;
}) {
  const fill = resolveFill(tone, featured, title, fillProp);
  const pattern = resolvePattern(fill, title);
  const inverted = fill === "navy";

  const fills: Record<KpiFill, string> = {
    surface: "border-border/80 bg-card",
    navySoft: "border-primary/20 bg-primary/10",
    navy: "border-transparent bg-primary text-primary-foreground",
    coral: "border-accent/25 bg-accent/10",
    warn: "border-amber-500/25 bg-amber-500/10",
    success: "border-emerald-500/25 bg-emerald-500/10",
  };

  const patternColor: Record<KpiFill, string> = {
    surface: "text-primary/[0.055]",
    navySoft: "text-primary/[0.07]",
    navy: "text-primary-foreground/[0.08]",
    coral: "text-accent/[0.09]",
    warn: "text-amber-800/[0.08] dark:text-amber-200/[0.09]",
    success: "text-emerald-800/[0.08] dark:text-emerald-200/[0.09]",
  };

  const iconBox: Record<KpiFill, string> = {
    surface: "bg-muted text-muted-foreground",
    navySoft: "bg-primary/12 text-primary",
    navy: "bg-primary-foreground/15 text-primary-foreground",
    coral: "bg-accent/15 text-accent",
    warn: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    success: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  };

  const muted = inverted
    ? "text-primary-foreground/75"
    : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 shadow-sm",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_16px_rgba(15,23,42,0.05)]",
        "dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_6px_16px_rgba(0,0,0,0.28)]",
        fills[fill],
        featured && "col-span-2 xl:col-span-1",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          patternColor[fill]
        )}
        aria-hidden
      >
        <KpiArt kind={pattern} />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-medium tracking-wide", muted)}>
            {title}
          </p>
          <p
            className={cn(
              "mt-1.5 truncate font-figure font-semibold leading-none tracking-tight",
              featured ? "text-[1.75rem]" : "text-xl sm:text-[1.35rem]"
            )}
          >
            {value}
          </p>
          {hint && (
            <p className={cn("mt-1.5 line-clamp-2 text-xs", muted)}>{hint}</p>
          )}
          {typeof trend === "number" && (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-0.5 text-xs font-medium",
                inverted
                  ? "text-primary-foreground/85"
                  : trend >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive"
              )}
            >
              {trend >= 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}% vs prior
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            iconBox[fill]
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function KpiArt({ kind }: { kind: KpiPattern }) {
  const rawId = useId().replace(/:/g, "");
  const pid = `kpi-${rawId}`;

  if (kind === "hatch") {
    return (
      <svg className="size-full" aria-hidden>
        <defs>
          <pattern
            id={pid}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="12"
              stroke="currentColor"
              strokeWidth="0.7"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
      </svg>
    );
  }

  if (kind === "dots") {
    return (
      <svg className="size-full" aria-hidden>
        <defs>
          <pattern id={pid} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
      </svg>
    );
  }

  if (kind === "grid") {
    return (
      <svg className="size-full" aria-hidden>
        <defs>
          <pattern id={pid} width="16" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M16 0H0V16"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
      </svg>
    );
  }

  if (kind === "rings") {
    return (
      <svg
        className="absolute -right-5 -top-6 size-24"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden
      >
        <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="60" cy="60" r="34" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="60" cy="60" r="18" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    );
  }

  if (kind === "wave") {
    return (
      <svg
        className="absolute inset-x-0 bottom-0 h-10"
        viewBox="0 0 160 32"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <path
          d="M0 20 C28 8 44 26 72 16 C100 6 124 22 160 12"
          stroke="currentColor"
          strokeWidth="1.15"
        />
      </svg>
    );
  }

  return (
    <svg
      className="absolute -bottom-6 -right-5 size-24"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
    >
      <path
        d="M120 120 A88 88 0 0 0 32 120"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M120 120 A62 62 0 0 0 58 120"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M120 120 A36 36 0 0 0 84 120"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
