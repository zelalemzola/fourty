import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:owner@fourty.local";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; type?: string }
) {
  try {
    const push = configureWebPush();
    const supabase = createServiceClient();

    if (payload.type) {
      const allowed = await userAllowsNotification(userId, payload.type);
      if (!allowed) return;
      if (await isInQuietHours(userId)) return;
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (!subs?.length) return;

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await push.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload)
          );
        } catch (error: unknown) {
          const statusCode =
            typeof error === "object" &&
            error &&
            "statusCode" in error &&
            typeof (error as { statusCode: unknown }).statusCode === "number"
              ? (error as { statusCode: number }).statusCode
              : null;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      })
    );
  } catch {
    // Push is best-effort; never block core mutations.
  }
}

const PREF_BY_TYPE: Record<string, string> = {
  sale: "notify_sales",
  restock: "notify_restock",
  low_stock: "notify_low_stock",
  batch: "notify_batches",
  report: "notify_reports",
  settlement: "notify_remittances",
  remittance: "notify_remittances",
  closeout: "notify_closeouts",
  user: "notify_users",
  system: "notify_system",
  audit: "notify_system",
};

async function userAllowsNotification(userId: string, type: string) {
  const supabase = createServiceClient();
  const column = PREF_BY_TYPE[type] || "notify_system";
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // If preferences table/row missing, default to allow.
  if (error || !data) return true;
  const value = (data as Record<string, unknown>)[column];
  return value !== false;
}

async function isInQuietHours(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.quiet_hours_enabled || !data.quiet_hours_start || !data.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const start = toMinutes(String(data.quiet_hours_start).slice(0, 5));
  const end = toMinutes(String(data.quiet_hours_end).slice(0, 5));

  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  // Overnight window (e.g. 22:00 → 06:00)
  return minutes >= start || minutes < end;
}

export async function notifyOwners(input: {
  title: string;
  body: string;
  type?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  const { data: owners } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "owner")
    .eq("is_active", true);

  if (!owners?.length) return;

  const type = input.type || "system";
  const recipients: string[] = [];
  for (const o of owners) {
    if (await userAllowsNotification(o.id, type)) {
      recipients.push(o.id);
    }
  }

  if (!recipients.length) return;

  const rows = recipients.map((id) => ({
    user_id: id,
    title: input.title,
    body: input.body,
    type,
    link: input.link || null,
    metadata: input.metadata || {},
  }));

  await supabase.from("notifications").insert(rows);

  await Promise.all(
    recipients.map((id) =>
      sendPushToUser(id, {
        title: input.title,
        body: input.body,
        url: input.link || "/app/notifications",
        type,
      })
    )
  );
}

export async function writeAuditLog(input: {
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  store_id?: string | null;
  details?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  await supabase.from("audit_logs").insert({
    actor_id: input.actor_id || null,
    actor_name: input.actor_name || null,
    actor_role: input.actor_role || null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id || null,
    store_id: input.store_id || null,
    details: input.details || {},
  });
}
