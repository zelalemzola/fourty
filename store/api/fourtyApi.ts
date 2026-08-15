import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { createClient } from "@/lib/supabase/client";
import { resolveDateRange, previousPeriod } from "@/lib/date-range";
import { percentChange } from "@/lib/format";
import type {
  AuditLog,
  AppNotification,
  Brand,
  DashboardStats,
  DateRangeFilter,
  DailyCloseout,
  InventoryItem,
  MinStockUpdate,
  Profile,
  Remittance,
  Restock,
  Sale,
  StockAdjustment,
  Store,
  SubagentBatch,
  UserPreferences,
  OrganizationSettings,
  PushDevice,
  UserRole,
} from "@/types/database";

async function uploadScreenshot(file: File, saleId: string) {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${saleId}.${ext}`;
  const { error } = await supabase.storage
    .from("sale-screenshots")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("sale-screenshots").getPublicUrl(path);
  return data.publicUrl;
}

export const fourtyApi = createApi({
  reducerPath: "fourtyApi",
  baseQuery: fakeBaseQuery(),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: [
    "Profile",
    "Stores",
    "Brands",
    "Inventory",
    "Sales",
    "Restocks",
    "Batches",
    "Notifications",
    "Audit",
    "Dashboard",
    "Users",
    "Closeouts",
    "Adjustments",
    "Remittances",
    "Preferences",
    "OrgSettings",
    "PushDevices",
  ],
  endpoints: (builder) => ({
    getMyProfile: builder.query<Profile | null, void>({
      async queryFn() {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: null };
        const { data, error } = await supabase
          .from("profiles")
          .select("*, stores(*)")
          .eq("id", user.id)
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as Profile };
      },
      providesTags: ["Profile"],
    }),

    getStores: builder.query<Store[], void>({
      async queryFn() {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .order("name");
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as Store[] };
      },
      providesTags: ["Stores"],
    }),

    createStore: builder.mutation<
      Store,
      Omit<Store, "id" | "created_at" | "updated_at">
    >({
      async queryFn(body) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("stores")
          .insert(body)
          .select()
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New store created",
            body: `${body.name} (${body.code}) was added.`,
            type: "system",
            link: "/app/stores",
            action: "store.create",
            entity_type: "store",
            entity_id: data.id,
          }),
        });
        return { data: data as Store };
      },
      invalidatesTags: ["Stores", "Dashboard", "Audit"],
    }),

    updateStore: builder.mutation<Store, Partial<Store> & { id: string }>({
      async queryFn({ id, ...patch }) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("stores")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as Store };
      },
      invalidatesTags: ["Stores", "Dashboard", "Audit"],
    }),

    getBrands: builder.query<Brand[], void>({
      async queryFn() {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("brands")
          .select("*")
          .order("name");
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as Brand[] };
      },
      providesTags: ["Brands"],
    }),

    createBrand: builder.mutation<
      Brand,
      Omit<Brand, "id" | "created_at" | "updated_at">
    >({
      async queryFn(body) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("brands")
          .insert(body)
          .select()
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Brand added",
            body: `${body.name} was added to the catalog.`,
            type: "system",
            link: "/app/brands",
            action: "brand.create",
            entity_type: "brand",
            entity_id: data.id,
          }),
        });
        return { data: data as Brand };
      },
      invalidatesTags: ["Brands", "Audit"],
    }),

    updateBrand: builder.mutation<Brand, Partial<Brand> & { id: string }>({
      async queryFn({ id, ...patch }) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("brands")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as Brand };
      },
      invalidatesTags: ["Brands", "Inventory"],
    }),

    getInventory: builder.query<
      InventoryItem[],
      { storeId?: string | "all" } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("inventory")
          .select("*, stores(*), brands(*)")
          .order("updated_at", { ascending: false });
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as InventoryItem[] };
      },
      providesTags: ["Inventory"],
    }),

    setMinStockBulk: builder.mutation<null, MinStockUpdate[]>({
      async queryFn(updates) {
        const supabase = createClient();
        for (const u of updates) {
          const { error } = await supabase.from("inventory").upsert(
            {
              store_id: u.store_id,
              brand_id: u.brand_id,
              min_stock: u.min_stock,
            },
            { onConflict: "store_id,brand_id" }
          );
          if (error) return { error: { status: 500, data: error.message } };
        }
        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Minimum stock updated",
            body: `${updates.length} stock threshold(s) were updated.`,
            type: "low_stock",
            link: "/app/inventory",
            action: "inventory.min_stock",
            entity_type: "inventory",
          }),
        });
        return { data: null };
      },
      invalidatesTags: ["Inventory", "Dashboard", "Audit"],
    }),

    createRestock: builder.mutation<
      Restock,
      {
        store_id: string;
        brand_id: string;
        quantity: number;
        unit_cost?: number;
        notes?: string;
      }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data: existing } = await supabase
          .from("inventory")
          .select("*")
          .eq("store_id", body.store_id)
          .eq("brand_id", body.brand_id)
          .maybeSingle();

        const nextQty = (existing?.quantity || 0) + body.quantity;
        const { error: invError } = await supabase.from("inventory").upsert(
          {
            store_id: body.store_id,
            brand_id: body.brand_id,
            quantity: nextQty,
            min_stock: existing?.min_stock ?? 5,
          },
          { onConflict: "store_id,brand_id" }
        );
        if (invError)
          return { error: { status: 500, data: invError.message } };

        const { data, error } = await supabase
          .from("restocks")
          .insert({
            ...body,
            performed_by: user.id,
          })
          .select("*, stores(*), brands(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Stock replenished",
            body: `${body.quantity} cartons restocked.`,
            type: "restock",
            link: "/app/inventory",
            action: "restock.create",
            entity_type: "restock",
            entity_id: data.id,
            store_id: body.store_id,
          }),
        });

        return { data: data as Restock };
      },
      invalidatesTags: ["Inventory", "Restocks", "Dashboard", "Audit"],
    }),

    getRestocks: builder.query<
      Restock[],
      { storeId?: string | "all"; limit?: number } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("restocks")
          .select("*, stores(*), brands(*), profiles:performed_by(*)")
          .order("created_at", { ascending: false })
          .limit(args?.limit || 100);
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as Restock[] };
      },
      providesTags: ["Restocks"],
    }),

    getSales: builder.query<
      Sale[],
      {
        storeId?: string | "all";
        dateFilter?: DateRangeFilter;
        brandId?: string;
        channel?: string;
      } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        const range = resolveDateRange(args?.dateFilter);
        let q = supabase
          .from("sales")
          .select(
            "*, stores(*), brands(*), seller:profiles!sales_sold_by_fkey(*), subagent:profiles!sales_subagent_id_fkey(*)"
          )
          .gte("sold_at", range.from)
          .lte("sold_at", range.to)
          .order("sold_at", { ascending: false });
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        if (args?.brandId) q = q.eq("brand_id", args.brandId);
        if (args?.channel) q = q.eq("channel", args.channel);
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as Sale[] };
      },
      providesTags: ["Sales"],
    }),

    createSale: builder.mutation<
      Sale,
      {
        store_id: string;
        brand_id: string;
        quantity: number;
        unit_price: number;
        notes?: string;
        screenshot?: File | null;
        channel?: "store" | "subagent";
        batch_id?: string;
        subagent_id?: string;
      }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data: org } = await supabase
          .from("organization_settings")
          .select("require_sale_screenshot, allow_negative_stock")
          .eq("id", 1)
          .maybeSingle();
        const requireScreenshot = org?.require_sale_screenshot !== false;
        if (requireScreenshot && !body.screenshot) {
          return {
            error: { status: 400, data: "Screenshot proof is required" },
          };
        }

        const channel = body.channel || "store";
        const total = body.quantity * body.unit_price;

        if (channel === "store") {
          const { data: inv } = await supabase
            .from("inventory")
            .select("*")
            .eq("store_id", body.store_id)
            .eq("brand_id", body.brand_id)
            .maybeSingle();
          if ((!inv || inv.quantity < body.quantity) && !org?.allow_negative_stock) {
            return {
              error: { status: 400, data: "Insufficient store stock" },
            };
          }
          if (inv) {
            const { error: invErr } = await supabase
              .from("inventory")
              .update({ quantity: inv.quantity - body.quantity })
              .eq("id", inv.id);
            if (invErr) return { error: { status: 500, data: invErr.message } };
          }
        }

        if (channel === "subagent" && body.batch_id) {
          const { data: batch } = await supabase
            .from("subagent_batches")
            .select("*")
            .eq("id", body.batch_id)
            .single();
          if (!batch || batch.quantity_in_hand < body.quantity) {
            return {
              error: { status: 400, data: "Insufficient batch stock" },
            };
          }
          const sold = batch.quantity_sold + body.quantity;
          const returned = batch.quantity_returned;
          const status =
            sold + returned >= batch.quantity_taken
              ? "settled"
              : returned > 0
                ? "partially_returned"
                : "active";
          const { error: batchErr } = await supabase
            .from("subagent_batches")
            .update({
              quantity_sold: sold,
              status,
              settled_at: status === "settled" ? new Date().toISOString() : null,
            })
            .eq("id", body.batch_id);
          if (batchErr)
            return { error: { status: 500, data: batchErr.message } };
        }

        const tempId = crypto.randomUUID();
        let screenshotUrl = "";
        if (body.screenshot) {
          try {
            screenshotUrl = await uploadScreenshot(body.screenshot, tempId);
          } catch (e) {
            return {
              error: {
                status: 500,
                data: e instanceof Error ? e.message : "Upload failed",
              },
            };
          }
        }

        const { data, error } = await supabase
          .from("sales")
          .insert({
            store_id: body.store_id,
            brand_id: body.brand_id,
            quantity: body.quantity,
            unit_price: body.unit_price,
            total_amount: total,
            channel,
            sold_by: user.id,
            subagent_id: body.subagent_id || (channel === "subagent" ? user.id : null),
            batch_id: body.batch_id || null,
            screenshot_url: screenshotUrl || "",
            notes: body.notes || null,
          })
          .select("*, stores(*), brands(*)")
          .single();

        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New sale recorded",
            body: `${body.quantity} cartons sold · ${total.toFixed(2)} ETB`,
            type: "sale",
            link: "/app/reports",
            action: "sale.create",
            entity_type: "sale",
            entity_id: data.id,
            store_id: body.store_id,
            metadata: { quantity: body.quantity, total },
          }),
        });

        return { data: data as Sale };
      },
      invalidatesTags: [
        "Sales",
        "Inventory",
        "Batches",
        "Dashboard",
        "Audit",
        "Notifications",
      ],
    }),

    getBatches: builder.query<
      SubagentBatch[],
      { storeId?: string | "all"; subagentId?: string } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("subagent_batches")
          .select(
            "*, stores(*), brands(*), subagent:profiles!subagent_batches_subagent_id_fkey(*), issuer:profiles!subagent_batches_issued_by_fkey(*)"
          )
          .order("issued_at", { ascending: false });
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        if (args?.subagentId) q = q.eq("subagent_id", args.subagentId);
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as SubagentBatch[] };
      },
      providesTags: ["Batches"],
    }),

    issueBatch: builder.mutation<
      SubagentBatch,
      {
        store_id: string;
        subagent_id: string;
        brand_id: string;
        quantity_taken: number;
        notes?: string;
      }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data: inv } = await supabase
          .from("inventory")
          .select("*")
          .eq("store_id", body.store_id)
          .eq("brand_id", body.brand_id)
          .maybeSingle();
        if (!inv || inv.quantity < body.quantity_taken) {
          return { error: { status: 400, data: "Insufficient store stock" } };
        }

        const { error: invErr } = await supabase
          .from("inventory")
          .update({ quantity: inv.quantity - body.quantity_taken })
          .eq("id", inv.id);
        if (invErr) return { error: { status: 500, data: invErr.message } };

        const { data, error } = await supabase
          .from("subagent_batches")
          .insert({
            ...body,
            issued_by: user.id,
          })
          .select("*, stores(*), brands(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Batch issued to subagent",
            body: `${body.quantity_taken} cartons issued.`,
            type: "batch",
            link: "/app/subagents",
            action: "batch.issue",
            entity_type: "batch",
            entity_id: data.id,
            store_id: body.store_id,
          }),
        });

        return { data: data as SubagentBatch };
      },
      invalidatesTags: ["Batches", "Inventory", "Dashboard", "Audit"],
    }),

    returnBatchStock: builder.mutation<
      SubagentBatch,
      { batch_id: string; quantity: number }
    >({
      async queryFn({ batch_id, quantity }) {
        const supabase = createClient();
        const { data: batch, error: fetchErr } = await supabase
          .from("subagent_batches")
          .select("*")
          .eq("id", batch_id)
          .single();
        if (fetchErr || !batch)
          return { error: { status: 404, data: "Batch not found" } };
        if (quantity > batch.quantity_in_hand) {
          return { error: { status: 400, data: "Return exceeds in-hand" } };
        }

        const returned = batch.quantity_returned + quantity;
        const status =
          batch.quantity_sold + returned >= batch.quantity_taken
            ? "settled"
            : "partially_returned";

        const { data: inv } = await supabase
          .from("inventory")
          .select("*")
          .eq("store_id", batch.store_id)
          .eq("brand_id", batch.brand_id)
          .maybeSingle();

        if (inv) {
          await supabase
            .from("inventory")
            .update({ quantity: inv.quantity + quantity })
            .eq("id", inv.id);
        }

        const { data, error } = await supabase
          .from("subagent_batches")
          .update({
            quantity_returned: returned,
            status,
            settled_at: status === "settled" ? new Date().toISOString() : null,
          })
          .eq("id", batch_id)
          .select("*, stores(*), brands(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Subagent stock returned",
            body: `${quantity} cartons returned to store.`,
            type: "settlement",
            link: "/app/subagents",
            action: "batch.return",
            entity_type: "batch",
            entity_id: batch_id,
            store_id: batch.store_id,
          }),
        });

        return { data: data as SubagentBatch };
      },
      invalidatesTags: ["Batches", "Inventory", "Dashboard", "Audit"],
    }),

    getUsers: builder.query<Profile[], { role?: string; storeId?: string } | void>({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("profiles")
          .select("*, stores(*)")
          .order("full_name");
        if (args?.role) q = q.eq("role", args.role);
        if (args?.storeId) q = q.eq("store_id", args.storeId);
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as Profile[] };
      },
      providesTags: ["Users"],
    }),

    updateUser: builder.mutation<Profile, Partial<Profile> & { id: string }>({
      async queryFn({ id, ...patch }) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", id)
          .select("*, stores(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as Profile };
      },
      invalidatesTags: ["Users", "Profile", "Audit"],
    }),

    createUser: builder.mutation<
      {
        user: Profile;
        credentials: { email: string; password: string };
      },
      {
        email: string;
        password: string;
        full_name: string;
        phone?: string | null;
        role: UserRole;
        store_id?: string | null;
        is_active?: boolean;
      }
    >({
      async queryFn(body) {
        try {
          const res = await fetch("/api/users/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as {
            error?: string;
            user?: Profile;
            credentials?: { email: string; password: string };
          };
          if (!res.ok || !json.user || !json.credentials) {
            return {
              error: {
                status: res.status,
                data: json.error || "Failed to create account",
              },
            };
          }
          return {
            data: {
              user: json.user,
              credentials: json.credentials,
            },
          };
        } catch (err) {
          return {
            error: {
              status: 500,
              data:
                err instanceof Error ? err.message : "Failed to create account",
            },
          };
        }
      },
      invalidatesTags: ["Users", "Audit"],
    }),

    updateMyProfile: builder.mutation<
      Profile,
      { full_name: string; phone?: string | null }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };
        if (!body.full_name.trim()) {
          return { error: { status: 400, data: "Full name is required" } };
        }
        const { data, error } = await supabase
          .from("profiles")
          .update({
            full_name: body.full_name.trim(),
            phone: body.phone?.trim() || null,
          })
          .eq("id", user.id)
          .select("*, stores(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as Profile };
      },
      invalidatesTags: ["Profile", "Users"],
    }),

    changePassword: builder.mutation<
      { ok: true },
      { currentPassword: string; newPassword: string }
    >({
      async queryFn(body) {
        try {
          const res = await fetch("/api/settings/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as { error?: string };
          if (!res.ok) {
            return {
              error: {
                status: res.status,
                data: json.error || "Failed to change password",
              },
            };
          }
          return { data: { ok: true } };
        } catch (err) {
          return {
            error: {
              status: 500,
              data:
                err instanceof Error
                  ? err.message
                  : "Failed to change password",
            },
          };
        }
      },
    }),

    getMyPreferences: builder.query<UserPreferences, void>({
      async queryFn() {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const defaults = {
          user_id: user.id,
          notify_sales: true,
          notify_restock: true,
          notify_low_stock: true,
          notify_batches: true,
          notify_reports: true,
          notify_remittances: true,
          notify_closeouts: true,
          notify_users: true,
          notify_system: true,
          quiet_hours_enabled: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } satisfies UserPreferences;

        const { data, error } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          if (/does not exist|schema cache/i.test(error.message)) {
            return { data: defaults };
          }
          return { error: { status: 500, data: error.message } };
        }

        if (!data) {
          const { data: created, error: createError } = await supabase
            .from("user_preferences")
            .upsert({ user_id: user.id }, { onConflict: "user_id" })
            .select("*")
            .single();
          if (createError) {
            if (/does not exist|schema cache/i.test(createError.message)) {
              return { data: defaults };
            }
            return { error: { status: 500, data: createError.message } };
          }
          return { data: created as UserPreferences };
        }

        return { data: data as UserPreferences };
      },
      providesTags: ["Preferences"],
    }),

    updateMyPreferences: builder.mutation<
      UserPreferences,
      Partial<Omit<UserPreferences, "user_id" | "created_at" | "updated_at">>
    >({
      async queryFn(patch) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data, error } = await supabase
          .from("user_preferences")
          .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
          .select("*")
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as UserPreferences };
      },
      invalidatesTags: ["Preferences"],
    }),

    getOrgSettings: builder.query<OrganizationSettings, void>({
      async queryFn() {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("organization_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (error) {
          if (/does not exist|schema cache/i.test(error.message)) {
            return {
              data: {
                id: 1,
                company_name: "Fourty",
                company_phone: null,
                company_address: null,
                company_city: null,
                currency_code: "ETB",
                timezone: "Africa/Addis_Ababa",
                default_min_stock: 10,
                require_sale_screenshot: true,
                require_remittance_proof: false,
                allow_negative_stock: false,
                closeout_reminder_hour: 18,
                fiscal_year_start_month: 1,
                updated_by: null,
                updated_at: new Date().toISOString(),
              } satisfies OrganizationSettings,
            };
          }
          return { error: { status: 500, data: error.message } };
        }
        if (!data) {
          return {
            data: {
              id: 1,
              company_name: "Fourty",
              company_phone: null,
              company_address: null,
              company_city: null,
              currency_code: "ETB",
              timezone: "Africa/Addis_Ababa",
              default_min_stock: 10,
              require_sale_screenshot: true,
              require_remittance_proof: false,
              allow_negative_stock: false,
              closeout_reminder_hour: 18,
              fiscal_year_start_month: 1,
              updated_by: null,
              updated_at: new Date().toISOString(),
            } satisfies OrganizationSettings,
          };
        }
        return { data: data as OrganizationSettings };
      },
      providesTags: ["OrgSettings"],
    }),

    updateOrgSettings: builder.mutation<
      OrganizationSettings,
      Partial<
        Omit<OrganizationSettings, "id" | "updated_at" | "updated_by">
      >
    >({
      async queryFn(patch) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data, error } = await supabase
          .from("organization_settings")
          .upsert(
            { id: 1, ...patch, updated_by: user.id },
            { onConflict: "id" }
          )
          .select("*")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Organization settings updated",
            body: "Company policies were changed by an owner.",
            type: "system",
            link: "/app/settings",
            action: "org.settings_update",
            entity_type: "organization_settings",
            entity_id: null,
            metadata: patch,
          }),
        });

        return { data: data as OrganizationSettings };
      },
      invalidatesTags: ["OrgSettings", "Audit"],
    }),

    getMyPushDevices: builder.query<PushDevice[], void>({
      async queryFn() {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("id, user_id, endpoint, user_agent, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as PushDevice[] };
      },
      providesTags: ["PushDevices"],
    }),

    removePushDevice: builder.mutation<null, { id?: string; all?: boolean }>({
      async queryFn(body) {
        try {
          const res = await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as { error?: string };
          if (!res.ok) {
            return {
              error: {
                status: res.status,
                data: json.error || "Failed to remove device",
              },
            };
          }
          return { data: null };
        } catch (err) {
          return {
            error: {
              status: 500,
              data:
                err instanceof Error ? err.message : "Failed to remove device",
            },
          };
        }
      },
      invalidatesTags: ["PushDevices"],
    }),

    getNotifications: builder.query<AppNotification[], void>({
      async queryFn() {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as AppNotification[] };
      },
      providesTags: ["Notifications"],
    }),

    markNotificationRead: builder.mutation<null, string | "all">({
      async queryFn(id) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };
        let q = supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id);
        if (id !== "all") q = q.eq("id", id);
        const { error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: null };
      },
      invalidatesTags: ["Notifications"],
    }),

    getAuditLogs: builder.query<
      AuditLog[],
      { storeId?: string | "all"; limit?: number } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("audit_logs")
          .select("*, stores(*)")
          .order("created_at", { ascending: false })
          .limit(args?.limit || 200);
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as AuditLog[] };
      },
      providesTags: ["Audit"],
    }),

    getDashboardStats: builder.query<
      DashboardStats & {
        salesTrend: { date: string; revenue: number; cartons: number }[];
        brandBreakdown: { name: string; revenue: number; cartons: number }[];
        storeBreakdown: { name: string; revenue: number; cartons: number }[];
      },
      { storeId?: string | "all"; dateFilter?: DateRangeFilter } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        const range = resolveDateRange(args?.dateFilter);
        const prev = previousPeriod(range.from, range.to);

        let salesQ = supabase
          .from("sales")
          .select("*, brands(name), stores(name)")
          .gte("sold_at", range.from)
          .lte("sold_at", range.to);
        let prevQ = supabase
          .from("sales")
          .select("total_amount, quantity")
          .gte("sold_at", prev.from)
          .lte("sold_at", prev.to);

        if (args?.storeId && args.storeId !== "all") {
          salesQ = salesQ.eq("store_id", args.storeId);
          prevQ = prevQ.eq("store_id", args.storeId);
        }

        const [
          { data: sales },
          { data: prevSales },
          { data: inventory },
          { data: stores },
          { data: subagents },
          { data: batches },
        ] = await Promise.all([
          salesQ,
          prevQ,
          supabase.from("inventory").select("*, brands(unit_price, cost_price)"),
          supabase.from("stores").select("id").eq("is_active", true),
          supabase
            .from("profiles")
            .select("id")
            .eq("role", "subagent")
            .eq("is_active", true),
          supabase
            .from("subagent_batches")
            .select("id")
            .in("status", ["active", "partially_returned", "overdue"]),
        ]);

        const list = sales || [];
        const prevList = prevSales || [];
        const totalRevenue = list.reduce(
          (s, r) => s + Number(r.total_amount),
          0
        );
        const prevRevenue = prevList.reduce(
          (s, r) => s + Number(r.total_amount),
          0
        );
        const totalCartonsSold = list.reduce((s, r) => s + r.quantity, 0);
        const prevCartons = prevList.reduce((s, r) => s + r.quantity, 0);

        const invList = (inventory || []).filter(
          (i) =>
            !args?.storeId ||
            args.storeId === "all" ||
            i.store_id === args.storeId
        );

        const lowStockCount = invList.filter(
          (i) => i.quantity <= i.min_stock
        ).length;
        const inventoryValue = invList.reduce(
          (s, i) =>
            s +
            i.quantity *
              Number(
                (i.brands as { cost_price?: number } | null)?.cost_price || 0
              ),
          0
        );

        const byDate = new Map<string, { revenue: number; cartons: number }>();
        const byBrand = new Map<string, { revenue: number; cartons: number }>();
        const byStore = new Map<string, { revenue: number; cartons: number }>();

        for (const sale of list) {
          const day = sale.sold_at.slice(0, 10);
          const brandName =
            (sale.brands as { name?: string } | null)?.name || "Unknown";
          const storeName =
            (sale.stores as { name?: string } | null)?.name || "Unknown";
          const rev = Number(sale.total_amount);

          const d = byDate.get(day) || { revenue: 0, cartons: 0 };
          d.revenue += rev;
          d.cartons += sale.quantity;
          byDate.set(day, d);

          const b = byBrand.get(brandName) || { revenue: 0, cartons: 0 };
          b.revenue += rev;
          b.cartons += sale.quantity;
          byBrand.set(brandName, b);

          const st = byStore.get(storeName) || { revenue: 0, cartons: 0 };
          st.revenue += rev;
          st.cartons += sale.quantity;
          byStore.set(storeName, st);
        }

        return {
          data: {
            totalRevenue,
            totalCartonsSold,
            totalTransactions: list.length,
            lowStockCount,
            activeStores: stores?.length || 0,
            activeSubagents: subagents?.length || 0,
            inventoryValue,
            pendingBatches: batches?.length || 0,
            revenueChange: percentChange(totalRevenue, prevRevenue),
            salesChange: percentChange(totalCartonsSold, prevCartons),
            salesTrend: Array.from(byDate.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, v]) => ({ date, ...v })),
            brandBreakdown: Array.from(byBrand.entries())
              .map(([name, v]) => ({ name, ...v }))
              .sort((a, b) => b.revenue - a.revenue),
            storeBreakdown: Array.from(byStore.entries())
              .map(([name, v]) => ({ name, ...v }))
              .sort((a, b) => b.revenue - a.revenue),
          },
        };
      },
      providesTags: ["Dashboard"],
    }),

    getCloseouts: builder.query<
      DailyCloseout[],
      { storeId?: string | "all" } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("daily_closeouts")
          .select("*, stores(*), submitter:profiles!daily_closeouts_submitted_by_fkey(*)")
          .order("closeout_date", { ascending: false })
          .limit(60);
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as DailyCloseout[] };
      },
      providesTags: ["Closeouts"],
    }),

    submitCloseout: builder.mutation<
      DailyCloseout,
      {
        store_id: string;
        closeout_date: string;
        opening_notes?: string;
        closing_notes?: string;
        cash_declared?: number;
      }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const dayStart = `${body.closeout_date}T00:00:00.000Z`;
        const dayEnd = `${body.closeout_date}T23:59:59.999Z`;

        const [{ data: sales }, { data: inventory }] = await Promise.all([
          supabase
            .from("sales")
            .select("quantity, total_amount")
            .eq("store_id", body.store_id)
            .gte("sold_at", dayStart)
            .lte("sold_at", dayEnd),
          supabase
            .from("inventory")
            .select("quantity, min_stock, brand_id, brands(name)")
            .eq("store_id", body.store_id),
        ]);

        const saleList = sales || [];
        const snapshot = (inventory || []).map((i) => ({
          brand_id: i.brand_id,
          brand_name:
            (i.brands as { name?: string } | null)?.name || "Unknown",
          quantity: i.quantity,
          min_stock: i.min_stock,
        }));

        const payload = {
          store_id: body.store_id,
          closeout_date: body.closeout_date,
          opening_notes: body.opening_notes || null,
          closing_notes: body.closing_notes || null,
          cash_declared: body.cash_declared || 0,
          total_sales_amount: saleList.reduce(
            (s, r) => s + Number(r.total_amount),
            0
          ),
          total_cartons_sold: saleList.reduce((s, r) => s + r.quantity, 0),
          total_transactions: saleList.length,
          stock_snapshot: snapshot,
          status: "submitted" as const,
          submitted_by: user.id,
        };

        const { data, error } = await supabase
          .from("daily_closeouts")
          .upsert(payload, { onConflict: "store_id,closeout_date" })
          .select("*, stores(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Daily closeout submitted",
            body: `${data.stores?.name || "Store"} closed ${body.closeout_date}`,
            type: "report",
            link: "/app/closeout",
            action: "closeout.submit",
            entity_type: "closeout",
            entity_id: data.id,
            store_id: body.store_id,
          }),
        });

        return { data: data as DailyCloseout };
      },
      invalidatesTags: ["Closeouts", "Notifications", "Audit", "Dashboard"],
    }),

    reviewCloseout: builder.mutation<DailyCloseout, string>({
      async queryFn(id) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };
        const { data, error } = await supabase
          .from("daily_closeouts")
          .update({
            status: "reviewed",
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*, stores(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as DailyCloseout };
      },
      invalidatesTags: ["Closeouts", "Audit"],
    }),

    getAdjustments: builder.query<
      StockAdjustment[],
      { storeId?: string | "all" } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("stock_adjustments")
          .select("*, stores(*), brands(*), profiles:performed_by(*)")
          .order("created_at", { ascending: false })
          .limit(100);
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as StockAdjustment[] };
      },
      providesTags: ["Adjustments"],
    }),

    createAdjustment: builder.mutation<
      StockAdjustment,
      {
        store_id: string;
        brand_id: string;
        quantity_delta: number;
        reason: string;
        notes?: string;
      }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data: inv } = await supabase
          .from("inventory")
          .select("*")
          .eq("store_id", body.store_id)
          .eq("brand_id", body.brand_id)
          .maybeSingle();

        const next = (inv?.quantity || 0) + body.quantity_delta;
        if (next < 0) {
          return { error: { status: 400, data: "Adjustment would make stock negative" } };
        }

        const { error: invErr } = await supabase.from("inventory").upsert(
          {
            store_id: body.store_id,
            brand_id: body.brand_id,
            quantity: next,
            min_stock: inv?.min_stock ?? 5,
          },
          { onConflict: "store_id,brand_id" }
        );
        if (invErr) return { error: { status: 500, data: invErr.message } };

        const { data, error } = await supabase
          .from("stock_adjustments")
          .insert({ ...body, performed_by: user.id })
          .select("*, stores(*), brands(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Stock adjustment recorded",
            body: `${body.quantity_delta > 0 ? "+" : ""}${body.quantity_delta} cartons (${body.reason})`,
            type: "audit",
            link: "/app/adjustments",
            action: "adjustment.create",
            entity_type: "adjustment",
            entity_id: data.id,
            store_id: body.store_id,
          }),
        });

        return { data: data as StockAdjustment };
      },
      invalidatesTags: ["Adjustments", "Inventory", "Dashboard", "Audit"],
    }),

    getRemittances: builder.query<
      Remittance[],
      { storeId?: string | "all" } | void
    >({
      async queryFn(args) {
        const supabase = createClient();
        let q = supabase
          .from("remittances")
          .select(
            "*, stores(*), submitter:profiles!remittances_submitted_by_fkey(*), subagent:profiles!remittances_subagent_id_fkey(*)"
          )
          .order("created_at", { ascending: false })
          .limit(100);
        if (args?.storeId && args.storeId !== "all") {
          q = q.eq("store_id", args.storeId);
        }
        const { data, error } = await q;
        if (error) return { error: { status: 500, data: error.message } };
        return { data: (data || []) as Remittance[] };
      },
      providesTags: ["Remittances"],
    }),

    createRemittance: builder.mutation<
      Remittance,
      {
        store_id: string;
        amount: number;
        method: string;
        reference_code?: string;
        notes?: string;
        subagent_id?: string;
        proof?: File | null;
      }
    >({
      async queryFn(body) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };

        const { data: org } = await supabase
          .from("organization_settings")
          .select("require_remittance_proof")
          .eq("id", 1)
          .maybeSingle();
        if (org?.require_remittance_proof && !body.proof) {
          return {
            error: { status: 400, data: "Remittance proof is required" },
          };
        }

        let proofUrl: string | null = null;
        if (body.proof) {
          const ext = body.proof.name.split(".").pop() || "jpg";
          const path = `remit-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("sale-screenshots")
            .upload(path, body.proof, { upsert: true, contentType: body.proof.type });
          if (upErr) return { error: { status: 500, data: upErr.message } };
          proofUrl = supabase.storage.from("sale-screenshots").getPublicUrl(path)
            .data.publicUrl;
        }

        const { data, error } = await supabase
          .from("remittances")
          .insert({
            store_id: body.store_id,
            amount: body.amount,
            method: body.method,
            reference_code: body.reference_code || null,
            notes: body.notes || null,
            subagent_id: body.subagent_id || null,
            proof_url: proofUrl,
            submitted_by: user.id,
          })
          .select("*, stores(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };

        await fetch("/api/actions/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Remittance submitted",
            body: `${body.amount.toFixed(2)} ETB via ${body.method}`,
            type: "settlement",
            link: "/app/remittances",
            action: "remittance.create",
            entity_type: "remittance",
            entity_id: data.id,
            store_id: body.store_id,
          }),
        });

        return { data: data as Remittance };
      },
      invalidatesTags: ["Remittances", "Notifications", "Audit"],
    }),

    updateRemittanceStatus: builder.mutation<
      Remittance,
      { id: string; status: "confirmed" | "rejected" }
    >({
      async queryFn({ id, status }) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { status: 401, data: "Unauthorized" } };
        const { data, error } = await supabase
          .from("remittances")
          .update({
            status,
            confirmed_by: user.id,
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*, stores(*)")
          .single();
        if (error) return { error: { status: 500, data: error.message } };
        return { data: data as Remittance };
      },
      invalidatesTags: ["Remittances", "Audit"],
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useGetStoresQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useGetInventoryQuery,
  useSetMinStockBulkMutation,
  useCreateRestockMutation,
  useGetRestocksQuery,
  useGetSalesQuery,
  useCreateSaleMutation,
  useGetBatchesQuery,
  useIssueBatchMutation,
  useReturnBatchStockMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
  useCreateUserMutation,
  useUpdateMyProfileMutation,
  useChangePasswordMutation,
  useGetMyPreferencesQuery,
  useUpdateMyPreferencesMutation,
  useGetOrgSettingsQuery,
  useUpdateOrgSettingsMutation,
  useGetMyPushDevicesQuery,
  useRemovePushDeviceMutation,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useGetAuditLogsQuery,
  useGetDashboardStatsQuery,
  useGetCloseoutsQuery,
  useSubmitCloseoutMutation,
  useReviewCloseoutMutation,
  useGetAdjustmentsQuery,
  useCreateAdjustmentMutation,
  useGetRemittancesQuery,
  useCreateRemittanceMutation,
  useUpdateRemittanceStatusMutation,
} = fourtyApi;
