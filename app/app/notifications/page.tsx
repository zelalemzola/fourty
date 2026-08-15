"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  MailOpen,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import type { AppNotification } from "@/types/database";
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/table/data-table-toolbar";
import { MobileRowCard } from "@/components/table/mobile-row-card";
import { RowDetailsDialog } from "@/components/table/row-details-dialog";
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatRelative, formatDateTime } from "@/lib/format";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useGetNotificationsQuery();
  const [markRead, { isLoading: marking }] = useMarkNotificationReadMutation();
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState("all");
  const [detailsNotif, setDetailsNotif] = useState<AppNotification | null>(
    null
  );

  const kpis = useMemo(() => {
    const unread = notifications.filter((n) => !n.is_read).length;
    const read = notifications.length - unread;
    const types = new Set(notifications.map((n) => n.type)).size;
    return { total: notifications.length, unread, read, types };
  }, [notifications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((n) => {
      const matchesRead =
        readFilter === "all" ||
        (readFilter === "unread" && !n.is_read) ||
        (readFilter === "read" && n.is_read);
      if (!matchesRead) return false;
      if (!q) return true;
      const hay = [n.title, n.body, n.type]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [notifications, search, readFilter]);

  const pager = usePagination(filtered, 10);

  async function markOne(id: string) {
    try {
      await markRead(id).unwrap();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark read");
    }
  }

  async function markAll() {
    try {
      await markRead("all").unwrap();
      toast.success("All notifications marked read");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark all");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Sales, restocks, batches, low stock, and system alerts."
        icon={Bell}
        actions={
          <Button
            variant="outline"
            onClick={markAll}
            disabled={marking || kpis.unread === 0}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        }
      />

      <KpiGrid>
        <KpiCard
          title="Unread"
          value={formatNumber(kpis.unread)}
          icon={Bell}
          tone={kpis.unread > 0 ? "accent" : "success"}
        />
        <KpiCard
          title="Read"
          value={formatNumber(kpis.read)}
          icon={MailOpen}
          fill="navySoft"
        />
        <KpiCard
          title="Total"
          value={formatNumber(kpis.total)}
          icon={BellOff}
        />
        <KpiCard
          title="Types"
          value={formatNumber(kpis.types)}
          icon={Bell}
          hint="Distinct alert categories"
          fill="coral"
        />
      </KpiGrid>

      <div className="panel space-y-3 p-3 sm:p-4">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search title, body, type…"
          filters={[
            {
              id: "read",
              label: "Read",
              icon: Mail,
              value: readFilter,
              onChange: setReadFilter,
              allLabel: "All",
              options: [
                { value: "unread", label: "Unread" },
                { value: "read", label: "Read" },
              ],
            },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            You&apos;re all caught up — no notifications yet.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {pager.pageItems.map((n) => (
                <MobileRowCard
                  key={n.id}
                  className={n.is_read ? "bg-background/40" : "bg-primary/5"}
                  onClick={() => {
                    setDetailsNotif(n);
                    if (!n.is_read) void markOne(n.id);
                  }}
                  title={n.title}
                  trailing={formatRelative(n.created_at)}
                  fields={[
                    {
                      label: "Type",
                      value: (
                        <Badge variant="outline" className="capitalize">
                          {n.type}
                        </Badge>
                      ),
                    },
                    {
                      label: "Body",
                      value: n.body,
                      fullWidth: true,
                    },
                  ]}
                  actions={
                    <div className="flex gap-2">
                      {n.link && (
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={n.link} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.is_read) void markOne(n.id);
                          }}
                        >
                          Open
                        </Button>
                      )}
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={marking}
                          onClick={(e) => {
                            e.stopPropagation();
                            void markOne(n.id);
                          }}
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  }
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
        open={!!detailsNotif}
        onOpenChange={(open) => !open && setDetailsNotif(null)}
        title="Notification"
        description={
          detailsNotif ? formatDateTime(detailsNotif.created_at) : undefined
        }
        fields={
          detailsNotif
            ? [
                { label: "Title", value: detailsNotif.title },
                {
                  label: "Type",
                  value: (
                    <span className="capitalize">{detailsNotif.type}</span>
                  ),
                },
                {
                  label: "Status",
                  value: detailsNotif.is_read ? "Read" : "Unread",
                },
                {
                  label: "Body",
                  value: detailsNotif.body,
                  fullWidth: true,
                },
                {
                  label: "When",
                  value: formatDateTime(detailsNotif.created_at),
                },
              ]
            : []
        }
        footer={
          detailsNotif?.link ? (
            <Button
              type="button"
              variant="secondary"
              render={<Link href={detailsNotif.link} />}
              onClick={() => {
                if (!detailsNotif.is_read) void markOne(detailsNotif.id);
              }}
            >
              <ExternalLink className="size-4" />
              Open link
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
