/** Shared chart palette — navy primary + coral accent */
export const chartColors = {
  navy: "var(--primary)",
  coral: "var(--accent)",
  muted: "var(--muted-foreground)",
  softNavy: "color-mix(in oklab, var(--primary) 55%, white)",
  softCoral: "color-mix(in oklab, var(--accent) 70%, white)",
} as const;

export const dualSeriesConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
  store: { label: "Store", color: chartColors.navy },
  subagent: { label: "Subagent", color: chartColors.coral },
  quantity: { label: "Stock", color: chartColors.navy },
  min_stock: { label: "Min", color: chartColors.coral },
  confirmed: { label: "Confirmed", color: chartColors.navy },
  pending: { label: "Pending", color: chartColors.coral },
} as const;
