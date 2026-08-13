"use client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushSupportReason =
  | "ok"
  | "ios_needs_homescreen"
  | "ios_version"
  | "in_app_browser"
  | "missing_api"
  | "insecure";

export type PushSupport = {
  supported: boolean;
  reason: PushSupportReason;
  message: string;
  isIOS: boolean;
  isStandalone: boolean;
};

function isIOSDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|LinkedInApp|Snapchat|Pinterest|GSA\//i.test(
    ua
  );
}

/** Diagnose why web push works or does not on this device/browser. */
export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return {
      supported: false,
      reason: "missing_api",
      message: "Push is only available in the browser.",
      isIOS: false,
      isStandalone: false,
    };
  }

  const isIOS = isIOSDevice();
  const isStandalone = isStandaloneDisplay();
  const hasAPIs =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "insecure",
      message: "Push requires a secure HTTPS connection.",
      isIOS,
      isStandalone,
    };
  }

  // iPhone/iPad: Web Push only works from a Home Screen app (iOS 16.4+), not Safari tabs.
  if (isIOS && !isStandalone) {
    return {
      supported: false,
      reason: "ios_needs_homescreen",
      message:
        "On iPhone or iPad, add Fourty to your Home Screen, then open it from that icon to enable push alerts.",
      isIOS,
      isStandalone,
    };
  }

  if (!hasAPIs) {
    if (isIOS) {
      return {
        supported: false,
        reason: "ios_version",
        message:
          "Push needs iOS 16.4 or newer. Update iOS, add Fourty to Home Screen, then open it from the icon.",
        isIOS,
        isStandalone,
      };
    }
    if (isInAppBrowser()) {
      return {
        supported: false,
        reason: "in_app_browser",
        message:
          "This in-app browser does not support push. Open the site in Chrome or Safari instead.",
        isIOS,
        isStandalone,
      };
    }
    return {
      supported: false,
      reason: "missing_api",
      message:
        "This browser does not support web push. Try the latest Chrome, Edge, or Firefox.",
      isIOS,
      isStandalone,
    };
  }

  return {
    supported: true,
    reason: "ok",
    message: "",
    isIOS,
    isStandalone,
  };
}

export function isPushSupported() {
  return getPushSupport().supported;
}

export async function registerPushServiceWorker() {
  const support = getPushSupport();
  if (!support.supported) {
    throw new Error(support.message || "Push notifications are not supported");
  }
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function subscribeToPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "VAPID public key missing. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel env, then redeploy."
    );
  }

  const support = getPushSupport();
  if (!support.supported) {
    throw new Error(support.message);
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
