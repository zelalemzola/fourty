"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Download,
  MapPin,
  Pencil,
  Plus,
  Store as StoreIcon,
  CheckCircle2,
  Building2,
  CircleDot,
} from "lucide-react";
import {
  useGetStoresQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
} from "@/store/api/fourtyApi";
import type { Store } from "@/types/database";
import { PageHeader } from "@/components/layout/page-header";
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
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

type StoreForm = {
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  is_active: boolean;
};

const emptyForm: StoreForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  phone: "",
  is_active: true,
};

export default function StoresPage() {
  const { data: stores = [], isLoading } = useGetStoresQuery();
  const [createStore, { isLoading: creating }] = useCreateStoreMutation();
  const [updateStore, { isLoading: updating }] = useUpdateStoreMutation();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [detailsStore, setDetailsStore] = useState<Store | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState<StoreForm>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.city || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q);
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && s.is_active) ||
        (activeFilter === "inactive" && !s.is_active);
      return matchesSearch && matchesActive;
    });
  }, [stores, search, activeFilter]);

  const kpis = useMemo(() => {
    const active = stores.filter((s) => s.is_active).length;
    const cities = new Set(
      stores.map((s) => s.city).filter((c): c is string => Boolean(c))
    );
    return {
      total: stores.length,
      active,
      inactive: stores.length - active,
      cities: cities.size,
    };
  }, [stores]);

  const pager = usePagination(filtered, 10);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(store: Store) {
    setEditing(store);
    setForm({
      name: store.name,
      code: store.code,
      address: store.address || "",
      city: store.city || "",
      phone: store.phone || "",
      is_active: store.is_active,
    });
    setDialogOpen(true);
  }

  async function toggleActive(store: Store) {
    try {
      await updateStore({
        id: store.id,
        is_active: !store.is_active,
      }).unwrap();
      toast.success(
        store.is_active ? "Store deactivated" : "Store activated"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  function storeActions(store: Store) {
    return [
      {
        label: "Edit",
        icon: <Pencil className="size-4" />,
        onClick: () => openEdit(store),
      },
      {
        label: store.is_active ? "Deactivate" : "Activate",
        icon: store.is_active ? (
          <Ban className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" />
        ),
        variant: store.is_active ? ("destructive" as const) : undefined,
        separatorBefore: true,
        onClick: () => toggleActive(store),
      },
    ];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await updateStore({ id: editing.id, ...payload }).unwrap();
        toast.success("Store updated");
      } else {
        await createStore(payload).unwrap();
        toast.success("Store created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleExport() {
    await exportToExcel(
      filtered.map((s) => ({
        name: s.name,
        code: s.code,
        address: s.address || "",
        city: s.city || "",
        phone: s.phone || "",
        is_active: s.is_active ? "yes" : "no",
      })),
      `stores-${new Date().toISOString().slice(0, 10)}`,
      "Stores"
    );
    toast.success("Exported stores");
  }

  const saving = creating || updating;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stores"
        description="Manage distribution locations, contact details, and active status."
        icon={StoreIcon}
        actions={
          <>
            <Button variant="outline" onClick={handleExport} className="hidden sm:inline-flex">
              <Download className="size-4" />
              Export
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add store
            </Button>
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          title="Total stores"
          value={formatNumber(kpis.total)}
          icon={Building2}
          featured
        />
        <KpiCard
          title="Active"
          value={formatNumber(kpis.active)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          title="Inactive"
          value={formatNumber(kpis.inactive)}
          icon={StoreIcon}
          tone="warn"
        />
        <KpiCard
          title="Cities"
          value={formatNumber(kpis.cities)}
          icon={MapPin}
          tone="accent"
        />
      </KpiGrid>

      <div className="panel space-y-3 rounded-lg p-3 sm:p-4">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, code, city…"
          filters={[
            {
              id: "active",
              label: "Status",
              icon: CircleDot,
              value: activeFilter,
              onChange: setActiveFilter,
              allLabel: "All statuses",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">
            No stores found.
          </div>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {pager.pageItems.map((store) => (
                <MobileRowCard
                  key={store.id}
                  onClick={() => setDetailsStore(store)}
                  title={store.name}
                  trailing={store.code}
                  fields={[
                    { label: "City", value: store.city || "—" },
                    {
                      label: "Status",
                      value: (
                        <Badge
                          variant={store.is_active ? "secondary" : "outline"}
                        >
                          {store.is_active ? "Active" : "Inactive"}
                        </Badge>
                      ),
                    },
                  ]}
                  actions={<RowActions actions={storeActions(store)} />}
                />
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((store) => (
                    <TableRow
                      key={store.id}
                      {...rowClickProps(() => setDetailsStore(store))}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{store.name}</p>
                          {store.address && (
                            <p className="text-xs text-muted-foreground">
                              {store.address}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {store.code}
                      </TableCell>
                      <TableCell>{store.city || "—"}</TableCell>
                      <TableCell>{store.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={store.is_active ? "secondary" : "outline"}
                        >
                          {store.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={storeActions(store)} />
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
        open={!!detailsStore}
        onOpenChange={(open) => !open && setDetailsStore(null)}
        title="Store details"
        description={detailsStore?.name}
        fields={
          detailsStore
            ? [
                { label: "Name", value: detailsStore.name },
                { label: "Code", value: detailsStore.code },
                { label: "City", value: detailsStore.city || "—" },
                { label: "Phone", value: detailsStore.phone || "—" },
                {
                  label: "Address",
                  value: detailsStore.address || "—",
                  fullWidth: true,
                },
                {
                  label: "Status",
                  value: detailsStore.is_active ? "Active" : "Inactive",
                },
              ]
            : []
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit store" : "Add store"}
              </DialogTitle>
              <DialogDescription>
                Location details used across inventory, sales, and reports.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="store-name">Name</Label>
                <Input
                  id="store-name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-code">Code</Label>
                <Input
                  id="store-code"
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-address">Address</Label>
                <Input
                  id="store-address"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="store-city">City</Label>
                  <Input
                    id="store-city"
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store-phone">Phone</Label>
                  <Input
                    id="store-phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <Label htmlFor="store-active">Active</Label>
                <Switch
                  id="store-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, is_active: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create store"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
