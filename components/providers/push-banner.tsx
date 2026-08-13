"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPushSupport,
  isPushSupported,
  subscribeToPush,
  type PushSupport,
} from "@/lib/push-client";

export function PushPermissionBanner() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = getPushSupport();
    setSupport(next);

    if (next.supported) {
      if (Notification.permission === "default") setVisible(true);
      return;
    }

    // Guide iPhone/iPad users who opened the site in Safari (push only works as Home Screen app).
    if (next.reason === "ios_needs_homescreen") {
      const dismissed = sessionStorage.getItem("fourty-ios-push-hint");
      if (!dismissed) setVisible(true);
    }
  }, []);

  async function enablePush() {
    try {
      setLoading(true);
      await subscribeToPush();
      toast.success("Push notifications enabled");
      setVisible(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable push");
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "denied"
      ) {
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  }

  function dismissIosHint() {
    sessionStorage.setItem("fourty-ios-push-hint", "1");
    setVisible(false);
  }

  if (!visible || !support) return null;

  if (support.reason === "ios_needs_homescreen") {
    return (
      <div className="panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
            <Share className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Install Fourty for push alerts</p>
            <p className="text-xs text-muted-foreground">
              On iPhone/iPad, tap Share → Add to Home Screen, then open Fourty
              from the new icon. Safari tabs cannot receive web push.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={dismissIosHint}>
          Got it
        </Button>
      </div>
    );
  }

  if (!isPushSupported()) return null;

  return (
    <div className="panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
          <BellRing className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Enable push alerts</p>
          <p className="text-xs text-muted-foreground">
            Get notified for sales, restocks, closeouts, and low stock.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
          Later
        </Button>
        <Button size="sm" onClick={enablePush} disabled={loading}>
          {loading ? "Enabling…" : "Enable"}
        </Button>
      </div>
    </div>
  );
}
