"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Download,
  Eye,
  PackagePlus,
  Warehouse,
  Boxes,
  Hash,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { Restock } from "@/types/database";
import {
  useCreateRestockMutation,
  useGetRestocksQuery,
  useGetBrandsQuery,
  useGetStoresQuery,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDateTime } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

export default function RestockPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { storeFilter } = useSelector((s: RootState) => s.ui);
  const isOwner = profile?.role === "owner";

  const effectiveStoreId =
    profile?.role === "storekeeper"
      ? profile.store_id || undefined
      : storeFilter;

  const { data: stores = [] } = useGetStoresQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const {
    data: restocks = [],
    isLoading,
    isFetching,
  } = useGetRestocksQuery({
    storeId: effectiveStoreId,
    limit: 150,
  });

  const [storeId, setStoreId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [detailsRestock, setDetailsRestock] = useState<Restock | null>(null);

  const [createRestock, { isLoading: saving }] = useCreateRestockMutation();

  useEffect(() => {
    if (profile?.role === "storekeeper" && profile.store_id) {
      setStoreId(profile.store_id);
    }
  }, [profile?.role, profile?.store_id]);

  const selectedBrand = brands.find((b) => b.id === brandId);

  useEffect(() => {
    if (selectedBrand) setUnitCost(String(selectedBrand.cost_price));
  }, [selectedBrand]);

  const kpis = useMemo(() => {
    const cartons = restocks.reduce((s, r) => s + r.quantity, 0);
    const value = restocks.reduce(
      (s, r) => s + r.quantity * Number(r.unit_cost || 0),
      0
    );
    return {
      cartons,
      value,
      events: restocks.length,
      avgCost: cartons ? value / cartons : 0,
    };
  }, [restocks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restocks;
    return restocks.filter((r) => {
      const hay = [
        r.brands?.name || "",
        r.stores?.name || "",
        r.notes || "",
        r.profiles?.full_name || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [restocks, search]);

  const pager = usePagination(filtered, 10);

  function restockActions(r: Restock) {
    return [
      {
        label: "Details",
        icon: <Eye className="size-4" />,
        onClick: () => setDetailsRestock(r),
      },
    ];
  }

  async function handleExport() {
    try {
      await exportToExcel(
        restocks.map((r) => ({
          date: r.created_at,
          store: r.stores?.name || "",
          brand: r.brands?.name || "",
          quantity: r.quantity,
          unit_cost: Number(r.unit_cost || 0),
          total_cost: r.quantity * Number(r.unit_cost || 0),
          performed_by: r.profiles?.full_name || "",
          notes: r.notes || "",
        })),
        `fourty-restocks-${new Date().toISOString().slice(0, 10)}`,
        "Restocks"
      );
      toast.success("Restocks exported to Excel");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity) || 0;
    const cost = unitCost === "" ? undefined : Number(unitCost);

    if (!storeId || !brandId) {
      toast.error("Store and brand are required");
      return;
    }
    if (qty <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (cost != null && cost < 0) {
      toast.error("Unit cost cannot be negative");
      return;
    }

    try {
      await createRestock({
        store_id: storeId,
        brand_id: brandId,
        quantity: qty,
        unit_cost: cost,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success("Stock replenished");
      setQuantity("1");
      setNotes("");
      if (selectedBrand) setUnitCost(String(selectedBrand.cost_price));
    } catch (err) {
      const message =
        typeof err === "object" &&
        err &&
        "data" in err &&
        typeof (err as { data?: unknown }).data === "string"
          ? (err as { data: string }).data
          : err instanceof Error
            ? err.message
            : "Restock failed";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Restock"
        description="Add cartons to store inventory and review replenishment history."
        icon={Warehouse}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!restocks.length}
          >
            <Download data-icon="inline-start" />
            Export
          </Button>
        }
      />

      <GlobalFilters showStore={isOwner} />

      {isLoading ? (
        <KpiGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[96px] rounded-xl" />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid>
          <KpiCard
            title="Restock value"
            value={formatCurrency(kpis.value)}
            icon={Wallet}
            tone="accent"
            featured
          />
          <KpiCard
            title="Cartons in"
            value={formatNumber(kpis.cartons)}
            icon={Boxes}
            tone="success"
            hint={isFetching ? "Refreshing…" : undefined}
          />
          <KpiCard
            title="Events"
            value={formatNumber(kpis.events)}
            icon={Hash}
            fill="navySoft"
          />
          <KpiCard
            title="Avg unit cost"
            value={formatCurrency(kpis.avgCost)}
            icon={PackagePlus}
            fill="coral"
          />
        </KpiGrid>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <form
          onSubmit={onSubmit}
          className="panel space-y-4 rounded-lg p-4 sm:p-5 lg:col-span-2"
        >
          <div>
            <h2 className="text-sm font-semibold">Add stock</h2>
            <p className="text-xs text-muted-foreground">
              Increases on-hand inventory immediately
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Store</Label>
            {isOwner ? (
              <Select
                value={storeId || undefined}
                onValueChange={(v) => setStoreId(v ?? "")}
              >
                <SelectTrigger className="w-full bg-background/70">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                readOnly
                value={
                  stores.find((s) => s.id === storeId)?.name ||
                  profile?.stores?.name ||
                  "Your store"
                }
                className="bg-muted/50"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Select
              value={brandId || undefined}
              onValueChange={(v) => setBrandId(v ?? "")}
            >
              <SelectTrigger className="w-full bg-background/70">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands
                  .filter((b) => b.is_active)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-background/70"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost">Unit cost</Label>
              <Input
                id="cost"
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="bg-background/70"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="restock-notes">Notes</Label>
            <Textarea
              id="restock-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Supplier, invoice #, etc."
              className="bg-background/70"
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            <PackagePlus data-icon="inline-start" />
            {saving ? "Saving…" : "Restock inventory"}
          </Button>
        </form>

        <div className="panel space-y-3 p-4 lg:col-span-3">
          <div>
            <h2 className="text-sm font-semibold">History</h2>
            <p className="text-xs text-muted-foreground">
              Latest replenishment events for the selected store filter
            </p>
          </div>

          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search brand, store, notes…"
          />

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No restocks yet for this filter.
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead className="text-right">When</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pager.pageItems.map((r) => (
                      <TableRow
                        key={r.id}
                        {...rowClickProps(() => setDetailsRestock(r))}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {r.brands?.name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.stores?.name}
                          </div>
                        </TableCell>
                        <TableCell>{formatNumber(r.quantity)}</TableCell>
                        <TableCell>
                          {formatCurrency(Number(r.unit_cost || 0))}
                        </TableCell>
                        <TableCell>
                          {r.profiles?.full_name || "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDateTime(r.created_at)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RowActions actions={restockActions(r)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="space-y-3 md:hidden">
                {pager.pageItems.map((r) => (
                  <MobileRowCard
                    key={r.id}
                    onClick={() => setDetailsRestock(r)}
                    title={r.brands?.name || "—"}
                    trailing={`+${formatNumber(r.quantity)}`}
                    fields={[
                      {
                        label: "Cost",
                        value: formatCurrency(Number(r.unit_cost || 0)),
                      },
                      {
                        label: "By",
                        value: r.profiles?.full_name || "—",
                      },
                      {
                        label: "When",
                        value: formatDateTime(r.created_at),
                        fullWidth: true,
                      },
                    ]}
                    actions={<RowActions actions={restockActions(r)} />}
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
      </div>

      <RowDetailsDialog
        open={!!detailsRestock}
        onOpenChange={(open) => !open && setDetailsRestock(null)}
        title="Restock details"
        description={
          detailsRestock
            ? `${detailsRestock.brands?.name || "Restock"} · ${formatDateTime(detailsRestock.created_at)}`
            : undefined
        }
        fields={
          detailsRestock
            ? [
                {
                  label: "Brand",
                  value: detailsRestock.brands?.name || "—",
                },
                { label: "Store", value: detailsRestock.stores?.name || "—" },
                {
                  label: "Quantity",
                  value: `+${formatNumber(detailsRestock.quantity)}`,
                },
                {
                  label: "Unit cost",
                  value: formatCurrency(Number(detailsRestock.unit_cost || 0)),
                },
                {
                  label: "Total cost",
                  value: formatCurrency(
                    detailsRestock.quantity *
                      Number(detailsRestock.unit_cost || 0)
                  ),
                },
                {
                  label: "Performed by",
                  value: detailsRestock.profiles?.full_name || "—",
                },
                {
                  label: "When",
                  value: formatDateTime(detailsRestock.created_at),
                },
                ...(detailsRestock.notes
                  ? [
                      {
                        label: "Notes",
                        value: detailsRestock.notes,
                        fullWidth: true,
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
    </div>
  );
}
