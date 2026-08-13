"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Download,
  Eye,
  Package,
  RotateCcw,
  Truck,
  Users,
  Boxes,
  ShoppingBag,
  Undo2,
  Clock,
  AlertTriangle,
  CircleDot,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { RootState } from "@/store";
import type { SubagentBatch } from "@/types/database";
import {
  useGetBatchesQuery,
  useGetUsersQuery,
  useGetStoresQuery,
  useGetBrandsQuery,
  useGetInventoryQuery,
  useIssueBatchMutation,
  useReturnBatchStockMutation,
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
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, formatRelative, formatDateTime } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

const OVERDUE_DAYS = 14;

function daysSinceIssued(issuedAt: string) {
  return differenceInCalendarDays(new Date(), parseISO(issuedAt));
}

function statusVariant(status: SubagentBatch["status"]) {
  if (status === "settled") return "secondary" as const;
  if (status === "overdue" || status === "partially_returned")
    return "outline" as const;
  return "default" as const;
}

export default function SubagentsPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const storeFilter = useSelector((s: RootState) => s.ui.storeFilter);
  const isOwner = profile?.role === "owner";
  const isStorekeeper = profile?.role === "storekeeper";
  const isSubagent = profile?.role === "subagent";
  const canIssue = isOwner || isStorekeeper;

  const effectiveStoreId = isStorekeeper
    ? profile?.store_id || undefined
    : storeFilter === "all"
      ? undefined
      : storeFilter;

  const { data: batches = [], isLoading } = useGetBatchesQuery(
    isSubagent
      ? { subagentId: profile?.id }
      : { storeId: effectiveStoreId || "all" }
  );
  const { data: subagents = [] } = useGetUsersQuery(
    canIssue
      ? {
          role: "subagent",
          storeId: isStorekeeper ? profile?.store_id || undefined : undefined,
        }
      : undefined,
    { skip: !canIssue }
  );
  const { data: stores = [] } = useGetStoresQuery(undefined, { skip: !canIssue });
  const { data: brands = [] } = useGetBrandsQuery(undefined, { skip: !canIssue });
  const { data: inventory = [] } = useGetInventoryQuery(
    { storeId: effectiveStoreId || "all" },
    { skip: !canIssue }
  );

  const [issueBatch, { isLoading: issuing }] = useIssueBatchMutation();
  const [returnStock, { isLoading: returning }] = useReturnBatchStockMutation();

  const [storeId, setStoreId] = useState("");
  const [subagentId, setSubagentId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnBatch, setReturnBatch] = useState<SubagentBatch | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [rosterFilterId, setRosterFilterId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterActive, setRosterActive] = useState("all");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatus, setBatchStatus] = useState("all");
  const [detailsRoster, setDetailsRoster] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    store: string;
    isActive: boolean;
    activeBatches: number;
    inHand: number;
    sold: number;
  } | null>(null);
  const [detailsBatch, setDetailsBatch] = useState<SubagentBatch | null>(null);

  useEffect(() => {
    if (isStorekeeper && profile?.store_id) setStoreId(profile.store_id);
  }, [isStorekeeper, profile?.store_id]);

  const availableQty = useMemo(() => {
    if (!storeId || !brandId) return 0;
    const row = inventory.find(
      (i) => i.store_id === storeId && i.brand_id === brandId
    );
    return row?.quantity ?? 0;
  }, [inventory, storeId, brandId]);

  const scopedSubagents = useMemo(() => {
    if (!storeId) return subagents.filter((s) => s.is_active);
    return subagents.filter(
      (s) => s.is_active && (!s.store_id || s.store_id === storeId)
    );
  }, [subagents, storeId]);

  const kpis = useMemo(() => {
    const active = batches.filter(
      (b) => b.status === "active" || b.status === "partially_returned"
    );
    const inHand = batches.reduce((s, b) => s + (b.quantity_in_hand || 0), 0);
    const sold = batches.reduce((s, b) => s + (b.quantity_sold || 0), 0);
    const returned = batches.reduce(
      (s, b) => s + (b.quantity_returned || 0),
      0
    );
    const overdue = batches.filter((b) => {
      if (b.status === "settled") return false;
      if (b.status === "overdue") return true;
      return daysSinceIssued(b.issued_at) >= OVERDUE_DAYS;
    }).length;
    return {
      active: active.length,
      inHand,
      sold,
      returned,
      overdue,
    };
  }, [batches]);

  const subagentSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        phone: string;
        store: string;
        isActive: boolean;
        activeBatches: number;
        inHand: number;
        sold: number;
      }
    >();
    for (const s of subagents) {
      map.set(s.id, {
        id: s.id,
        name: s.full_name,
        email: s.email,
        phone: s.phone || "",
        store: s.stores?.name || "—",
        isActive: s.is_active,
        activeBatches: 0,
        inHand: 0,
        sold: 0,
      });
    }
    for (const b of batches) {
      const id = b.subagent_id;
      const existing = map.get(id) || {
        id,
        name: b.subagent?.full_name || "Unknown",
        email: b.subagent?.email || "",
        phone: "",
        store: b.stores?.name || "—",
        isActive: true,
        activeBatches: 0,
        inHand: 0,
        sold: 0,
      };
      if (b.status === "active" || b.status === "partially_returned") {
        existing.activeBatches += 1;
      }
      existing.inHand += b.quantity_in_hand || 0;
      existing.sold += b.quantity_sold || 0;
      map.set(id, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [subagents, batches]);

  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return subagentSummaries.filter((s) => {
      const matchesActive =
        rosterActive === "all" ||
        (rosterActive === "active" && s.isActive) ||
        (rosterActive === "inactive" && !s.isActive);
      if (!matchesActive) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.store.toLowerCase().includes(q)
      );
    });
  }, [subagentSummaries, rosterSearch, rosterActive]);

  const rosterPager = usePagination(filteredRoster, 10);
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (rosterFilterId) {
      list = list.filter((b) => b.subagent_id === rosterFilterId);
    }
    if (batchStatus !== "all") {
      list = list.filter((b) => b.status === batchStatus);
    }
    const q = batchSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => {
      const hay = [
        b.brands?.name || "",
        b.subagent?.full_name || "",
        b.stores?.name || "",
        b.status || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [batches, rosterFilterId, batchSearch, batchStatus]);
  const batchPager = usePagination(filteredBatches, 10);

  function viewBatchesFor(subagentId: string) {
    setRosterFilterId(subagentId);
    document
      .getElementById("batch-ledger")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function rosterActions(subagentId: string) {
    return [
      {
        label: "View batches",
        icon: <Eye className="size-4" />,
        onClick: () => viewBatchesFor(subagentId),
      },
    ];
  }

  function batchActions(b: SubagentBatch) {
    if (!canIssue || b.quantity_in_hand <= 0) return [];
    return [
      {
        label: "Return stock",
        icon: <RotateCcw className="size-4" />,
        onClick: () => openReturn(b),
      },
    ];
  }

  async function submitIssue(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number(qty);
    if (!storeId || !subagentId || !brandId) {
      toast.error("Select store, subagent, and brand");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (quantity > availableQty) {
      toast.error(`Only ${availableQty} cartons available in store stock`);
      return;
    }
    try {
      await issueBatch({
        store_id: storeId,
        subagent_id: subagentId,
        brand_id: brandId,
        quantity_taken: quantity,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success("Batch issued");
      setQty("1");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue failed");
    }
  }

  function openReturn(batch: SubagentBatch) {
    setReturnBatch(batch);
    setReturnQty(String(Math.min(1, batch.quantity_in_hand) || 1));
    setReturnOpen(true);
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnBatch) return;
    const quantity = Number(returnQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid return quantity");
      return;
    }
    if (quantity > returnBatch.quantity_in_hand) {
      toast.error("Return exceeds cartons in hand");
      return;
    }
    try {
      await returnStock({
        batch_id: returnBatch.id,
        quantity,
      }).unwrap();
      toast.success("Stock returned to store");
      setReturnOpen(false);
      setReturnBatch(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Return failed");
    }
  }

  async function handleExport() {
    try {
      await exportToExcel(
        batches.map((b) => ({
          issued_at: b.issued_at,
          store: b.stores?.name || "",
          subagent: b.subagent?.full_name || "",
          brand: b.brands?.name || "",
          taken: b.quantity_taken,
          sold: b.quantity_sold,
          returned: b.quantity_returned,
          in_hand: b.quantity_in_hand,
          status: b.status,
          days_out: daysSinceIssued(b.issued_at),
          issued_relative: formatRelative(b.issued_at),
        })),
        `fourty-batches-${new Date().toISOString().slice(0, 10)}`,
        "Batches"
      );
      toast.success("Batches exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isSubagent ? "My batches" : "Subagents"}
        description={
          isSubagent
            ? "Cartons currently in your hand and batch history."
            : "Issue stock to subagents, track in-hand cartons, and settle returns."
        }
        icon={Users}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!batches.length}
          >
            <Download className="size-4" />
            Export
          </Button>
        }
      />

      {canIssue && <GlobalFilters showDate={false} showStore={isOwner} />}

      <KpiGrid cols={5}>
        <KpiCard
          title="Active batches"
          value={formatNumber(kpis.active)}
          icon={Truck}
          tone="accent"
        />
        <KpiCard
          title="In hand"
          value={formatNumber(kpis.inHand)}
          icon={Boxes}
          hint="Cartons with subagents"
        />
        <KpiCard
          title="Sold"
          value={formatNumber(kpis.sold)}
          icon={ShoppingBag}
        />
        <KpiCard
          title="Returned"
          value={formatNumber(kpis.returned)}
          icon={Undo2}
        />
        <KpiCard
          title="Overdue-ish"
          value={formatNumber(kpis.overdue)}
          icon={AlertTriangle}
          tone={kpis.overdue > 0 ? "warn" : "success"}
          hint={`Open ≥ ${OVERDUE_DAYS} days`}
        />
      </KpiGrid>

      {canIssue && (
        <form
          onSubmit={submitIssue}
          className="panel space-y-4 p-3 sm:p-4"
        >
          <div>
            <h2 className="text-sm font-semibold">Issue batch</h2>
            <p className="text-xs text-muted-foreground">
              Pull cartons from store inventory into a subagent batch.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isOwner && (
              <div className="space-y-1.5">
                <Label>Store</Label>
                <Select
                  value={storeId}
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
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Subagent</Label>
              <Select
                value={subagentId}
                onValueChange={(v) => setSubagentId(v ?? "")}
              >
                <SelectTrigger className="w-full bg-background/70">
                  <SelectValue placeholder="Select subagent" />
                </SelectTrigger>
                <SelectContent>
                  {scopedSubagents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select
                value={brandId}
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
            <div className="space-y-1.5">
              <Label htmlFor="batch-qty">Quantity</Label>
              <Input
                id="batch-qty"
                type="number"
                min={1}
                className="bg-background/70"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Available: {formatNumber(availableQty)} cartons
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-notes">Notes</Label>
            <Textarea
              id="batch-notes"
              className="bg-background/70"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note for this issue…"
            />
          </div>
          <Button type="submit" disabled={issuing}>
            <Package className="size-4" />
            {issuing ? "Issuing…" : "Issue batch"}
          </Button>
        </form>
      )}

      {canIssue && (
        <div className="panel space-y-3 p-3 sm:p-4">
          <div>
            <h2 className="text-sm font-semibold">
              Subagent roster
            </h2>
            <p className="text-xs text-muted-foreground">
              Active batches and cartons currently out
            </p>
          </div>
          <DataTableToolbar
            search={rosterSearch}
            onSearchChange={setRosterSearch}
            searchPlaceholder="Search name, phone…"
            filters={[
              {
                id: "active",
                label: "Status",
                icon: CircleDot,
                value: rosterActive,
                onChange: setRosterActive,
                allLabel: "All statuses",
                options: [
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ],
              },
            ]}
          />
          {filteredRoster.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No subagents found. Create accounts in Supabase Auth, then assign
              the subagent role under Team.
            </p>
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {rosterPager.pageItems.map((s) => (
                  <MobileRowCard
                    key={s.id}
                    onClick={() => setDetailsRoster(s)}
                    fields={[
                      { label: "Name", value: s.name },
                      { label: "Store", value: s.store },
                      {
                        label: "In hand",
                        value: formatNumber(s.inHand),
                      },
                      {
                        label: "Active",
                        value: formatNumber(s.activeBatches),
                      },
                    ]}
                    actions={<RowActions actions={rosterActions(s.id)} />}
                  />
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subagent</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">In hand</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rosterPager.pageItems.map((s) => (
                      <TableRow
                        key={s.id}
                        {...rowClickProps(() => setDetailsRoster(s))}
                      >
                        <TableCell>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.email}
                          </div>
                        </TableCell>
                        <TableCell>{s.store}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(s.activeBatches)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(s.inHand)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(s.sold)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RowActions actions={rosterActions(s.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={rosterPager.page}
                totalPages={rosterPager.totalPages}
                total={rosterPager.total}
                from={rosterPager.from}
                to={rosterPager.to}
                onPageChange={rosterPager.setPage}
              />
            </>
          )}
        </div>
      )}

      <div className="panel space-y-3 p-3 sm:p-4" id="batch-ledger">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              {isSubagent ? "Your batches" : "Batch ledger"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Track days out with relative issue times
              {rosterFilterId
                ? ` · filtered to ${
                    subagentSummaries.find((s) => s.id === rosterFilterId)
                      ?.name || "subagent"
                  }`
                : ""}
            </p>
          </div>
          {rosterFilterId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRosterFilterId(null)}
            >
              Clear filter
            </Button>
          )}
        </div>

        <DataTableToolbar
          search={batchSearch}
          onSearchChange={setBatchSearch}
          searchPlaceholder="Search brand, subagent…"
          filters={[
            {
              id: "status",
              label: "Status",
              icon: Filter,
              value: batchStatus,
              onChange: setBatchStatus,
              allLabel: "All statuses",
              options: [
                { value: "active", label: "Active" },
                { value: "partially_returned", label: "Partially returned" },
                { value: "settled", label: "Settled" },
                { value: "overdue", label: "Overdue" },
              ],
            },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredBatches.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No batches yet.
          </p>
        ) : (
          <>
            <ul className="space-y-2 lg:hidden">
              {batchPager.pageItems.map((b) => {
                const days = daysSinceIssued(b.issued_at);
                const stale =
                  b.status !== "settled" && days >= OVERDUE_DAYS;
                const actions = batchActions(b);
                return (
                  <MobileRowCard
                    key={b.id}
                    onClick={() => setDetailsBatch(b)}
                    fields={[
                      { label: "Brand", value: b.brands?.name || "—" },
                      {
                        label: "Status",
                        value: (
                          <Badge variant={statusVariant(b.status)}>
                            {stale ? "stale" : b.status}
                          </Badge>
                        ),
                      },
                      {
                        label: "In hand",
                        value: formatNumber(b.quantity_in_hand),
                      },
                      {
                        label: "Taken",
                        value: formatNumber(b.quantity_taken),
                      },
                    ]}
                    actions={
                      actions.length > 0 ? (
                        <RowActions actions={actions} />
                      ) : undefined
                    }
                  />
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isSubagent && <TableHead>Subagent</TableHead>}
                    <TableHead>Brand</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Taken</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">In hand</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    {canIssue && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchPager.pageItems.map((b) => {
                    const days = daysSinceIssued(b.issued_at);
                    const stale =
                      b.status !== "settled" && days >= OVERDUE_DAYS;
                    const actions = batchActions(b);
                    return (
                      <TableRow
                        key={b.id}
                        {...rowClickProps(() => setDetailsBatch(b))}
                      >
                        {!isSubagent && (
                          <TableCell className="font-medium">
                            {b.subagent?.full_name || "—"}
                          </TableCell>
                        )}
                        <TableCell>{b.brands?.name || "—"}</TableCell>
                        <TableCell>{b.stores?.name || "—"}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(b.quantity_taken)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(b.quantity_sold)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(b.quantity_returned)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(b.quantity_in_hand)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(b.status)}>
                            {stale ? "stale" : b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="size-3" />
                            {formatRelative(b.issued_at)}
                          </div>
                          <div className="text-xs">{days}d out</div>
                        </TableCell>
                        {canIssue && (
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {actions.length > 0 ? (
                              <RowActions actions={actions} />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={batchPager.page}
              totalPages={batchPager.totalPages}
              total={batchPager.total}
              from={batchPager.from}
              to={batchPager.to}
              onPageChange={batchPager.setPage}
            />
          </>
        )}
      </div>

      <RowDetailsDialog
        open={!!detailsRoster}
        onOpenChange={(open) => !open && setDetailsRoster(null)}
        title="Subagent details"
        description={detailsRoster?.email}
        fields={
          detailsRoster
            ? [
                { label: "Name", value: detailsRoster.name },
                { label: "Email", value: detailsRoster.email },
                { label: "Phone", value: detailsRoster.phone || "—" },
                { label: "Store", value: detailsRoster.store },
                {
                  label: "Status",
                  value: detailsRoster.isActive ? "Active" : "Inactive",
                },
                {
                  label: "Active batches",
                  value: formatNumber(detailsRoster.activeBatches),
                },
                {
                  label: "In hand",
                  value: formatNumber(detailsRoster.inHand),
                },
                {
                  label: "Sold",
                  value: formatNumber(detailsRoster.sold),
                },
              ]
            : []
        }
      />

      <RowDetailsDialog
        open={!!detailsBatch}
        onOpenChange={(open) => !open && setDetailsBatch(null)}
        title="Batch details"
        description={
          detailsBatch
            ? `${detailsBatch.brands?.name || "Batch"} · ${formatRelative(detailsBatch.issued_at)}`
            : undefined
        }
        fields={
          detailsBatch
            ? [
                {
                  label: "Subagent",
                  value: detailsBatch.subagent?.full_name || "—",
                },
                {
                  label: "Brand",
                  value: detailsBatch.brands?.name || "—",
                },
                {
                  label: "Store",
                  value: detailsBatch.stores?.name || "—",
                },
                {
                  label: "Taken",
                  value: formatNumber(detailsBatch.quantity_taken),
                },
                {
                  label: "Sold",
                  value: formatNumber(detailsBatch.quantity_sold),
                },
                {
                  label: "Returned",
                  value: formatNumber(detailsBatch.quantity_returned),
                },
                {
                  label: "In hand",
                  value: formatNumber(detailsBatch.quantity_in_hand),
                },
                {
                  label: "Status",
                  value: detailsBatch.status,
                },
                {
                  label: "Issued",
                  value: formatDateTime(detailsBatch.issued_at),
                },
              ]
            : []
        }
      />

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitReturn}>
            <DialogHeader>
              <DialogTitle>Return stock</DialogTitle>
              <DialogDescription>
                Move cartons from the subagent batch back into store inventory.
                In hand:{" "}
                {formatNumber(returnBatch?.quantity_in_hand || 0)} ·{" "}
                {returnBatch?.brands?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-3">
              <Label htmlFor="return-qty">Quantity to return</Label>
              <Input
                id="return-qty"
                type="number"
                min={1}
                max={returnBatch?.quantity_in_hand || 1}
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnOpen(false)}
                disabled={returning}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={returning}>
                {returning ? "Returning…" : "Confirm return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
