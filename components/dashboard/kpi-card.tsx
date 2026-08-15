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
        "grid min-w-0 grid-cols-2 gap-2.5 sm:gap-4",
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
export type KpiFill =
  | "surface"
  | "navy"
  | "navySoft"
  | "coral"
  | "coralSolid"
  | "warn"
  | "success";
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
  if (featured) return "coralSolid";
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
  if (fill === "coralSolid") return "rings";
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
  const inverted = fill === "navy" || fill === "coralSolid";

  const fills: Record<KpiFill, string> = {
    surface: "border-border/80 bg-card",
    navySoft: "border-primary/20 bg-primary/10",
    navy: "border-transparent bg-primary text-primary-foreground",
    coral: "border-accent/25 bg-accent/10",
    coralSolid: "border-transparent bg-accent text-accent-foreground",
    warn: "border-amber-500/25 bg-amber-500/10",
    success: "border-emerald-500/25 bg-emerald-500/10",
  };

  const patternColor: Record<KpiFill, string> = {
    surface: "text-primary/18",
    navySoft: "text-primary/20",
    navy: "text-primary-foreground/20",
    coral: "text-accent/22",
    coralSolid: "text-accent-foreground/22",
    warn: "text-amber-800/18 dark:text-amber-200/20",
    success: "text-emerald-800/18 dark:text-emerald-200/20",
  };

  const iconBox: Record<KpiFill, string> = {
    surface: "bg-muted text-muted-foreground",
    navySoft: "bg-primary/12 text-primary",
    navy: "bg-primary-foreground/15 text-primary-foreground",
    coral: "bg-accent/15 text-accent",
    coralSolid: "bg-accent-foreground/15 text-accent-foreground",
    warn: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    success: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  };

  const muted = inverted ? "text-current/75" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-lg border p-3 shadow-sm sm:p-4",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_16px_rgba(15,23,42,0.05)]",
        "dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_6px_16px_rgba(0,0,0,0.28)]",
        fills[fill],
        featured &&
          "col-span-2 flex min-h-[11.5rem] flex-col py-6 shadow-[0_4px_10px_rgba(15,23,42,0.08),0_14px_32px_rgba(194,65,12,0.22)] xl:col-span-1 dark:shadow-[0_4px_10px_rgba(0,0,0,0.35),0_14px_32px_rgba(0,0,0,0.5)] sm:block sm:min-h-0 sm:py-4 sm:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_16px_rgba(15,23,42,0.05)] sm:dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_6px_16px_rgba(0,0,0,0.28)]",
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
      <Icon
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-2 -right-1 stroke-[1.15]",
          featured ? "size-24 sm:size-16" : "size-16",
          inverted ? "text-current/15" : "text-current opacity-[0.12]"
        )}
      />

      <div
        className={cn(
          "relative z-10 min-w-0",
          featured ? "flex min-h-0 flex-1 flex-col pr-14 sm:block sm:flex-none sm:pr-9" : "pr-9"
        )}
      >
        <p
          className={cn(
            "font-medium tracking-wide",
            featured ? "text-[13px] sm:text-[11px]" : "text-[11px]",
            muted
          )}
        >
          {title}
        </p>
        <div className={cn("min-w-0", featured && "mt-auto pt-8 sm:mt-0 sm:pt-0")}>
          <p
            className={cn(
              "font-figure font-semibold leading-tight tracking-tight break-words [overflow-wrap:anywhere]",
              featured
                ? "mt-1.5 text-[1.65rem] sm:text-[1.75rem]"
                : "mt-1.5 text-[1.05rem] sm:text-[1.35rem]"
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
                  ? "text-current/85"
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
            "absolute right-2.5 top-2.5 z-10 flex shrink-0 items-center justify-center rounded-md",
            featured ? "size-11 sm:size-8" : "size-7 sm:size-8",
            iconBox[fill]
          )}
        >
          <Icon className={featured ? "size-5 sm:size-4" : "size-4"} />
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
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(32)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="9"
              stroke="currentColor"
              strokeWidth="1"
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
          <pattern id={pid} width="11" height="11" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1" fill="currentColor" />
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
          <pattern id={pid} width="14" height="14" patternUnits="userSpaceOnUse">
            <path
              d="M14 0H0V14"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.85"
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
        className="absolute -right-4 -top-5 size-28"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden
      >
        <circle cx="60" cy="60" r="16" fill="currentColor" opacity="0.35" />
        <circle cx="60" cy="60" r="28" stroke="currentColor" strokeWidth="2" />
        <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="60" cy="60" r="58" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  if (kind === "wave") {
    return (
      <svg
        className="absolute inset-x-0 bottom-0 h-[58%]"
        viewBox="0 0 160 70"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 38 C24 22 44 52 70 34 C96 16 118 10 160 28 V70 H0 Z"
          fill="currentColor"
          opacity="0.45"
        />
        <path
          d="M0 38 C24 22 44 52 70 34 C96 16 118 10 160 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg
      className="absolute -bottom-5 -right-4 size-28"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
    >
      <path
        d="M120 120 A92 92 0 0 0 28 120"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M120 120 A92 92 0 0 0 28 120"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M120 120 A64 64 0 0 0 56 120"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M120 120 A36 36 0 0 0 84 120"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
