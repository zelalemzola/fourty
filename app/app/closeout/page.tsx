"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { ClipboardCheck, Download, Eye, CheckCircle2, CircleDot } from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { DailyCloseout } from "@/types/database";
import {
  useGetCloseoutsQuery,
  useGetInventoryQuery,
  useGetSalesQuery,
  useGetStoresQuery,
  useReviewCloseoutMutation,
  useSubmitCloseoutMutation,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { GlobalFilters } from "@/components/filters/global-filters";
import { DatePicker } from "@/components/filters/date-range-picker";
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
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions, type RowAction } from "@/components/table/row-actions";

export default function CloseoutPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const storeFilter = useSelector((s: RootState) => s.ui.storeFilter);
  const isOwner = profile?.role === "owner";
  const isStorekeeper = profile?.role === "storekeeper";

  const effectiveStore =
    isStorekeeper ? profile?.store_id || "" : storeFilter === "all" ? "" : storeFilter;

  const [storeId, setStoreId] = useState(effectiveStore);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [cashDeclared, setCashDeclared] = useState("");
  const [notesCloseout, setNotesCloseout] = useState<DailyCloseout | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailsCloseout, setDetailsCloseout] =
    useState<DailyCloseout | null>(null);

  const activeStoreId = storeId || effectiveStore || profile?.store_id || "";

  const { data: stores = [] } = useGetStoresQuery();
  const { data: closeouts = [], isLoading } = useGetCloseoutsQuery({
    storeId: isOwner ? storeFilter : profile?.store_id || undefined,
  });
  const { data: inventory = [] } = useGetInventoryQuery({
    storeId: activeStoreId || "all",
  });
  const { data: sales = [] } = useGetSalesQuery({
    storeId: activeStoreId || undefined,
    dateFilter: { preset: "custom", from: date, to: date },
  });
  const [submitCloseout, { isLoading: submitting }] = useSubmitCloseoutMutation();
  const [reviewCloseout] = useReviewCloseoutMutation();

  const dayStats = useMemo(() => {
    const amount = sales.reduce((s, r) => s + Number(r.total_amount), 0);
    const cartons = sales.reduce((s, r) => s + r.quantity, 0);
    return { amount, cartons, tx: sales.length, skus: inventory.length };
  }, [sales, inventory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return closeouts.filter((c) => {
      const matchesSearch =
        !q ||
        (c.stores?.name || "").toLowerCase().includes(q) ||
        (c.status || "").toLowerCase().includes(q) ||
        (c.opening_notes || "").toLowerCase().includes(q) ||
        (c.closing_notes || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [closeouts, search, statusFilter]);

  const pager = usePagination(filtered, 10);

  async function handleReview(c: DailyCloseout) {
    try {
      await reviewCloseout(c.id).unwrap();
      toast.success("Marked reviewed");
    } catch {
      toast.error("Review failed");
    }
  }

  function closeoutActions(c: DailyCloseout): RowAction[] {
    const actions: RowAction[] = [
      {
        label: "Details",
        icon: <Eye className="size-4" />,
        onClick: () => setDetailsCloseout(c),
      },
    ];
    if (isOwner && c.status === "submitted") {
      actions.push({
        label: "Review",
        icon: <CheckCircle2 className="size-4" />,
        onClick: () => handleReview(c),
      });
    }
    if (c.opening_notes || c.closing_notes) {
      actions.push({
        label: "View notes",
        icon: <Eye className="size-4" />,
        onClick: () => setNotesCloseout(c),
      });
    }
    return actions;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStoreId) {
      toast.error("Select a store");
      return;
    }
    try {
      await submitCloseout({
        store_id: activeStoreId,
        closeout_date: date,
        opening_notes: openingNotes,
        closing_notes: closingNotes,
        cash_declared: Number(cashDeclared) || 0,
      }).unwrap();
      toast.success("Daily closeout submitted to owner");
      setOpeningNotes("");
      setClosingNotes("");
      setCashDeclared("");
    } catch (err) {
      toast.error(
        typeof err === "object" && err && "data" in err
          ? String((err as { data: unknown }).data)
          : "Closeout failed"
      );
    }
  }

  async function onExport() {
    await exportToExcel(
      closeouts.map((c) => ({
        date: c.closeout_date,
        store: c.stores?.name || "",
        sales: c.total_sales_amount,
        cartons: c.total_cartons_sold,
        transactions: c.total_transactions,
        cash: c.cash_declared,
        status: c.status,
      })),
      `closeouts-${date}`,
      "Closeouts"
    );
    toast.success("Exported");
  }

  if (profile?.role === "subagent") {
    return (
      <div className="panel p-6 text-center text-sm text-muted-foreground">
        Daily closeout is for storekeepers and owners.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily closeout"
        description="End-of-day submission: sales totals, cash declared, stock on hand, and notes — replaces handwritten reports."
        icon={ClipboardCheck}
        actions={
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="size-4" />
            Export
          </Button>
        }
      />

      <GlobalFilters showDate={false} />

      <KpiGrid>
        <KpiCard title="Today sales" value={formatCurrency(dayStats.amount)} icon={ClipboardCheck} featured />
        <KpiCard title="Cartons sold" value={formatNumber(dayStats.cartons)} icon={ClipboardCheck} fill="navySoft" />
        <KpiCard title="Transactions" value={formatNumber(dayStats.tx)} icon={ClipboardCheck} fill="coral" />
        <KpiCard title="SKUs on hand" value={formatNumber(dayStats.skus)} icon={ClipboardCheck} />
      </KpiGrid>

      {(isStorekeeper || isOwner) && (
        <form onSubmit={onSubmit} className="panel grid gap-3 p-3 sm:p-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <p className="text-sm font-semibold">Submit closeout</p>
            <p className="text-xs text-muted-foreground">
              Pulls today&apos;s sales and current stock automatically, then notifies the owner.
            </p>
          </div>

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
            <Label>Date</Label>
            <DatePicker value={date} onChange={setDate} placeholder="Closeout date" />
          </div>

          <div className="space-y-1.5">
            <Label>Cash / transfer declared (ETB)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cashDeclared}
              onChange={(e) => setCashDeclared(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Opening / morning notes</Label>
            <Textarea
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="Any opening stock notes…"
              rows={2}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Closing notes</Label>
            <Textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Handwritten-style notes for the owner…"
              rows={3}
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit daily closeout"}
            </Button>
          </div>
        </form>
      )}

      <div className="panel space-y-3 p-3 sm:p-4">
        <p className="text-sm font-semibold">Closeout history</p>
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search store, status, notes…"
          filters={[
            {
              id: "status",
              label: "Status",
              icon: CircleDot,
              value: statusFilter,
              onChange: setStatusFilter,
              allLabel: "All statuses",
              options: [
                { value: "submitted", label: "Submitted" },
                { value: "reviewed", label: "Reviewed" },
                { value: "draft", label: "Draft" },
              ],
            },
          ]}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closeouts yet.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Cartons</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((c) => {
                    const actions = closeoutActions(c);
                    return (
                      <TableRow
                        key={c.id}
                        {...rowClickProps(() => setDetailsCloseout(c))}
                      >
                        <TableCell>{formatDate(c.closeout_date)}</TableCell>
                        <TableCell>{c.stores?.name}</TableCell>
                        <TableCell className="text-right font-figure">
                          {formatCurrency(Number(c.total_sales_amount))}
                        </TableCell>
                        <TableCell className="text-right font-figure">
                          {formatNumber(c.total_cartons_sold)}
                        </TableCell>
                        <TableCell className="text-right font-figure">
                          {formatCurrency(Number(c.cash_declared || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {c.status}
                          </Badge>
                        </TableCell>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-3 md:hidden">
              {pager.pageItems.map((c) => {
                const actions = closeoutActions(c);
                return (
                  <MobileRowCard
                    key={c.id}
                    onClick={() => setDetailsCloseout(c)}
                    title={c.stores?.name || "Closeout"}
                    trailing={formatCurrency(Number(c.total_sales_amount))}
                    fields={[
                      {
                        label: "Date",
                        value: formatDate(c.closeout_date),
                      },
                      {
                        label: "Status",
                        value: (
                          <Badge variant="secondary" className="capitalize">
                            {c.status}
                          </Badge>
                        ),
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
        open={!!detailsCloseout}
        onOpenChange={(open) => !open && setDetailsCloseout(null)}
        title="Closeout details"
        description={
          detailsCloseout
            ? `${detailsCloseout.stores?.name || "Store"} · ${formatDate(detailsCloseout.closeout_date)}`
            : undefined
        }
        fields={
          detailsCloseout
            ? [
                {
                  label: "Store",
                  value: detailsCloseout.stores?.name || "—",
                },
                {
                  label: "Date",
                  value: formatDate(detailsCloseout.closeout_date),
                },
                {
                  label: "Sales",
                  value: formatCurrency(
                    Number(detailsCloseout.total_sales_amount)
                  ),
                },
                {
                  label: "Cartons",
                  value: formatNumber(detailsCloseout.total_cartons_sold),
                },
                {
                  label: "Transactions",
                  value: formatNumber(detailsCloseout.total_transactions),
                },
                {
                  label: "Cash declared",
                  value: formatCurrency(
                    Number(detailsCloseout.cash_declared || 0)
                  ),
                },
                {
                  label: "Status",
                  value: (
                    <span className="capitalize">{detailsCloseout.status}</span>
                  ),
                },
              ]
            : []
        }
      />

      <Dialog
        open={!!notesCloseout}
        onOpenChange={(open) => !open && setNotesCloseout(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Closeout notes</DialogTitle>
            <DialogDescription>
              {notesCloseout?.stores?.name || "Store"} ·{" "}
              {notesCloseout
                ? formatDate(notesCloseout.closeout_date)
                : ""}
            </DialogDescription>
          </DialogHeader>
          {notesCloseout && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Opening notes
                </p>
                <p className="whitespace-pre-wrap">
                  {notesCloseout.opening_notes || "—"}
                </p>
              </div>
              <div className="space-y-1 border-t border-border/60 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Closing notes
                </p>
                <p className="whitespace-pre-wrap">
                  {notesCloseout.closing_notes || "—"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
