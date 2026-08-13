"use client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function registerPushServiceWorker() {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function subscribeToPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "VAPID public key missing. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to .env.local"
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Push notifications were blocked");
  }

  const reg = await registerPushServiceWorker();

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Failed to save push subscription");
  }

  return subscription;
}

export async function unsubscribeFromPush(options?: {
  all?: boolean;
  deviceId?: string;
}) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();

  if (options?.all) {
    const res = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) throw new Error("Failed to revoke devices");
    await sub?.unsubscribe();
    return;
  }

  if (options?.deviceId) {
    const res = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: options.deviceId }),
    });
    if (!res.ok) throw new Error("Failed to remove device");
    return;
  }

  if (sub) {
    const res = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (!res.ok) throw new Error("Failed to disable push");
    await sub.unsubscribe();
  }
}

/** True when this browser already has a PushManager subscription. */
export async function hasLocalPushSubscription() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/**
 * Ensure this device is subscribed and saved to the server.
 * Safe to call when permission is already granted.
 */
export async function ensurePushSubscription() {
  return subscribeToPush();
}

export async function sendTestPush() {
  // Always (re)save subscription first so test works after permission-only state.
  await ensurePushSubscription();

  const res = await fetch("/api/push/test", { method: "POST" });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Test push failed");
  return json;
}
