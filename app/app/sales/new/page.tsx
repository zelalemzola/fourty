"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { Camera, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import {
  useCreateSaleMutation,
  useGetBrandsQuery,
  useGetStoresQuery,
  useGetBatchesQuery,
  useGetInventoryQuery,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
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
import { formatCurrency, formatNumber } from "@/lib/format";

export default function NewSalePage() {
  const router = useRouter();
  const profile = useSelector((s: RootState) => s.auth.profile);
  const isOwner = profile?.role === "owner";
  const isStorekeeper = profile?.role === "storekeeper";
  const isSubagent = profile?.role === "subagent";

  const { data: stores = [] } = useGetStoresQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: batches = [] } = useGetBatchesQuery(
    isSubagent && profile?.id
      ? { subagentId: profile.id }
      : undefined,
    { skip: !isSubagent }
  );

  const [storeId, setStoreId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [createSale, { isLoading }] = useCreateSaleMutation();

  useEffect(() => {
    if (isStorekeeper && profile?.store_id) {
      setStoreId(profile.store_id);
    }
  }, [isStorekeeper, profile?.store_id]);

  const activeBatches = useMemo(
    () =>
      batches.filter(
        (b) =>
          ["active", "partially_returned", "overdue"].includes(b.status) &&
          b.quantity_in_hand > 0
      ),
    [batches]
  );

  const selectedBatch = activeBatches.find((b) => b.id === batchId);

  useEffect(() => {
    if (!isSubagent || !selectedBatch) return;
    setStoreId(selectedBatch.store_id);
    setBrandId(selectedBatch.brand_id);
    const price = selectedBatch.brands?.unit_price;
    if (price != null) setUnitPrice(String(price));
  }, [isSubagent, selectedBatch]);

  const selectedBrand = brands.find((b) => b.id === brandId);

  useEffect(() => {
    if (isSubagent) return;
    if (selectedBrand) setUnitPrice(String(selectedBrand.unit_price));
  }, [selectedBrand, isSubagent]);

  const { data: inventory = [] } = useGetInventoryQuery(
    storeId ? { storeId } : undefined,
    { skip: !storeId || isSubagent }
  );

  const availableStock = useMemo(() => {
    if (isSubagent && selectedBatch) return selectedBatch.quantity_in_hand;
    const row = inventory.find((i) => i.brand_id === brandId);
    return row?.quantity ?? 0;
  }, [isSubagent, selectedBatch, inventory, brandId]);

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const total = qty * price;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!screenshot) {
      toast.error("Screenshot proof is required");
      return;
    }
    if (!storeId || !brandId) {
      toast.error("Store and brand are required");
      return;
    }
    if (isSubagent && !batchId) {
      toast.error("Select an active batch");
      return;
    }
    if (qty <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (price <= 0) {
      toast.error("Unit price must be greater than zero");
      return;
    }
    if (qty > availableStock) {
      toast.error(
        isSubagent
          ? "Insufficient batch stock"
          : "Insufficient store inventory"
      );
      return;
    }

    try {
      await createSale({
        store_id: storeId,
        brand_id: brandId,
        quantity: qty,
        unit_price: price,
        notes: notes.trim() || undefined,
        screenshot,
        channel: isSubagent ? "subagent" : "store",
        batch_id: isSubagent ? batchId : undefined,
        subagent_id: isSubagent ? profile?.id : undefined,
      }).unwrap();
      toast.success("Sale recorded");
      router.push("/app/sales");
    } catch (err) {
      const message =
        typeof err === "object" &&
        err &&
        "data" in err &&
        typeof (err as { data?: unknown }).data === "string"
          ? (err as { data: string }).data
          : err instanceof Error
            ? err.message
            : "Failed to record sale";
      toast.error(message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="New sale"
        description={
          isSubagent
            ? "Sell from an active batch and attach payment proof."
            : "Deduct store inventory and attach a screenshot for audit."
        }
        icon={ShoppingCart}
      />

      <form onSubmit={onSubmit} className="panel space-y-4 p-3 sm:p-5">
        {isSubagent ? (
          <div className="space-y-1.5">
            <Label>Active batch</Label>
            <Select
              value={batchId || undefined}
              onValueChange={(v) => setBatchId(v ?? "")}
            >
              <SelectTrigger className="w-full bg-background/70">
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {activeBatches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.brands?.name || "Brand"} · {b.stores?.name} ·{" "}
                    {formatNumber(b.quantity_in_hand)} on hand
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeBatches.length === 0 && (
              <p className="text-xs text-amber-700">
                No active batches with stock. Ask a storekeeper to issue one.
              </p>
            )}
            {selectedBatch && (
              <p className="text-xs text-muted-foreground">
                Channel locked to subagent · store & brand come from the batch
              </p>
            )}
          </div>
        ) : (
          <>
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
              {brandId && (
                <p className="text-xs text-muted-foreground">
                  Available: {formatNumber(availableStock)} cartons
                </p>
              )}
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity (cartons)</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={availableStock || undefined}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-background/70"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit_price">Unit price (ETB)</Label>
            <Input
              id="unit_price"
              type="number"
              min={0}
              step="0.01"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="bg-background/70"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-primary/5 px-3 py-2.5 text-sm">
          Total · <span className="font-semibold">{formatCurrency(total)}</span>
          {!isSubagent && (
            <span className="text-muted-foreground"> · channel: store</span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context for this sale"
            className="bg-background/70"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="screenshot">
            Screenshot proof <span className="text-destructive">*</span>
          </Label>
          <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-4">
            <label
              htmlFor="screenshot"
              className="flex cursor-pointer flex-col items-center gap-2 text-center"
            >
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Camera className="size-5" />
              </div>
              <span className="text-sm font-medium">
                {screenshot ? screenshot.name : "Tap to upload payment proof"}
              </span>
              <span className="text-xs text-muted-foreground">
                JPG, PNG, or WebP · required for audit
              </span>
            </label>
            <Input
              id="screenshot"
              type="file"
              accept="image/*"
              required
              className="sr-only"
              onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
            />
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Screenshot preview"
                className="mt-3 max-h-48 w-full rounded-lg object-contain ring-1 ring-border"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/app/sales")}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Record sale"}
          </Button>
        </div>
      </form>
    </div>
  );
}
