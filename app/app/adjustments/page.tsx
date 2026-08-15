"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Download, Eye, SlidersHorizontal, Tag } from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { AdjustmentReason, StockAdjustment } from "@/types/database";
import {
  useCreateAdjustmentMutation,
  useGetAdjustmentsQuery,
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
import { formatDateTime, formatNumber } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

const reasons: { value: AdjustmentReason; label: string }[] = [
  { value: "count_correction", label: "Count correction" },
  { value: "damage", label: "Damage" },
  { value: "shrinkage", label: "Shrinkage / loss" },
  { value: "return_to_supplier", label: "Return to supplier" },
  { value: "other", label: "Other" },
];

export default function AdjustmentsPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const storeFilter = useSelector((s: RootState) => s.ui.storeFilter);
  const isOwner = profile?.role === "owner";

  const scopedStore =
    profile?.role === "storekeeper" ? profile.store_id || "" : "";

  const [storeId, setStoreId] = useState(scopedStore);
  const [brandId, setBrandId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("count_correction");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [detailsAdj, setDetailsAdj] = useState<StockAdjustment | null>(null);

  const { data: stores = [] } = useGetStoresQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: adjustments = [], isLoading } = useGetAdjustmentsQuery({
    storeId: isOwner ? storeFilter : profile?.store_id || undefined,
  });
  const [createAdjustment, { isLoading: saving }] = useCreateAdjustmentMutation();

  const positives = adjustments.filter((a) => a.quantity_delta > 0).length;
  const negatives = adjustments.filter((a) => a.quantity_delta < 0).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adjustments.filter((a) => {
      const matchesReason =
        reasonFilter === "all" || a.reason === reasonFilter;
      if (!matchesReason) return false;
      if (!q) return true;
      const hay = [
        a.brands?.name || "",
        a.stores?.name || "",
        a.reason || "",
        a.notes || "",
        a.profiles?.full_name || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [adjustments, search, reasonFilter]);

  const pager = usePagination(filtered, 10);

  function adjustmentActions(a: StockAdjustment) {
    return [
      {
        label: "Details",
        icon: <Eye className="size-4" />,
        onClick: () => setDetailsAdj(a),
      },
    ];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sid = storeId || scopedStore;
    const qty = Number(delta);
    if (!sid || !brandId || !qty) {
      toast.error("Store, brand, and non-zero quantity are required");
      return;
    }
    try {
      await createAdjustment({
        store_id: sid,
        brand_id: brandId,
        quantity_delta: qty,
        reason,
        notes,
      }).unwrap();
      toast.success("Adjustment recorded");
      setDelta("");
      setNotes("");
    } catch (err) {
      toast.error(
        typeof err === "object" && err && "data" in err
          ? String((err as { data: unknown }).data)
          : "Adjustment failed"
      );
    }
  }

  if (profile?.role === "subagent") {
    return (
      <div className="panel p-6 text-center text-sm text-muted-foreground">
        Stock adjustments are limited to store staff and owners.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock adjustments"
        description="Correct counts, record damage/shrinkage, and keep an auditable inventory trail."
        icon={SlidersHorizontal}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await exportToExcel(
                adjustments.map((a) => ({
                  date: a.created_at,
                  store: a.stores?.name,
                  brand: a.brands?.name,
                  delta: a.quantity_delta,
                  reason: a.reason,
                  notes: a.notes,
                })),
                "stock-adjustments",
                "Adjustments"
              );
              toast.success("Exported");
            }}
          >
            <Download className="size-4" />
            Export
          </Button>
        }
      />

      <GlobalFilters showDate={false} />

      <KpiGrid cols={3}>
        <KpiCard title="Total adjustments" value={formatNumber(adjustments.length)} icon={SlidersHorizontal} featured />
        <KpiCard title="Positive" value={formatNumber(positives)} icon={SlidersHorizontal} tone="success" />
        <KpiCard title="Negative" value={formatNumber(negatives)} icon={SlidersHorizontal} tone="warn" />
      </KpiGrid>

      <form onSubmit={onSubmit} className="panel grid gap-3 p-3 sm:p-4 md:grid-cols-2">
        <p className="text-sm font-semibold md:col-span-2">New adjustment</p>

        {isOwner && (
          <div className="space-y-1.5">
            <Label>Store</Label>
            <Select value={storeId} onValueChange={(v) => setStoreId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Brand</Label>
          <Select value={brandId} onValueChange={(v) => setBrandId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.filter((b) => b.is_active).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Quantity delta (+/-)</Label>
          <Input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. -2 or 3"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Select
            value={reason}
            onValueChange={(v) => setReason((v as AdjustmentReason) || "other")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="md:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Post adjustment"}
          </Button>
        </div>
      </form>

      <div className="panel space-y-3 p-3 sm:p-4">
        <p className="text-sm font-semibold">History</p>
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search brand, store, notes…"
          filters={[
            {
              id: "reason",
              label: "Reason",
              icon: Tag,
              value: reasonFilter,
              onChange: setReasonFilter,
              allLabel: "All reasons",
              options: reasons.map((r) => ({
                value: r.value,
                label: r.label,
              })),
            },
          ]}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((a) => (
                    <TableRow
                      key={a.id}
                      {...rowClickProps(() => setDetailsAdj(a))}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(a.created_at)}
                      </TableCell>
                      <TableCell>{a.stores?.name}</TableCell>
                      <TableCell>{a.brands?.name}</TableCell>
                      <TableCell className="text-right font-figure font-medium">
                        {a.quantity_delta > 0 ? "+" : ""}
                        {a.quantity_delta}
                      </TableCell>
                      <TableCell className="capitalize">
                        {a.reason.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={adjustmentActions(a)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-3 md:hidden">
              {pager.pageItems.map((a) => (
                <MobileRowCard
                  key={a.id}
                  onClick={() => setDetailsAdj(a)}
                  title={a.brands?.name || "—"}
                  trailing={`${a.quantity_delta > 0 ? "+" : ""}${a.quantity_delta}`}
                  fields={[
                    { label: "Store", value: a.stores?.name || "—" },
                    {
                      label: "Reason",
                      value: (
                        <span className="capitalize">
                          {a.reason.replace(/_/g, " ")}
                        </span>
                      ),
                    },
                  ]}
                  actions={<RowActions actions={adjustmentActions(a)} />}
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
        open={!!detailsAdj}
        onOpenChange={(open) => !open && setDetailsAdj(null)}
        title="Adjustment details"
        description={
          detailsAdj
            ? `${detailsAdj.brands?.name || "Adjustment"} · ${formatDateTime(detailsAdj.created_at)}`
            : undefined
        }
        fields={
          detailsAdj
            ? [
                { label: "Store", value: detailsAdj.stores?.name || "—" },
                { label: "Brand", value: detailsAdj.brands?.name || "—" },
                {
                  label: "Delta",
                  value: `${detailsAdj.quantity_delta > 0 ? "+" : ""}${detailsAdj.quantity_delta}`,
                },
                {
                  label: "Reason",
                  value: (
                    <span className="capitalize">
                      {detailsAdj.reason.replace(/_/g, " ")}
                    </span>
                  ),
                },
                {
                  label: "Performed by",
                  value: detailsAdj.profiles?.full_name || "—",
                },
                {
                  label: "Notes",
                  value: detailsAdj.notes || "—",
                  fullWidth: true,
                },
              ]
            : []
        }
      />
    </div>
  );
}
