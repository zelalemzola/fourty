"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Download,
  Eye,
  Shield,
  Activity,
  Users,
  CalendarDays,
  Building2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { isToday, parseISO } from "date-fns";
import type { RootState } from "@/store";
import type { AuditLog } from "@/types/database";
import { useGetAuditLogsQuery, useGetStoresQuery } from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatDateTime } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

export default function AuditPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const isOwner = profile?.role === "owner";

  const [actionSearch, setActionSearch] = useState("");
  const [storeId, setStoreId] = useState<string>("all");
  const [actionType, setActionType] = useState("all");
  const [detailsLog, setDetailsLog] = useState<AuditLog | null>(null);

  const { data: stores = [] } = useGetStoresQuery(undefined, { skip: !isOwner });
  const { data: logs = [], isLoading } = useGetAuditLogsQuery(
    { storeId, limit: 300 },
    { skip: !isOwner }
  );

  const actionOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return Array.from(set)
      .sort()
      .map((a) => ({ value: a, label: a }));
  }, [logs]);

  const filtered = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    return logs.filter((row) => {
      const matchesAction =
        actionType === "all" || row.action === actionType;
      if (!matchesAction) return false;
      if (!q) return true;
      const hay = [
        row.action,
        row.entity_type,
        row.actor_name || "",
        row.actor_role || "",
        row.stores?.name || "",
        JSON.stringify(row.details || {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, actionSearch, actionType]);

  const kpis = useMemo(() => {
    const actors = new Set(
      filtered.map((l) => l.actor_id || l.actor_name).filter(Boolean)
    );
    const today = filtered.filter((l) => {
      try {
        return isToday(parseISO(l.created_at));
      } catch {
        return false;
      }
    }).length;
    return {
      total: filtered.length,
      actors: actors.size,
      today,
    };
  }, [filtered]);

  const pager = usePagination(filtered, 10);

  function auditActions(row: AuditLog) {
    return [
      {
        label: "View details",
        icon: <Eye className="size-4" />,
        onClick: () => setDetailsLog(row),
      },
    ];
  }

  async function handleExport() {
    try {
      await exportToExcel(
        filtered.map((l) => ({
          created_at: l.created_at,
          actor: l.actor_name || "",
          role: l.actor_role || "",
          action: l.action,
          entity_type: l.entity_type,
          entity_id: l.entity_id || "",
          store: l.stores?.name || "",
          details: JSON.stringify(l.details || {}),
          ip: l.ip_address || "",
        })),
        `fourty-audit-${new Date().toISOString().slice(0, 10)}`,
        "Audit"
      );
      toast.success("Audit log exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  if (profile && !isOwner) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Audit trail is available to owners only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit trail"
        description="Immutable event history across inventory, sales, batches, and team changes."
        icon={Shield}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!filtered.length}
          >
            <Download className="size-4" />
            Export
          </Button>
        }
      />

      <KpiGrid cols={3}>
        <KpiCard
          title="Events"
          value={formatNumber(kpis.total)}
          icon={Activity}
          tone="accent"
        />
        <KpiCard
          title="Unique actors"
          value={formatNumber(kpis.actors)}
          icon={Users}
        />
        <KpiCard
          title="Today"
          value={formatNumber(kpis.today)}
          icon={CalendarDays}
          tone="success"
        />
      </KpiGrid>

      <div className="panel space-y-3 p-3 sm:p-4">
        <DataTableToolbar
          search={actionSearch}
          onSearchChange={setActionSearch}
          searchPlaceholder="Action, actor, entity…"
          filters={[
            {
              id: "store",
              label: "Store",
              icon: Building2,
              value: storeId,
              onChange: setStoreId,
              options: [
                { value: "all", label: "All stores" },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
              ],
            },
            {
              id: "action",
              label: "Action",
              icon: Zap,
              value: actionType,
              onChange: setActionType,
              allLabel: "All actions",
              options: actionOptions,
            },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No audit events match these filters.
          </p>
        ) : (
          <>
            <ul className="space-y-2 lg:hidden">
              {pager.pageItems.map((row) => (
                <MobileRowCard
                  key={row.id}
                  onClick={() => setDetailsLog(row)}
                  fields={[
                    { label: "Action", value: row.action },
                    {
                      label: "Entity",
                      value: (
                        <Badge variant="outline">{row.entity_type}</Badge>
                      ),
                    },
                    {
                      label: "Actor",
                      value: row.actor_name || "System",
                    },
                    {
                      label: "When",
                      value: formatDateTime(row.created_at),
                      fullWidth: true,
                    },
                  ]}
                  actions={<RowActions actions={auditActions(row)} />}
                />
              ))}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((row) => (
                    <TableRow
                      key={row.id}
                      {...rowClickProps(() => setDetailsLog(row))}
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {row.actor_name || "System"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.actor_role || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {row.action}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div>{row.entity_type}</div>
                        <div className="max-w-[140px] truncate text-xs text-muted-foreground">
                          {row.entity_id || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{row.stores?.name || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {Object.keys(row.details || {}).length
                          ? JSON.stringify(row.details)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={auditActions(row)} />
                      </TableCell>
                    </TableRow>
                  ))}
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
        open={!!detailsLog}
        onOpenChange={(open) => !open && setDetailsLog(null)}
        title="Audit event details"
        description={
          detailsLog
            ? `${detailsLog.action} · ${formatDateTime(detailsLog.created_at)}`
            : undefined
        }
        fields={
          detailsLog
            ? [
                {
                  label: "Actor",
                  value: `${detailsLog.actor_name || "System"}${
                    detailsLog.actor_role ? ` · ${detailsLog.actor_role}` : ""
                  }`,
                },
                {
                  label: "Entity",
                  value: `${detailsLog.entity_type}${
                    detailsLog.entity_id ? ` · ${detailsLog.entity_id}` : ""
                  }`,
                },
                { label: "Store", value: detailsLog.stores?.name || "—" },
                ...(detailsLog.ip_address
                  ? [{ label: "IP", value: detailsLog.ip_address }]
                  : []),
                {
                  label: "Details JSON",
                  value: (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-xs font-normal">
                      {JSON.stringify(detailsLog.details || {}, null, 2)}
                    </pre>
                  ),
                  fullWidth: true,
                },
              ]
            : []
        }
      />
    </div>
  );
}
