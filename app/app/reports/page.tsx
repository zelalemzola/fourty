"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  ExternalLink,
  Eye,
  FileBarChart2,
  Hash,
  Package,
  ShoppingBag,
  Store,
  Wallet,
  ImageIcon,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { Sale } from "@/types/database";
import {
  useGetDashboardStatsQuery,
  useGetSalesQuery,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { GlobalFilters } from "@/components/filters/global-filters";
import { DataTableToolbar } from "@/components/table/data-table-toolbar";
import { MobileRowCard } from "@/components/table/mobile-row-card";
import {
  RowDetailsDialog,
  rowClickProps,
} from "@/components/table/row-details-dialog";
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProofThumb,
  ProofViewer,
} from "@/components/proof/proof-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { chartColors } from "@/lib/chart-theme";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";
import { cn } from "@/lib/utils";

const trendConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const storeConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const brandConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const sellerConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const proofConfig = {
  value: { label: "With proof", color: chartColors.coral },
} satisfies ChartConfig;

const channelConfig = {
  Store: { label: "Store", color: chartColors.navy },
  Subagent: { label: "Subagent", color: chartColors.coral },
} satisfies ChartConfig;

const CHANNEL_COLORS = [chartColors.navy, chartColors.coral];

/** Keeps pie / radial charts square and inside the card on narrow phones. */
function RoundChartFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full", className)}>
      <div className="relative mx-auto aspect-square w-full max-w-[11.5rem] overflow-hidden sm:max-w-[13.75rem]">
        {children}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { storeFilter, dateFilter } = useSelector((s: RootState) => s.ui);
  const [detailsSale, setDetailsSale] = useState<Sale | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [salesSearch, setSalesSearch] = useState("");

  const isOwner = profile?.role === "owner";
  const isStorekeeper = profile?.role === "storekeeper";
  const canView = isOwner || isStorekeeper;

  const effectiveStoreId = isStorekeeper
    ? profile?.store_id || undefined
    : storeFilter;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery(
    { storeId: effectiveStoreId, dateFilter },
    { skip: !canView }
  );
  const { data: sales = [], isLoading: salesLoading } = useGetSalesQuery(
    { storeId: effectiveStoreId, dateFilter },
    { skip: !canView }
  );

  const isLoading = statsLoading || salesLoading;

  const channelMix = useMemo(() => {
    const storeRev = sales
      .filter((s) => s.channel === "store")
      .reduce((a, s) => a + Number(s.total_amount), 0);
    const subRev = sales
      .filter((s) => s.channel === "subagent")
      .reduce((a, s) => a + Number(s.total_amount), 0);
    return [
      { name: "Store", value: storeRev },
      { name: "Subagent", value: subRev },
    ].filter((r) => r.value > 0);
  }, [sales]);

  const topSellers = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cartons: number }>();
    for (const s of sales) {
      const name =
        s.seller?.full_name || s.subagent?.full_name || "Unknown";
      const cur = map.get(name) || { name, revenue: 0, cartons: 0 };
      cur.revenue += Number(s.total_amount);
      cur.cartons += s.quantity;
      map.set(name, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [sales]);

  const storeRows = stats?.storeBreakdown || [];
  const storePager = usePagination(storeRows, 10);

  const filteredSales = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const hay = [
        s.brands?.name || "",
        s.stores?.name || "",
        s.seller?.full_name || "",
        s.subagent?.full_name || "",
        s.channel || "",
        s.notes || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sales, salesSearch]);

  const salesPager = usePagination(filteredSales, 10);

  const screenshots = useMemo(
    () =>
      sales.filter((s) => s.screenshot_url).slice(0, 48),
    [sales]
  );

  const salesKpis = useMemo(() => {
    const revenue = sales.reduce((a, s) => a + Number(s.total_amount), 0);
    const cartons = sales.reduce((a, s) => a + s.quantity, 0);
    const withProof = sales.filter((s) => s.screenshot_url).length;
    const avgTicket = sales.length ? revenue / sales.length : 0;
    const avgCartonPrice = cartons ? revenue / cartons : 0;
    const proofPct = sales.length
      ? Math.round((withProof / sales.length) * 100)
      : 0;
    return { revenue, cartons, withProof, avgTicket, avgCartonPrice, proofPct };
  }, [sales]);

  const proofRadial = useMemo(
    () => [
      {
        name: "Proof",
        value: salesKpis.proofPct,
        fill: chartColors.coral,
      },
    ],
    [salesKpis.proofPct]
  );

  const topSellerChart = useMemo(
    () =>
      topSellers.slice(0, 6).map((s) => ({
        name:
          s.name.length > 12 ? `${s.name.slice(0, 12)}…` : s.name,
        revenue: s.revenue,
        cartons: s.cartons,
      })),
    [topSellers]
  );

  function saleActions(sale: Sale) {
    const actions = [
      {
        label: "Details",
        icon: <Eye className="size-4" />,
        onClick: () => setDetailsSale(sale),
      },
    ];
    if (sale.screenshot_url) {
      actions.unshift({
        label: "View proof",
        icon: <ExternalLink className="size-4" />,
        onClick: () => setProofUrl(sale.screenshot_url),
      });
    }
    return actions;
  }

  async function handleExport() {
    try {
      await exportToExcel(
        [
          {
            metric: "Total revenue",
            value: salesKpis.revenue,
          },
          {
            metric: "Cartons sold",
            value: salesKpis.cartons,
          },
          {
            metric: "Transactions",
            value: sales.length,
          },
          {
            metric: "Avg ticket",
            value: salesKpis.avgTicket,
          },
          {
            metric: "Low stock count",
            value: stats?.lowStockCount ?? 0,
          },
          {
            metric: "Pending batches",
            value: stats?.pendingBatches ?? 0,
          },
          {
            metric: "Inventory value",
            value: stats?.inventoryValue ?? 0,
          },
        ],
        `fourty-report-summary-${new Date().toISOString().slice(0, 10)}`,
        "Summary"
      );

      await exportToExcel(
        sales.map((s) => ({
          date: s.sold_at,
          store: s.stores?.name || "",
          brand: s.brands?.name || "",
          quantity: s.quantity,
          unit_price: Number(s.unit_price),
          total: Number(s.total_amount),
          channel: s.channel,
          seller: s.seller?.full_name || s.subagent?.full_name || "",
          screenshot: s.screenshot_url || "",
          notes: s.notes || "",
        })),
        `fourty-report-sales-${new Date().toISOString().slice(0, 10)}`,
        "Sales"
      );
      toast.success("Report summary and sales exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  if (profile && !canView) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Reports are available to owners and storekeepers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description={
          isOwner
            ? "Company and store performance with daily breakdowns, brand mix, and sale proofs."
            : "Detailed performance for your store over the selected period."
        }
        icon={FileBarChart2}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!sales.length && !stats}
          >
            <Download className="size-4" />
            Export Excel
          </Button>
        }
      />

      <GlobalFilters showStore={isOwner} />

      {isLoading ? (
        <KpiGrid>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[96px] rounded-xl" />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid>
          <KpiCard
            title="Revenue"
            value={formatCurrency(stats?.totalRevenue || salesKpis.revenue)}
            icon={Wallet}
            trend={stats?.revenueChange}
            tone="accent"
          />
          <KpiCard
            title="Cartons sold"
            value={formatNumber(stats?.totalCartonsSold || salesKpis.cartons)}
            icon={Package}
            trend={stats?.salesChange}
          />
          <KpiCard
            title="Transactions"
            value={formatNumber(stats?.totalTransactions || sales.length)}
            icon={Hash}
          />
          <KpiCard
            title="Avg ticket"
            value={formatCurrency(salesKpis.avgTicket)}
            icon={ShoppingBag}
          />
          <KpiCard
            title="Avg / carton"
            value={formatCurrency(salesKpis.avgCartonPrice)}
            icon={TrendingUp}
          />
          <KpiCard
            title="With proof"
            value={formatNumber(salesKpis.withProof)}
            icon={ImageIcon}
            hint={`${salesKpis.proofPct}% of sales`}
          />
          <KpiCard
            title="Inventory value"
            value={formatCurrency(stats?.inventoryValue || 0)}
            icon={Store}
          />
          <KpiCard
            title="Pending batches"
            value={formatNumber(stats?.pendingBatches || 0)}
            icon={Package}
            tone="accent"
          />
        </KpiGrid>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel min-w-0 overflow-hidden p-3 sm:p-4 lg:col-span-3">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">
              Daily breakdown
            </h2>
            <p className="text-xs text-muted-foreground">
              Revenue and cartons by day in the selected period
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full rounded-xl sm:h-[260px]" />
          ) : !(stats?.salesTrend?.length) ? (
            <div className="flex h-[200px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground sm:h-[260px]">
              No daily sales in this period
            </div>
          ) : (
            <>
              <ChartContainer
                config={trendConfig}
                className="!aspect-auto h-[200px] w-full max-w-full sm:h-[260px] sm:aspect-auto"
              >
                <ComposedChart
                  data={stats.salesTrend}
                  margin={{ top: 8, left: 0, right: 2, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="rptRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={chartColors.navy}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={chartColors.navy}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                    tickFormatter={(v) => formatDate(v, "MMM d")}
                  />
                  <YAxis
                    yAxisId="rev"
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="cart"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => formatDate(String(v))}
                      />
                    }
                  />
                  <Area
                    yAxisId="rev"
                    type="monotone"
                    dataKey="revenue"
                    stroke={chartColors.navy}
                    fill="url(#rptRevenue)"
                    strokeWidth={2}
                  />
                  <Bar
                    yAxisId="cart"
                    dataKey="cartons"
                    fill={chartColors.coral}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    yAxisId="cart"
                    type="monotone"
                    dataKey="cartons"
                    stroke={chartColors.coral}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: chartColors.navy }}
                  />
                  Revenue
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: chartColors.coral }}
                  />
                  Cartons
                </span>
              </div>
            </>
          )}
        </div>

        <div className="panel min-w-0 overflow-hidden p-3 sm:p-4 lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Channel mix</h2>
            <p className="text-xs text-muted-foreground">
              Revenue by store vs subagent channel
            </p>
          </div>
          {isLoading ? (
            <RoundChartFrame>
              <Skeleton className="size-full rounded-xl" />
            </RoundChartFrame>
          ) : channelMix.length === 0 ? (
            <RoundChartFrame>
              <div className="flex size-full items-center justify-center rounded-xl bg-muted/40 text-center text-sm text-muted-foreground">
                No channel data
              </div>
            </RoundChartFrame>
          ) : (
            <RoundChartFrame>
              <ChartContainer
                config={channelConfig}
                className="!aspect-auto size-full max-h-none"
                initialDimension={{ width: 200, height: 200 }}
              >
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => formatCurrency(Number(v))}
                      />
                    }
                  />
                  <Pie
                    data={channelMix}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="46%"
                    outerRadius="68%"
                    paddingAngle={3}
                  >
                    {channelMix.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </RoundChartFrame>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {channelMix.map((c, i) => (
              <li key={c.name} className="flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      background: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatCurrency(c.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel min-w-0 overflow-hidden p-3 sm:p-4 lg:col-span-3">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Top sellers</h2>
            <p className="text-xs text-muted-foreground">
              Revenue bars with carton line · navy / coral
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full rounded-xl sm:h-[260px]" />
          ) : topSellerChart.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground sm:h-[260px]">
              No sellers in view
            </div>
          ) : (
            <>
              <ChartContainer
                config={sellerConfig}
                className="!aspect-auto h-[200px] w-full max-w-full sm:h-[260px]"
              >
                <ComposedChart
                  data={topSellerChart}
                  margin={{ top: 8, left: 0, right: 2, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    tickFormatter={(v) =>
                      String(v).length > 8
                        ? `${String(v).slice(0, 8)}…`
                        : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="rev"
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="cart"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    yAxisId="rev"
                    dataKey="revenue"
                    fill={chartColors.navy}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  <Line
                    yAxisId="cart"
                    type="monotone"
                    dataKey="cartons"
                    stroke={chartColors.coral}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartColors.coral }}
                  />
                </ComposedChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: chartColors.navy }}
                  />
                  Revenue
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: chartColors.coral }}
                  />
                  Cartons
                </span>
              </div>
            </>
          )}
        </div>

        <div className="panel min-w-0 overflow-hidden p-3 sm:p-4 lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Proof coverage</h2>
            <p className="text-xs text-muted-foreground">
              Share of sales with screenshot proof
            </p>
          </div>
          {isLoading ? (
            <RoundChartFrame>
              <Skeleton className="size-full rounded-xl" />
            </RoundChartFrame>
          ) : sales.length === 0 ? (
            <RoundChartFrame>
              <div className="flex size-full items-center justify-center rounded-xl bg-muted/40 text-center text-sm text-muted-foreground">
                No sales to score
              </div>
            </RoundChartFrame>
          ) : (
            <RoundChartFrame>
              <ChartContainer
                config={proofConfig}
                className="!aspect-auto size-full max-h-none"
                initialDimension={{ width: 200, height: 200 }}
              >
                <RadialBarChart
                  data={proofRadial}
                  startAngle={90}
                  endAngle={-270}
                  innerRadius="64%"
                  outerRadius="86%"
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <RadialBar
                    dataKey="value"
                    background={{ fill: "var(--muted)" }}
                    cornerRadius={8}
                    fill={chartColors.coral}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => `${Number(v)}%`}
                      />
                    }
                  />
                </RadialBarChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
                <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                  {salesKpis.proofPct}%
                </p>
                <p className="text-center text-[11px] leading-tight text-muted-foreground sm:text-xs">
                  {formatNumber(salesKpis.withProof)} /{" "}
                  {formatNumber(sales.length)}
                </p>
              </div>
            </RoundChartFrame>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">
              Store comparison
            </h2>
            <p className="text-xs text-muted-foreground">
              Revenue across locations
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full rounded-xl sm:h-[280px]" />
          ) : !(stats?.storeBreakdown?.length) ? (
            <div className="flex h-[220px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground sm:h-[280px]">
              No store data
            </div>
          ) : (
            <>
              <ChartContainer
                config={storeConfig}
                className="!aspect-auto h-[220px] w-full max-w-full sm:h-[280px]"
              >
                <BarChart
                  data={stats.storeBreakdown}
                  layout="vertical"
                  margin={{ top: 4, left: 0, right: 8, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={72}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      String(v).length > 10
                        ? `${String(v).slice(0, 10)}…`
                        : String(v)
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="revenue"
                    fill={chartColors.navy}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ChartContainer>
              <div className="mt-3 hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Cartons</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storePager.pageItems.map((row) => {
                      const total = stats.totalRevenue || 1;
                      return (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.cartons)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {((row.revenue / total) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <TablePagination
                  page={storePager.page}
                  totalPages={storePager.totalPages}
                  total={storePager.total}
                  from={storePager.from}
                  to={storePager.to}
                  onPageChange={storePager.setPage}
                />
              </div>
            </>
          )}
        </div>

        <div className="panel min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Brand mix</h2>
            <p className="text-xs text-muted-foreground">
              Revenue and cartons by brand
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-[230px] w-full rounded-xl sm:h-[300px]" />
          ) : !(stats?.brandBreakdown?.length) ? (
            <div className="flex h-[230px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground sm:h-[300px]">
              No brand data
            </div>
          ) : (
            <>
              <ChartContainer
                config={brandConfig}
                className="!aspect-auto h-[230px] w-full max-w-full sm:h-[300px]"
              >
                <ComposedChart
                  data={stats.brandBreakdown.slice(0, 8)}
                  margin={{ top: 8, left: 0, right: 2, bottom: 36 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    angle={-28}
                    textAnchor="end"
                    interval={0}
                    height={52}
                    tickMargin={4}
                    tickFormatter={(v) =>
                      String(v).length > 8
                        ? `${String(v).slice(0, 8)}…`
                        : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="rev"
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="cart"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    yAxisId="rev"
                    dataKey="revenue"
                    fill={chartColors.navy}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    yAxisId="cart"
                    type="monotone"
                    dataKey="cartons"
                    stroke={chartColors.coral}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartColors.coral }}
                  />
                </ComposedChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: chartColors.navy }}
                  />
                  Revenue
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: chartColors.coral }}
                  />
                  Cartons
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel p-3 sm:p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Seller leaderboard</h2>
          <p className="text-xs text-muted-foreground">
            Highest revenue contributors in this period
          </p>
        </div>
        {topSellers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sellers in view
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {topSellers.map((s, idx) => (
              <li
                key={s.name}
                className="rounded-xl border border-border/60 bg-background/50 px-3 py-2.5"
              >
                <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                <p className="truncate font-medium">{s.name}</p>
                <p className="mt-1 text-sm">
                  {formatCurrency(s.revenue)}
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatNumber(s.cartons)} ctns
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              Sale screenshots
            </h2>
            <p className="text-xs text-muted-foreground">
              Proof gallery for the filtered period ·{" "}
              {formatNumber(screenshots.length)} shown
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/app/sales" />}>
            All sales
          </Button>
        </div>
        {screenshots.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No screenshots in this period.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {screenshots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setProofUrl(s.screenshot_url)}
                className="group overflow-hidden rounded-xl border border-border/60 bg-background/50 text-left transition hover:ring-2 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.screenshot_url!}
                  alt={`Sale proof ${s.brands?.name || ""}`}
                  className="aspect-square w-full object-cover transition group-hover:scale-[1.03]"
                />
                <div className="space-y-0.5 p-2">
                  <p className="truncate text-xs font-medium">
                    {s.brands?.name || "—"}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {formatCurrency(Number(s.total_amount))} ·{" "}
                    {formatDateTime(s.sold_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel space-y-3 p-3 sm:p-4">
        <div>
          <h2 className="text-sm font-semibold">
            Transaction detail
          </h2>
          <p className="text-xs text-muted-foreground">
            Full sales list for export and audit
          </p>
        </div>
        <DataTableToolbar
          search={salesSearch}
          onSearchChange={setSalesSearch}
          searchPlaceholder="Search brand, store, seller…"
        />
        {filteredSales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sales match these filters.
          </p>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesPager.pageItems.map((s) => (
                    <TableRow
                      key={s.id}
                      {...rowClickProps(() => setDetailsSale(s))}
                    >
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(s.sold_at)}
                      </TableCell>
                      <TableCell>{s.stores?.name || "—"}</TableCell>
                      <TableCell className="font-medium">
                        {s.brands?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(s.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(s.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.channel === "subagent" ? "secondary" : "outline"
                          }
                        >
                          {s.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.seller?.full_name || s.subagent?.full_name || "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {s.screenshot_url ? (
                          <ProofThumb
                            url={s.screenshot_url}
                            alt="Sale proof"
                            className="size-9"
                            onPreview={setProofUrl}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={saleActions(s)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-2 lg:hidden">
              {salesPager.pageItems.map((s) => (
                <MobileRowCard
                  key={s.id}
                  onClick={() => setDetailsSale(s)}
                  fields={[
                    { label: "Brand", value: s.brands?.name || "—" },
                    {
                      label: "Amount",
                      value: formatCurrency(Number(s.total_amount)),
                    },
                    {
                      label: "Channel",
                      value: (
                        <Badge
                          variant={
                            s.channel === "subagent" ? "secondary" : "outline"
                          }
                        >
                          {s.channel}
                        </Badge>
                      ),
                    },
                    {
                      label: "Date",
                      value: formatDateTime(s.sold_at),
                    },
                  ]}
                  actions={<RowActions actions={saleActions(s)} />}
                />
              ))}
            </ul>
            <TablePagination
              page={salesPager.page}
              totalPages={salesPager.totalPages}
              total={salesPager.total}
              from={salesPager.from}
              to={salesPager.to}
              onPageChange={salesPager.setPage}
            />
          </>
        )}
      </div>

      <RowDetailsDialog
        open={!!detailsSale}
        onOpenChange={(open) => !open && setDetailsSale(null)}
        title="Sale details"
        description={
          detailsSale
            ? `${detailsSale.brands?.name || "Sale"} · ${formatDateTime(detailsSale.sold_at)}`
            : undefined
        }
        fields={
          detailsSale
            ? [
                { label: "Brand", value: detailsSale.brands?.name || "—" },
                { label: "Store", value: detailsSale.stores?.name || "—" },
                { label: "Qty", value: formatNumber(detailsSale.quantity) },
                {
                  label: "Amount",
                  value: formatCurrency(Number(detailsSale.total_amount)),
                },
                {
                  label: "Channel",
                  value: (
                    <span className="capitalize">{detailsSale.channel}</span>
                  ),
                },
                {
                  label: "Seller",
                  value:
                    detailsSale.seller?.full_name ||
                    detailsSale.subagent?.full_name ||
                    "—",
                },
                {
                  label: "Date",
                  value: formatDateTime(detailsSale.sold_at),
                },
                ...(detailsSale.notes
                  ? [
                      {
                        label: "Notes",
                        value: detailsSale.notes,
                        fullWidth: true,
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <ProofViewer
        url={proofUrl}
        open={!!proofUrl}
        onOpenChange={(open) => !open && setProofUrl(null)}
        title="Sale proof"
      />
    </div>
  );
}
