"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPushSupported, subscribeToPush } from "@/lib/push-client";

export function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (Notification.permission === "default") setVisible(true);
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

  if (!visible) return null;

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
