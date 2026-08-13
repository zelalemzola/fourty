"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  Package,
  Settings2,
  Boxes,
  Layers,
} from "lucide-react";
import type { RootState } from "@/store";
import {
  useGetInventoryQuery,
  useGetBrandsQuery,
  useGetStoresQuery,
  useSetMinStockBulkMutation,
} from "@/store/api/fourtyApi";
import type { InventoryItem, MinStockUpdate } from "@/types/database";
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
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

export default function InventoryPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const storeFilter = useSelector((s: RootState) => s.ui.storeFilter);
  const isOwner = profile?.role === "owner";
  const isStorekeeper = profile?.role === "storekeeper";
  const canSetMin = isOwner || isStorekeeper;

  const effectiveStoreId = isStorekeeper
    ? profile?.store_id || undefined
    : storeFilter;

  const { data: inventory = [], isLoading } = useGetInventoryQuery({
    storeId: effectiveStoreId || "all",
  });
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: stores = [] } = useGetStoresQuery();
  const [setMinStockBulk, { isLoading: savingMins }] =
    useSetMinStockBulkMutation();

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [detailsRow, setDetailsRow] = useState<InventoryItem | null>(null);
  const [minSheetOpen, setMinSheetOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [uniformMin, setUniformMin] = useState("10");
  const [perStoreMins, setPerStoreMins] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"uniform" | "per-store">("uniform");

  const [rowMinOpen, setRowMinOpen] = useState(false);
  const [rowMinTarget, setRowMinTarget] = useState<InventoryItem | null>(null);
  const [rowMinValue, setRowMinValue] = useState("");

  const activeStores = useMemo(
    () => stores.filter((s) => s.is_active),
    [stores]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((row) => {
      const brandName = row.brands?.name?.toLowerCase() || "";
      const sku = row.brands?.sku?.toLowerCase() || "";
      const storeName = row.stores?.name?.toLowerCase() || "";
      const matchesSearch =
        !q ||
        brandName.includes(q) ||
        sku.includes(q) ||
        storeName.includes(q);
      const isLow = row.quantity <= row.min_stock;
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && isLow) ||
        (stockFilter === "ok" && !isLow);
      return matchesSearch && matchesStock;
    });
  }, [inventory, search, stockFilter]);

  const kpis = useMemo(() => {
    const skuSet = new Set(filtered.map((r) => r.brand_id));
    const totalCartons = filtered.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const lowStock = filtered.filter((r) => r.quantity <= r.min_stock).length;
    const belowMin = filtered.filter((r) => r.quantity < r.min_stock).length;
    return {
      skus: skuSet.size,
      totalCartons,
      lowStock,
      belowMin,
    };
  }, [filtered]);

  const stockLevels = useMemo(() => {
    const top = [...filtered]
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
      .slice(0, 6);

    const scale = Math.max(
      ...top.map((r) => Math.max(r.quantity || 0, r.min_stock || 0)),
      1
    );

    return top.map((row) => {
      const qty = row.quantity || 0;
      const min = row.min_stock || 0;
      const low = qty <= min;
      const near = !low && min > 0 && qty <= min * 1.25;
      return {
        id: row.id,
        brand: row.brands?.name || "—",
        store: row.stores?.name || "",
        quantity: qty,
        min_stock: min,
        fillPct: Math.round((qty / scale) * 100),
        minPct: Math.round((min / scale) * 100),
        vsMinPct: min > 0 ? Math.round((qty / min) * 100) : 100,
        low,
        near,
        status: low ? "low" : near ? "watch" : "ok",
      };
    });
  }, [filtered]);

  const pager = usePagination(filtered, 10);

  function openMinSheet() {
    const firstBrand = brands.find((b) => b.is_active)?.id || brands[0]?.id || "";
    setSelectedBrandId(firstBrand);
    setUniformMin("10");
    const seeds: Record<string, string> = {};
    activeStores.forEach((s) => {
      const existing = inventory.find(
        (i) => i.store_id === s.id && i.brand_id === firstBrand
      );
      seeds[s.id] = String(existing?.min_stock ?? 10);
    });
    setPerStoreMins(seeds);
    setMode("uniform");
    setMinSheetOpen(true);
  }

  function openRowMin(row: InventoryItem) {
    setRowMinTarget(row);
    setRowMinValue(String(row.min_stock ?? 0));
    setRowMinOpen(true);
  }

  function inventoryActions(row: InventoryItem) {
    if (!canSetMin) return [];
    return [
      {
        label: "Set min",
        icon: <Settings2 className="size-4" />,
        onClick: () => openRowMin(row),
      },
    ];
  }

  function onBrandChange(brandId: string | null) {
    if (!brandId) return;
    setSelectedBrandId(brandId);
    const seeds: Record<string, string> = {};
    activeStores.forEach((s) => {
      const existing = inventory.find(
        (i) => i.store_id === s.id && i.brand_id === brandId
      );
      seeds[s.id] = String(existing?.min_stock ?? (uniformMin || 10));
    });
    setPerStoreMins(seeds);
  }

  async function submitRowMin(e: React.FormEvent) {
    e.preventDefault();
    if (!rowMinTarget) return;
    const min = Number(rowMinValue);
    if (!Number.isFinite(min) || min < 0) {
      toast.error("Enter a valid minimum");
      return;
    }
    try {
      await setMinStockBulk([
        {
          store_id: rowMinTarget.store_id,
          brand_id: rowMinTarget.brand_id,
          min_stock: min,
        },
      ]).unwrap();
      toast.success("Minimum stock updated");
      setRowMinOpen(false);
      setRowMinTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function submitMinStock() {
    if (!selectedBrandId) {
      toast.error("Select a brand");
      return;
    }
    let updates: MinStockUpdate[] = [];
    if (mode === "uniform") {
      const min = Number(uniformMin);
      if (!Number.isFinite(min) || min < 0) {
        toast.error("Enter a valid minimum");
        return;
      }
      updates = activeStores.map((s) => ({
        store_id: s.id,
        brand_id: selectedBrandId,
        min_stock: min,
      }));
    } else {
      updates = activeStores.map((s) => {
        const min = Number(perStoreMins[s.id] ?? 0);
        return {
          store_id: s.id,
          brand_id: selectedBrandId,
          min_stock: Number.isFinite(min) && min >= 0 ? min : 0,
        };
      });
    }
    try {
      await setMinStockBulk(updates).unwrap();
      toast.success("Minimum stock updated");
      setMinSheetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleExport() {
    await exportToExcel(
      filtered.map((row) => ({
        store: row.stores?.name || "",
        brand: row.brands?.name || "",
        sku: row.brands?.sku || "",
        quantity: row.quantity,
        min_stock: row.min_stock,
        status: row.quantity <= row.min_stock ? "low" : "ok",
      })),
      `inventory-${new Date().toISOString().slice(0, 10)}`,
      "Inventory"
    );
    toast.success("Exported inventory");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Carton levels across stores, with low-stock alerts and minimum thresholds."
        icon={Package}
        actions={
          <>
            {isOwner && (
              <Button variant="outline" onClick={openMinSheet}>
                <Settings2 className="size-4" />
                Set min stock
              </Button>
            )}
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export
            </Button>
          </>
        }
      />

      <GlobalFilters showDate={false} />

      <KpiGrid>
        <KpiCard
          title="SKUs"
          value={formatNumber(kpis.skus)}
          icon={Layers}
          hint="Distinct brands in view"
        />
        <KpiCard
          title="Total cartons"
          value={formatNumber(kpis.totalCartons)}
          icon={Boxes}
          tone="accent"
        />
        <KpiCard
          title="Low stock"
          value={formatNumber(kpis.lowStock)}
          icon={AlertTriangle}
          tone="warn"
          hint="At or below minimum"
        />
        <KpiCard
          title="Below min"
          value={formatNumber(kpis.belowMin)}
          icon={AlertTriangle}
          tone="warn"
          hint="Strictly under minimum"
        />
      </KpiGrid>

      <div className="panel p-3 sm:p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Stock levels</h2>
          <p className="text-xs text-muted-foreground">
            Top 6 by cartons on hand — bar length is relative to the highest stock in this list
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : stockLevels.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            No SKUs in view
          </div>
        ) : (
          <ul className="space-y-4">
            {stockLevels.map((row) => (
              <li key={row.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{row.brand}</p>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "low"
                            ? "border-accent/40 bg-accent/15 text-accent"
                            : row.status === "watch"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {row.status === "low"
                          ? "Low"
                          : row.status === "watch"
                            ? "Watch"
                            : "Healthy"}
                      </Badge>
                    </div>
                    {row.store && (
                      <p className="truncate text-xs text-muted-foreground">
                        {row.store}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatNumber(row.quantity)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        cartons
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Min {formatNumber(row.min_stock)}
                      {row.min_stock > 0 && (
                        <span className="text-muted-foreground/80">
                          {" "}
                          · {row.vsMinPct}% of min
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-muted">
                  {row.minPct > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-accent/20"
                      style={{ width: `${row.minPct}%` }}
                    />
                  )}
                  <div
                    className={
                      row.status === "low"
                        ? "absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 ease-out"
                        : row.status === "watch"
                          ? "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 ease-out"
                          : "absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 ease-out"
                    }
                    style={{ width: `${Math.max(row.fillPct, row.quantity > 0 ? 2 : 0)}%` }}
                  />
                  {row.minPct > 0 && row.minPct < 100 && (
                    <div
                      className="absolute top-0 bottom-0 z-10 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_0_2px_var(--background)]"
                      style={{ left: `${row.minPct}%` }}
                      title={`Minimum ${row.min_stock}`}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-primary" />
            On hand (relative)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-accent/20" />
            Below-min zone
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-0.5 bg-accent" />
            Minimum mark
          </span>
        </div>
      </div>

      <div className="panel space-y-3 rounded-lg p-3 sm:p-4">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search brand, SKU, or store…"
          filters={[
            {
              id: "stock",
              label: "Stock",
              icon: Boxes,
              value: stockFilter,
              onChange: setStockFilter,
              allLabel: "All levels",
              options: [
                { value: "low", label: "Low stock" },
                { value: "ok", label: "Healthy" },
              ],
            },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">
            No inventory rows match your filters.
          </div>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {pager.pageItems.map((row) => {
                const low = row.quantity <= row.min_stock;
                return (
                  <MobileRowCard
                    key={row.id}
                    onClick={() => setDetailsRow(row)}
                    fields={[
                      { label: "Brand", value: row.brands?.name || "—" },
                      { label: "Store", value: row.stores?.name || "—" },
                      {
                        label: "Qty",
                        value: formatNumber(row.quantity),
                      },
                      {
                        label: "Status",
                        value: low ? (
                          <Badge variant="destructive">Low</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        ),
                      },
                    ]}
                    actions={
                      canSetMin ? (
                        <RowActions actions={inventoryActions(row)} />
                      ) : undefined
                    }
                  />
                );
              })}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead>Status</TableHead>
                    {canSetMin && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((row) => {
                    const low = row.quantity <= row.min_stock;
                    return (
                      <TableRow
                        key={row.id}
                        {...rowClickProps(() => setDetailsRow(row))}
                      >
                        <TableCell>{row.stores?.name || "—"}</TableCell>
                        <TableCell className="font-medium">
                          {row.brands?.name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.brands?.sku || "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(row.quantity)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber(row.min_stock)}
                        </TableCell>
                        <TableCell>
                          {low ? (
                            <Badge variant="destructive">Low stock</Badge>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                        </TableCell>
                        {canSetMin && (
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RowActions actions={inventoryActions(row)} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
        open={!!detailsRow}
        onOpenChange={(open) => !open && setDetailsRow(null)}
        title="Inventory details"
        description={
          detailsRow
            ? `${detailsRow.brands?.name || "Brand"} · ${detailsRow.stores?.name || "Store"}`
            : undefined
        }
        fields={
          detailsRow
            ? [
                { label: "Store", value: detailsRow.stores?.name || "—" },
                { label: "Brand", value: detailsRow.brands?.name || "—" },
                { label: "SKU", value: detailsRow.brands?.sku || "—" },
                {
                  label: "Quantity",
                  value: formatNumber(detailsRow.quantity),
                },
                {
                  label: "Minimum",
                  value: formatNumber(detailsRow.min_stock),
                },
                {
                  label: "Status",
                  value:
                    detailsRow.quantity <= detailsRow.min_stock
                      ? "Low stock"
                      : "OK",
                },
              ]
            : []
        }
      />

      <Dialog open={rowMinOpen} onOpenChange={setRowMinOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submitRowMin}>
            <DialogHeader>
              <DialogTitle>Set minimum stock</DialogTitle>
              <DialogDescription>
                {rowMinTarget?.brands?.name || "Brand"} ·{" "}
                {rowMinTarget?.stores?.name || "Store"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-3">
              <Label htmlFor="row-min">Minimum cartons</Label>
              <Input
                id="row-min"
                type="number"
                min={0}
                value={rowMinValue}
                onChange={(e) => setRowMinValue(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRowMinOpen(false)}
                disabled={savingMins}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingMins}>
                {savingMins ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={minSheetOpen} onOpenChange={setMinSheetOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Bulk set minimum stock</SheetTitle>
            <SheetDescription>
              Apply one threshold to every store for a brand, or set each store
              individually.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={selectedBrandId} onValueChange={onBrandChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs
              value={mode}
              onValueChange={(v) =>
                setMode((v ?? "uniform") as "uniform" | "per-store")
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="uniform">Same for all</TabsTrigger>
                <TabsTrigger value="per-store">Per store</TabsTrigger>
              </TabsList>
              <TabsContent value="uniform" className="mt-3 space-y-2">
                <Label htmlFor="uniform-min">Minimum cartons</Label>
                <Input
                  id="uniform-min"
                  type="number"
                  min={0}
                  value={uniformMin}
                  onChange={(e) => setUniformMin(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Applies to {activeStores.length} active store
                  {activeStores.length === 1 ? "" : "s"}.
                </p>
              </TabsContent>
              <TabsContent value="per-store" className="mt-3 space-y-3">
                {activeStores.map((s) => (
                  <div key={s.id} className="space-y-1.5">
                    <Label htmlFor={`min-${s.id}`}>{s.name}</Label>
                    <Input
                      id={`min-${s.id}`}
                      type="number"
                      min={0}
                      value={perStoreMins[s.id] ?? ""}
                      onChange={(e) =>
                        setPerStoreMins((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                {activeStores.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No active stores available.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setMinSheetOpen(false)}
              disabled={savingMins}
            >
              Cancel
            </Button>
            <Button onClick={submitMinStock} disabled={savingMins}>
              {savingMins ? "Saving…" : "Save thresholds"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
