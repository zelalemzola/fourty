"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Cigarette,
  Download,
  Pencil,
  Plus,
  CheckCircle2,
  Package,
  Banknote,
  CircleDot,
} from "lucide-react";
import {
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
} from "@/store/api/fourtyApi";
import type { Brand } from "@/types/database";
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
import { Textarea } from "@/components/ui/textarea";
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
import { formatCurrency, formatNumber } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

type BrandForm = {
  name: string;
  sku: string;
  description: string;
  carton_size: string;
  unit_price: string;
  cost_price: string;
  is_active: boolean;
};

const emptyForm: BrandForm = {
  name: "",
  sku: "",
  description: "",
  carton_size: "10",
  unit_price: "",
  cost_price: "",
  is_active: true,
};

export default function BrandsPage() {
  const { data: brands = [], isLoading } = useGetBrandsQuery();
  const [createBrand, { isLoading: creating }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: updating }] = useUpdateBrandMutation();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [detailsBrand, setDetailsBrand] = useState<Brand | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandForm>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands.filter((b) => {
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.sku || "").toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q);
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && b.is_active) ||
        (activeFilter === "inactive" && !b.is_active);
      return matchesSearch && matchesActive;
    });
  }, [brands, search, activeFilter]);

  const kpis = useMemo(() => {
    const active = brands.filter((b) => b.is_active).length;
    const avgPrice =
      brands.length === 0
        ? 0
        : brands.reduce((sum, b) => sum + (b.unit_price || 0), 0) /
          brands.length;
    const catalogValue = brands.reduce(
      (sum, b) => sum + (b.unit_price || 0),
      0
    );
    return {
      total: brands.length,
      active,
      avgPrice,
      catalogValue,
    };
  }, [brands]);

  const pager = usePagination(filtered, 10);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setForm({
      name: brand.name,
      sku: brand.sku || "",
      description: brand.description || "",
      carton_size: String(brand.carton_size ?? 10),
      unit_price: String(brand.unit_price ?? ""),
      cost_price: String(brand.cost_price ?? ""),
      is_active: brand.is_active,
    });
    setDialogOpen(true);
  }

  async function toggleActive(brand: Brand) {
    try {
      await updateBrand({
        id: brand.id,
        is_active: !brand.is_active,
      }).unwrap();
      toast.success(
        brand.is_active ? "Brand deactivated" : "Brand activated"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  function brandActions(brand: Brand) {
    return [
      {
        label: "Edit",
        icon: <Pencil className="size-4" />,
        onClick: () => openEdit(brand),
      },
      {
        label: brand.is_active ? "Deactivate" : "Activate",
        icon: brand.is_active ? (
          <Ban className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" />
        ),
        variant: brand.is_active ? ("destructive" as const) : undefined,
        separatorBefore: true,
        onClick: () => toggleActive(brand),
      },
    ];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const cartonSize = Number(form.carton_size);
    const unitPrice = Number(form.unit_price);
    const costPrice = Number(form.cost_price);
    if (!Number.isFinite(cartonSize) || cartonSize <= 0) {
      toast.error("Enter a valid carton size");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Enter a valid unit price");
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      toast.error("Enter a valid cost price");
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      carton_size: cartonSize,
      unit_price: unitPrice,
      cost_price: costPrice,
      image_url: editing?.image_url ?? null,
      is_active: form.is_active,
    };

    try {
      if (editing) {
        await updateBrand({ id: editing.id, ...payload }).unwrap();
        toast.success("Brand updated");
      } else {
        await createBrand(payload).unwrap();
        toast.success("Brand created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleExport() {
    await exportToExcel(
      filtered.map((b) => ({
        name: b.name,
        sku: b.sku || "",
        description: b.description || "",
        carton_size: b.carton_size,
        unit_price: b.unit_price,
        cost_price: b.cost_price,
        is_active: b.is_active ? "yes" : "no",
      })),
      `brands-${new Date().toISOString().slice(0, 10)}`,
      "Brands"
    );
    toast.success("Exported brands");
  }

  const saving = creating || updating;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Brands"
        description="Catalog of cigarette brands with carton sizing and pricing."
        icon={Cigarette}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add brand
            </Button>
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          title="Total brands"
          value={formatNumber(kpis.total)}
          icon={Package}
        />
        <KpiCard
          title="Active"
          value={formatNumber(kpis.active)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          title="Avg unit price"
          value={formatCurrency(kpis.avgPrice)}
          icon={Banknote}
          tone="accent"
        />
        <KpiCard
          title="Catalog list price"
          value={formatCurrency(kpis.catalogValue)}
          icon={Banknote}
          hint="Sum of unit prices"
        />
      </KpiGrid>

      <div className="panel space-y-3 rounded-lg p-3 sm:p-4">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, SKU, description…"
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
            No brands found.
          </div>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {pager.pageItems.map((brand) => (
                <MobileRowCard
                  key={brand.id}
                  onClick={() => setDetailsBrand(brand)}
                  fields={[
                    { label: "Name", value: brand.name },
                    { label: "SKU", value: brand.sku || "—" },
                    {
                      label: "Unit price",
                      value: formatCurrency(brand.unit_price),
                    },
                    {
                      label: "Status",
                      value: (
                        <Badge
                          variant={brand.is_active ? "secondary" : "outline"}
                        >
                          {brand.is_active ? "Active" : "Inactive"}
                        </Badge>
                      ),
                    },
                  ]}
                  actions={<RowActions actions={brandActions(brand)} />}
                />
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Carton</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((brand) => (
                    <TableRow
                      key={brand.id}
                      {...rowClickProps(() => setDetailsBrand(brand))}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{brand.name}</p>
                          {brand.description && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {brand.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {brand.sku || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(brand.carton_size)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(brand.unit_price)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(brand.cost_price)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={brand.is_active ? "secondary" : "outline"}
                        >
                          {brand.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={brandActions(brand)} />
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
        open={!!detailsBrand}
        onOpenChange={(open) => !open && setDetailsBrand(null)}
        title="Brand details"
        description={detailsBrand?.sku || undefined}
        fields={
          detailsBrand
            ? [
                { label: "Name", value: detailsBrand.name },
                { label: "SKU", value: detailsBrand.sku || "—" },
                {
                  label: "Carton size",
                  value: formatNumber(detailsBrand.carton_size),
                },
                {
                  label: "Unit price",
                  value: formatCurrency(detailsBrand.unit_price),
                },
                {
                  label: "Cost",
                  value: formatCurrency(detailsBrand.cost_price),
                },
                {
                  label: "Status",
                  value: detailsBrand.is_active ? "Active" : "Inactive",
                },
                ...(detailsBrand.description
                  ? [
                      {
                        label: "Description",
                        value: detailsBrand.description,
                        fullWidth: true,
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit brand" : "Add brand"}
              </DialogTitle>
              <DialogDescription>
                Pricing and carton size used for sales and inventory.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">Name</Label>
                <Input
                  id="brand-name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-sku">SKU</Label>
                <Input
                  id="brand-sku"
                  value={form.sku}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sku: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-desc">Description</Label>
                <Textarea
                  id="brand-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="brand-carton">Carton size</Label>
                  <Input
                    id="brand-carton"
                    type="number"
                    min={1}
                    required
                    value={form.carton_size}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, carton_size: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-unit">Unit price</Label>
                  <Input
                    id="brand-unit"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.unit_price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit_price: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-cost">Cost price</Label>
                  <Input
                    id="brand-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cost_price: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <Label htmlFor="brand-active">Active</Label>
                <Switch
                  id="brand-active"
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
                {saving ? "Saving…" : editing ? "Save changes" : "Create brand"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
