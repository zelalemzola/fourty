"use client";

import { useMemo, useState } from "react";
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
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Download,
  LayoutDashboard,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  Boxes,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import { useGetDashboardStatsQuery } from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { GlobalFilters } from "@/components/filters/global-filters";
import { DataTableToolbar } from "@/components/table/data-table-toolbar";
import { MobileRowCard } from "@/components/table/mobile-row-card";
import {
  RowDetailsDialog,
  rowClickProps,
} from "@/components/table/row-details-dialog";
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-card";
import { ShareBars } from "@/components/dashboard/share-bars";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { chartColors } from "@/lib/chart-theme";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";

const trendConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const brandConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const storeRadarConfig = {
  revenue: { label: "Revenue idx", color: chartColors.navy },
  cartons: { label: "Cartons idx", color: chartColors.coral },
} satisfies ChartConfig;

const healthConfig = {
  value: { label: "Health", color: chartColors.coral },
} satisfies ChartConfig;

const pieConfig = {
  store: { label: "Store channel", color: chartColors.navy },
  other: { label: "Share", color: chartColors.coral },
} satisfies ChartConfig;

const CORAL_SHADES = [
  chartColors.coral,
  chartColors.softCoral,
  "color-mix(in oklab, var(--accent) 45%, var(--primary))",
  "color-mix(in oklab, var(--accent) 30%, white)",
  chartColors.navy,
  chartColors.softNavy,
];

export default function DashboardPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { storeFilter, dateFilter } = useSelector((s: RootState) => s.ui);

  const effectiveStoreId =
    profile?.role === "storekeeper"
      ? profile.store_id || undefined
      : storeFilter;

  const { data, isLoading, isFetching } = useGetDashboardStatsQuery({
    storeId: effectiveStoreId,
    dateFilter,
  });

  const trendRows = useMemo(
    () =>
      (data?.salesTrend || []).map((row) => ({
        date: row.date,
        revenue: row.revenue,
        cartons: row.cartons,
      })),
    [data?.salesTrend]
  );

  const brandRows = useMemo(
    () => (data?.brandBreakdown || []).slice(0, 8),
    [data?.brandBreakdown]
  );

  const storeRows = data?.storeBreakdown || [];
  const [storeSearch, setStoreSearch] = useState("");
  const [detailsStore, setDetailsStore] = useState<{
    name: string;
    cartons: number;
    revenue: number;
  } | null>(null);

  const filteredStoreRows = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return storeRows;
    return storeRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [storeRows, storeSearch]);

  const storePager = usePagination(filteredStoreRows, 10);

  const storeRadar = useMemo(() => {
    const maxRev = Math.max(...storeRows.map((s) => s.revenue), 1);
    const maxCart = Math.max(...storeRows.map((s) => s.cartons), 1);
    return storeRows.slice(0, 6).map((s) => ({
      name:
        s.name.length > 14 ? `${s.name.slice(0, 12)}…` : s.name,
      revenue: Math.round((s.revenue / maxRev) * 100),
      cartons: Math.round((s.cartons / maxCart) * 100),
    }));
  }, [storeRows]);

  const stockHealth = useMemo(() => {
    const low = data?.lowStockCount || 0;
    const health = Math.max(0, Math.min(100, 100 - low * 8));
    return [{ name: "Stock health", value: health, fill: chartColors.coral }];
  }, [data?.lowStockCount]);

  const brandDonut = useMemo(
    () =>
      brandRows.slice(0, 5).map((b, i) => ({
        name: b.name,
        value: b.revenue,
        fill: CORAL_SHADES[i % CORAL_SHADES.length],
      })),
    [brandRows]
  );

  async function handleExport() {
    try {
      await exportToExcel(
        trendRows.map((r) => ({
          date: r.date,
          revenue: r.revenue,
          cartons: r.cartons,
        })),
        `fourty-sales-trend-${new Date().toISOString().slice(0, 10)}`,
        "Sales Trend"
      );
      toast.success("Trend exported to Excel");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live sales, stock health, and store performance across Fourty."
        icon={LayoutDashboard}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!trendRows.length}
            className="hidden sm:inline-flex"
          >
            <Download data-icon="inline-start" />
            Export trend
          </Button>
        }
      />

      <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0">
        <GlobalFilters showStore={profile?.role === "owner"} />
      </div>

      {isLoading ? (
        <Skeleton className="h-[108px] rounded-lg sm:hidden" />
      ) : (
        <div className="sm:hidden">
          <KpiCard
            title="Revenue"
            value={formatCurrency(data?.totalRevenue || 0)}
            icon={Wallet}
            trend={data?.revenueChange}
            tone="accent"
            featured
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <Link
          href="/app/sales/new"
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2 py-3 text-center shadow-sm"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Plus className="size-4" />
          </span>
          <span className="text-[11px] font-medium">New sale</span>
        </Link>
        <Link
          href={profile?.role === "subagent" ? "/app/subagents" : "/app/restock"}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2 py-3 text-center shadow-sm"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            {profile?.role === "subagent" ? (
              <Truck className="size-4" />
            ) : (
              <Boxes className="size-4" />
            )}
          </span>
          <span className="text-[11px] font-medium">
            {profile?.role === "subagent" ? "Batches" : "Restock"}
          </span>
        </Link>
        <Link
          href="/app/sales"
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2 py-3 text-center shadow-sm"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingBag className="size-4" />
          </span>
          <span className="text-[11px] font-medium">History</span>
        </Link>
      </div>

      {isLoading ? (
        <KpiGrid>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-lg" />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid>
          <KpiCard
            title="Revenue"
            value={formatCurrency(data?.totalRevenue || 0)}
            icon={Wallet}
            trend={data?.revenueChange}
            tone="accent"
            featured
            className="hidden sm:block xl:col-span-1"
          />
          <KpiCard
            title="Cartons sold"
            value={formatNumber(data?.totalCartonsSold || 0)}
            icon={ShoppingBag}
            trend={data?.salesChange}
            fill="navySoft"
          />
          <KpiCard
            title="Transactions"
            value={formatNumber(data?.totalTransactions || 0)}
            icon={Package}
          />
          <KpiCard
            title="Low stock"
            value={formatNumber(data?.lowStockCount || 0)}
            icon={AlertTriangle}
            tone={(data?.lowStockCount || 0) > 0 ? "warn" : "success"}
            hint="Below minimum"
          />
          <KpiCard
            title="Inventory value"
            value={formatCurrency(data?.inventoryValue || 0)}
            icon={Boxes}
            fill="navySoft"
          />
          <KpiCard
            title="Pending batches"
            value={formatNumber(data?.pendingBatches || 0)}
            icon={Truck}
            tone="accent"
          />
          <KpiCard
            title="Active stores"
            value={formatNumber(data?.activeStores || 0)}
            icon={Store}
          />
          <KpiCard
            title="Active subagents"
            value={formatNumber(data?.activeSubagents || 0)}
            icon={Users}
            fill="coral"
          />
        </KpiGrid>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel p-4 sm:p-5 lg:col-span-3">
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold sm:text-sm">
              Revenue vs cartons
            </h2>
            <p className="text-xs text-muted-foreground">
              Dual-axis trend · navy revenue / coral cartons
              {isFetching ? " · refreshing…" : ""}
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="aspect-[16/10] w-full rounded-lg sm:aspect-video" />
          ) : trendRows.length === 0 ? (
            <div className="flex aspect-[16/10] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground sm:aspect-video">
              No sales in this period
            </div>
          ) : (
            <ChartContainer
              config={trendConfig}
              className="aspect-[16/10] w-full sm:aspect-video"
            >
              <ComposedChart data={trendRows} margin={{ left: 0, right: 4 }}>
                <defs>
                  <linearGradient id="fillRevenueDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.navy} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.navy} stopOpacity={0.02} />
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
                  width={48}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <YAxis
                  yAxisId="cart"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={36}
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
                  fill="url(#fillRevenueDash)"
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
                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>

        <div className="panel p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold sm:text-sm">Brand mix</h2>
            <p className="text-xs text-muted-foreground">
              Revenue share by brand
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : brandDonut.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No brand data
            </p>
          ) : (
            <>
              <ChartContainer
                config={pieConfig}
                className="mx-auto aspect-square max-h-[240px] w-full sm:max-h-[280px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={brandDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    strokeWidth={2}
                    paddingAngle={2}
                  >
                    {brandDonut.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ShareBars
                className="mt-3"
                items={brandDonut.map((b) => ({
                  name: b.name,
                  value: b.value,
                  color: b.fill,
                }))}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="font-heading text-sm font-semibold">
              Brand performance
            </h2>
            <p className="text-xs text-muted-foreground">
              Revenue bars with carton overlay
            </p>
          </div>
          {isLoading || !brandRows.length ? (
            <Skeleton className="h-[240px] w-full rounded-lg" />
          ) : (
            <ChartContainer config={brandConfig} className="h-[240px] w-full">
              <BarChart data={brandRows} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    String(v).length > 8 ? `${String(v).slice(0, 8)}…` : String(v)
                  }
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill={chartColors.navy} radius={[4, 4, 0, 0]} />
                <Bar dataKey="cartons" fill={chartColors.coral} radius={[4, 4, 0, 0]} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="font-heading text-sm font-semibold">
              Store radar
            </h2>
            <p className="text-xs text-muted-foreground">
              Indexed revenue vs cartons
            </p>
          </div>
          {isLoading || storeRadar.length === 0 ? (
            <Skeleton className="h-[240px] w-full rounded-lg" />
          ) : (
            <ChartContainer config={storeRadarConfig} className="h-[240px] w-full">
              <RadarChart data={storeRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Radar
                  dataKey="revenue"
                  stroke={chartColors.navy}
                  fill={chartColors.navy}
                  fillOpacity={0.2}
                />
                <Radar
                  dataKey="cartons"
                  stroke={chartColors.coral}
                  fill={chartColors.coral}
                  fillOpacity={0.25}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </RadarChart>
            </ChartContainer>
          )}
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold sm:text-sm">
              Stock health
            </h2>
            <p className="text-xs text-muted-foreground">
              Based on SKUs under minimum
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="mx-auto h-[200px] w-full rounded-lg sm:h-[240px]" />
          ) : (
            <ChartContainer
              config={healthConfig}
              className="mx-auto h-[200px] w-full sm:h-[240px]"
            >
              <RadialBarChart
                data={stockHealth}
                startAngle={180}
                endAngle={0}
                innerRadius="55%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  dataKey="value"
                  background
                  cornerRadius={8}
                  fill={chartColors.coral}
                />
                <text
                  x="50%"
                  y="58%"
                  textAnchor="middle"
                  className="fill-foreground font-heading text-2xl font-semibold"
                >
                  {stockHealth[0]?.value ?? 0}%
                </text>
              </RadialBarChart>
            </ChartContainer>
          )}
        </div>
      </div>

      <div className="panel space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-heading text-sm font-semibold">By store</h2>
          <p className="text-xs text-muted-foreground">
            Revenue and carton mix across locations
          </p>
        </div>
        <DataTableToolbar
          search={storeSearch}
          onSearchChange={setStoreSearch}
          searchPlaceholder="Search store name…"
        />
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : !filteredStoreRows.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No store sales in this period
          </p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
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
                    const share = data?.totalRevenue
                      ? (row.revenue / data.totalRevenue) * 100
                      : 0;
                    return (
                      <TableRow
                        key={row.name}
                        {...rowClickProps(() => setDetailsStore(row))}
                      >
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right font-figure">
                          {formatNumber(row.cartons)}
                        </TableCell>
                        <TableCell className="text-right font-figure">
                          {formatCurrency(row.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {share.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-2 md:hidden">
              {storePager.pageItems.map((row) => {
                const share = data?.totalRevenue
                  ? (row.revenue / data.totalRevenue) * 100
                  : 0;
                return (
                  <MobileRowCard
                    key={row.name}
                    onClick={() => setDetailsStore(row)}
                    title={row.name}
                    trailing={formatCurrency(row.revenue)}
                    fields={[
                      {
                        label: "Share",
                        value: `${share.toFixed(1)}%`,
                      },
                      {
                        label: "Cartons",
                        value: formatNumber(row.cartons),
                      },
                    ]}
                  />
                );
              })}
            </ul>
            <TablePagination
              page={storePager.page}
              totalPages={storePager.totalPages}
              total={storePager.total}
              from={storePager.from}
              to={storePager.to}
              onPageChange={storePager.setPage}
            />
          </>
        )}
      </div>

      <RowDetailsDialog
        open={!!detailsStore}
        onOpenChange={(open) => !open && setDetailsStore(null)}
        title="Store breakdown"
        description={detailsStore?.name}
        fields={
          detailsStore
            ? [
                { label: "Store", value: detailsStore.name },
                {
                  label: "Cartons",
                  value: formatNumber(detailsStore.cartons),
                },
                {
                  label: "Revenue",
                  value: formatCurrency(detailsStore.revenue),
                },
                {
                  label: "Share",
                  value: data?.totalRevenue
                    ? `${((detailsStore.revenue / data.totalRevenue) * 100).toFixed(1)}%`
                    : "—",
                },
              ]
            : []
        }
      />
    </div>
  );
}
