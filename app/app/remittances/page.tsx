"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Banknote,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  XCircle,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { Remittance } from "@/types/database";
import {
  useCreateRemittanceMutation,
  useGetRemittancesQuery,
  useGetStoresQuery,
  useUpdateRemittanceStatusMutation,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { GlobalFilters } from "@/components/filters/global-filters";
import { DataTableToolbar } from "@/components/table/data-table-toolbar";
import { MobileRowCard } from "@/components/table/mobile-row-card";
import {
  RowDetailsDialog,
  rowClickProps,
} from "@/components/table/row-details-dialog";
import { ProofViewer } from "@/components/proof/proof-viewer";
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
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions, type RowAction } from "@/components/table/row-actions";

export default function RemittancesPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const storeFilter = useSelector((s: RootState) => s.ui.storeFilter);
  const isOwner = profile?.role === "owner";
  const isSubagent = profile?.role === "subagent";

  const scopedStore = profile?.store_id || "";
  const [storeId, setStoreId] = useState(scopedStore);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailsRemittance, setDetailsRemittance] =
    useState<Remittance | null>(null);

  const { data: stores = [] } = useGetStoresQuery();
  const { data: remittances = [], isLoading } = useGetRemittancesQuery({
    storeId: isOwner ? storeFilter : profile?.store_id || undefined,
  });
  const [createRemittance, { isLoading: saving }] = useCreateRemittanceMutation();
  const [updateStatus] = useUpdateRemittanceStatusMutation();

  const pending = remittances.filter((r) => r.status === "pending");
  const confirmedAmt = remittances
    .filter((r) => r.status === "confirmed")
    .reduce((s, r) => s + Number(r.amount), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return remittances.filter((r) => {
      const matchesStatus =
        statusFilter === "all" || r.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      const hay = [
        r.stores?.name || "",
        r.method || "",
        r.reference_code || "",
        r.notes || "",
        r.status || "",
        String(r.amount),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [remittances, search, statusFilter]);

  const pager = usePagination(filtered, 10);
  const canReview = isOwner || profile?.role === "storekeeper";

  async function setStatus(id: string, status: "confirmed" | "rejected") {
    try {
      await updateStatus({ id, status }).unwrap();
      toast.success(status === "confirmed" ? "Confirmed" : "Rejected");
    } catch {
      toast.error("Failed");
    }
  }

  function remittanceActions(r: Remittance): RowAction[] {
    const actions: RowAction[] = [
      {
        label: "Details",
        icon: <Eye className="size-4" />,
        onClick: () => setDetailsRemittance(r),
      },
    ];
    if (r.proof_url) {
      actions.push({
        label: "View proof",
        icon: <ExternalLink className="size-4" />,
        onClick: () => setProofUrl(r.proof_url!),
      });
    }
    if (canReview && r.status === "pending") {
      actions.push({
        label: "Confirm",
        icon: <CheckCircle2 className="size-4" />,
        separatorBefore: true,
        onClick: () => setStatus(r.id, "confirmed"),
      });
      actions.push({
        label: "Reject",
        icon: <XCircle className="size-4" />,
        variant: "destructive",
        onClick: () => setStatus(r.id, "rejected"),
      });
    }
    return actions;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sid = storeId || scopedStore;
    const amt = Number(amount);
    if (!sid || !amt) {
      toast.error("Store and amount are required");
      return;
    }
    try {
      await createRemittance({
        store_id: sid,
        amount: amt,
        method,
        reference_code: reference,
        notes,
        subagent_id: isSubagent ? profile?.id : undefined,
        proof,
      }).unwrap();
      toast.success("Remittance submitted");
      setAmount("");
      setReference("");
      setNotes("");
      setProof(null);
    } catch (err) {
      toast.error(
        typeof err === "object" && err && "data" in err
          ? String((err as { data: unknown }).data)
          : "Submit failed"
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Remittances"
        description="Record money sent to the company account — with reference and optional proof — for store and subagent settlements."
        icon={Banknote}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await exportToExcel(
                remittances.map((r) => ({
                  date: r.created_at,
                  store: r.stores?.name,
                  amount: r.amount,
                  method: r.method,
                  reference: r.reference_code,
                  status: r.status,
                })),
                "remittances",
                "Remittances"
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
        <KpiCard title="Total records" value={formatNumber(remittances.length)} icon={Banknote} />
        <KpiCard title="Pending review" value={formatNumber(pending.length)} icon={Banknote} tone="warn" />
        <KpiCard title="Confirmed amount" value={formatCurrency(confirmedAmt)} icon={Banknote} tone="success" />
      </KpiGrid>

      <form onSubmit={onSubmit} className="panel grid gap-3 p-3 sm:p-4 md:grid-cols-2">
        <p className="text-sm font-semibold md:col-span-2">Submit remittance</p>

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
          <Label>Amount (ETB)</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v ?? "bank_transfer")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              <SelectItem value="mobile_money">Mobile money</SelectItem>
              <SelectItem value="cash_deposit">Cash deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Reference / transaction ID</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Proof screenshot (optional)</Label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setProof(e.target.files?.[0] || null)}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="md:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Submitting…" : "Submit remittance"}
          </Button>
        </div>
      </form>

      <div className="panel space-y-3 p-3 sm:p-4">
        <p className="text-sm font-semibold">History</p>
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search store, method, reference…"
          filters={[
            {
              id: "status",
              label: "Status",
              icon: CircleDot,
              value: statusFilter,
              onChange: setStatusFilter,
              allLabel: "All statuses",
              options: [
                { value: "pending", label: "Pending" },
                { value: "confirmed", label: "Confirmed" },
                { value: "rejected", label: "Rejected" },
              ],
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
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((r) => {
                    const actions = remittanceActions(r);
                    return (
                      <TableRow
                        key={r.id}
                        {...rowClickProps(() => setDetailsRemittance(r))}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(r.created_at)}
                        </TableCell>
                        <TableCell>{r.stores?.name}</TableCell>
                        <TableCell className="text-right font-figure">
                          {formatCurrency(Number(r.amount))}
                        </TableCell>
                        <TableCell className="capitalize">
                          {r.method.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {r.status}
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
            <ul className="space-y-2 md:hidden">
              {pager.pageItems.map((r) => {
                const actions = remittanceActions(r);
                return (
                  <MobileRowCard
                    key={r.id}
                    onClick={() => setDetailsRemittance(r)}
                    fields={[
                      {
                        label: "Amount",
                        value: formatCurrency(Number(r.amount)),
                      },
                      { label: "Store", value: r.stores?.name || "—" },
                      {
                        label: "Method",
                        value: (
                          <span className="capitalize">
                            {r.method.replace(/_/g, " ")}
                          </span>
                        ),
                      },
                      {
                        label: "Status",
                        value: (
                          <Badge variant="secondary" className="capitalize">
                            {r.status}
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
        open={!!detailsRemittance}
        onOpenChange={(open) => !open && setDetailsRemittance(null)}
        title="Remittance details"
        description={
          detailsRemittance
            ? formatDateTime(detailsRemittance.created_at)
            : undefined
        }
        fields={
          detailsRemittance
            ? [
                {
                  label: "Store",
                  value: detailsRemittance.stores?.name || "—",
                },
                {
                  label: "Amount",
                  value: formatCurrency(Number(detailsRemittance.amount)),
                },
                {
                  label: "Method",
                  value: (
                    <span className="capitalize">
                      {detailsRemittance.method.replace(/_/g, " ")}
                    </span>
                  ),
                },
                {
                  label: "Reference",
                  value: detailsRemittance.reference_code || "—",
                },
                {
                  label: "Status",
                  value: (
                    <span className="capitalize">
                      {detailsRemittance.status}
                    </span>
                  ),
                },
                {
                  label: "Notes",
                  value: detailsRemittance.notes || "—",
                  fullWidth: true,
                },
              ]
            : []
        }
        footer={
          detailsRemittance?.proof_url ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProofUrl(detailsRemittance.proof_url!)}
            >
              View proof
            </Button>
          ) : undefined
        }
      />

      <ProofViewer
        url={proofUrl}
        open={!!proofUrl}
        onOpenChange={(open) => !open && setProofUrl(null)}
        title="Remittance proof"
      />
    </div>
  );
}
