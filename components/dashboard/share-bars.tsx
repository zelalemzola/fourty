import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";

export type ShareBarItem = {
  name: string;
  value: number;
  color?: string;
};

export function ShareBars({
  items,
  format = "currency",
  empty = "No data",
  className,
}: {
  items: ShareBarItem[];
  format?: "currency" | "number" | "percent";
  empty?: string;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  if (!items.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }

  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((item, i) => {
        const pct = Math.max(0, Math.min(100, (item.value / total) * 100));
        const color =
          item.color ||
          (i === 0 ? "var(--accent)" : "var(--primary)");
        const display =
          format === "currency"
            ? formatCurrency(item.value)
            : format === "percent"
              ? `${item.value.toFixed(0)}%`
              : formatNumber(item.value);
        return (
          <li key={item.name} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="shrink-0 font-figure text-sm tabular-nums text-muted-foreground">
                {display}
                <span className="ml-1.5 text-[11px]">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
