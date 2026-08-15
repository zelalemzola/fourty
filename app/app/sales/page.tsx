"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  ExternalLink,
  Eye,
  Plus,
  ShoppingCart,
  Wallet,
  Package,
  Hash,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { Sale } from "@/types/database";
import {
  useGetSalesQuery,
  useGetBrandsQuery,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { GlobalFilters } from "@/components/filters/global-filters";
import {
  CompactSelect,
  DataTableToolbar,
} from "@/components/table/data-table-toolbar";
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
  ChartLegend,
  ChartLegendContent,
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

const volumeConfig = {
  revenue: { label: "Revenue", color: chartColors.navy },
  cartons: { label: "Cartons", color: chartColors.coral },
} satisfies ChartConfig;

const channelConfig = {
  Store: { label: "Store", color: chartColors.navy },
  Subagent: { label: "Subagent", color: chartColors.coral },
} satisfies ChartConfig;

const CHANNEL_COLORS = [chartColors.navy, chartColors.coral];

export default function SalesPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { storeFilter, dateFilter } = useSelector((s: RootState) => s.ui);
  const [brandId, setBrandId] = useState<string>("all");
  const [channel, setChannel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detailsSale, setDetailsSale] = useState<Sale | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const effectiveStoreId =
    profile?.role === "storekeeper"
      ? profile.store_id || undefined
      : storeFilter;

  const { data: brands = [] } = useGetBrandsQuery();
  const { data: sales = [], isLoading, isFetching } = useGetSalesQuery({
    storeId: effectiveStoreId,
    dateFilter,
    brandId: brandId === "all" ? undefined : brandId,
    channel: channel === "all" ? undefined : channel,
  });

  const kpis = useMemo(() => {
    const revenue = sales.reduce((s, r) => s + Number(r.total_amount), 0);
    const cartons = sales.reduce((s, r) => s + r.quantity, 0);
    return {
      revenue,
      cartons,
      transactions: sales.length,
      avgTicket: sales.length ? revenue / sales.length : 0,
    };
  }, [sales]);

  const dailyVolume = useMemo(() => {
    const map = new Map<
      string,
      { date: string; revenue: number; cartons: number }
    >();
    for (const s of sales) {
      const date = String(s.sold_at).slice(0, 10);
      const cur = map.get(date) || { date, revenue: 0, cartons: 0 };
      cur.revenue += Number(s.total_amount);
      cur.cartons += s.quantity;
      map.set(date, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [sales]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const hay = [
        s.brands?.name || "",
        s.stores?.name || "",
        s.seller?.full_name || "",
        s.subagent?.full_name || "",
        s.notes || "",
        s.channel || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sales, search]);

  const pager = usePagination(filtered, 10);

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
        sales.map((s) => ({
          date: s.sold_at,
          store: s.stores?.name || "",
          brand: s.brands?.name || "",
          quantity: s.quantity,
          unit_price: Number(s.unit_price),
          total: Number(s.total_amount),
          channel: s.channel,
          seller: s.seller?.full_name || s.subagent?.full_name || "",
          notes: s.notes || "",
        })),
        `fourty-sales-${new Date().toISOString().slice(0, 10)}`,
        "Sales"
      );
      toast.success("Sales exported to Excel");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales"
        description="Recorded store and subagent sales with proof screenshots."
        icon={ShoppingCart}
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!sales.length}
              className="hidden sm:inline-flex"
            >
              <Download data-icon="inline-start" />
              Export
            </Button>
            <Button render={<Link href="/app/sales/new" />}>
              <Plus data-icon="inline-start" />
              New sale
            </Button>
          </>
        }
      />

      <GlobalFilters showStore={profile?.role === "owner"}>
        <CompactSelect
          icon={Package}
          label="Brand"
          value={brandId}
          onChange={setBrandId}
          options={[
            { value: "all", label: "All brands" },
            ...brands
              .filter((b) => b.is_active)
              .map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <CompactSelect
          icon={Layers}
          label="Channel"
          value={channel}
          onChange={setChannel}
          options={[
            { value: "all", label: "All channels" },
            { value: "store", label: "Store" },
            { value: "subagent", label: "Subagent" },
          ]}
        />
      </GlobalFilters>

      {isLoading ? (
        <KpiGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[96px] rounded-xl" />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid>
          <KpiCard
            title="Revenue"
            value={formatCurrency(kpis.revenue)}
            icon={Wallet}
            tone="accent"
            featured
            hint={isFetching ? "Refreshing…" : undefined}
          />
          <KpiCard
            title="Cartons"
            value={formatNumber(kpis.cartons)}
            icon={Package}
            fill="navySoft"
          />
          <KpiCard
            title="Transactions"
            value={formatNumber(kpis.transactions)}
            icon={Hash}
          />
          <KpiCard
            title="Avg ticket"
            value={formatCurrency(kpis.avgTicket)}
            icon={ShoppingCart}
            fill="coral"
          />
        </KpiGrid>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel p-4 sm:p-5 lg:col-span-3">
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold sm:text-sm">
              Daily sales volume
            </h2>
            <p className="text-xs text-muted-foreground">
              Revenue trend for the filtered set
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="aspect-[16/10] w-full rounded-lg sm:aspect-video" />
          ) : dailyVolume.length === 0 ? (
            <div className="flex aspect-[16/10] items-center justify-center rounded-lg bg-muted/40 text-sm text-muted-foreground sm:aspect-video">
              No daily volume in view
            </div>
          ) : (
            <ChartContainer
              config={volumeConfig}
              className="aspect-[16/10] w-full sm:aspect-video"
            >
              <ComposedChart data={dailyVolume} margin={{ left: 0, right: 4 }}>
                <defs>
                  <linearGradient id="salesRevFill" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#salesRevFill)"
                  strokeWidth={2}
                />
                <Bar
                  yAxisId="cart"
                  dataKey="cartons"
                  fill={chartColors.coral}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>

        <div className="panel p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold sm:text-sm">
              Channel mix
            </h2>
            <p className="text-xs text-muted-foreground">
              Revenue share by channel
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-lg md:mx-auto md:aspect-square md:max-h-[240px]" />
          ) : channelMix.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No channel data
            </p>
          ) : (
            <>
              <ChartContainer
                config={channelConfig}
                className="mx-auto h-[168px] w-full max-w-[200px] sm:h-[240px] sm:max-h-[240px] sm:max-w-[240px]"
              >
                <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
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
                    cy="46%"
                    innerRadius="52%"
                    outerRadius="78%"
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
              <ul className="mt-2 space-y-1 text-sm">
                {channelMix.map((c, i) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          background: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                        }}
                      />
                      {c.name}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(c.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Sale history</h2>
            <p className="text-xs text-muted-foreground">
              {formatNumber(filtered.length)} records in view
            </p>
          </div>
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search brand, store, seller…"
            className="w-full sm:max-w-md sm:justify-end"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No sales match these filters.
            </p>
            <Button className="mt-4" render={<Link href="/app/sales/new" />}>
              <Plus data-icon="inline-start" />
              Record a sale
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((sale) => (
                    <TableRow
                      key={sale.id}
                      {...rowClickProps(() => setDetailsSale(sale))}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {sale.brands?.name || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sale.stores?.name}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(sale.quantity)}</TableCell>
                      <TableCell>
                        {formatCurrency(Number(sale.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sale.channel === "subagent"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {sale.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sale.seller?.full_name ||
                          sale.subagent?.full_name ||
                          "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {sale.screenshot_url ? (
                          <ProofThumb
                            url={sale.screenshot_url}
                            alt="Sale proof"
                            className="size-9"
                            onPreview={setProofUrl}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(sale.sold_at)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={saleActions(sale)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 lg:hidden">
              {pager.pageItems.map((sale) => (
                <MobileRowCard
                  key={sale.id}
                  onClick={() => setDetailsSale(sale)}
                  title={sale.brands?.name || "—"}
                  trailing={formatCurrency(Number(sale.total_amount))}
                  fields={[
                    {
                      label: "Qty",
                      value: formatNumber(sale.quantity),
                    },
                    {
                      label: "Channel",
                      value: (
                        <Badge
                          variant={
                            sale.channel === "subagent"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {sale.channel}
                        </Badge>
                      ),
                    },
                    {
                      label: "Seller",
                      value:
                        sale.seller?.full_name ||
                        sale.subagent?.full_name ||
                        "—",
                    },
                    {
                      label: "Date",
                      value: formatDateTime(sale.sold_at),
                    },
                  ]}
                  actions={<RowActions actions={saleActions(sale)} />}
                />
              ))}
            </ul>
            <TablePagination
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              from={pager.from}
              to={pager.to}
              onPageChange={pager.setPage}
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
