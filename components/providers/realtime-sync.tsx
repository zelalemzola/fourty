"use client";

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createClient } from "@/lib/supabase/client";
import { fourtyApi } from "@/store/api/fourtyApi";
import type { AppDispatch, RootState } from "@/store";

type FourtyTag =
  | "Profile"
  | "Stores"
  | "Brands"
  | "Inventory"
  | "Sales"
  | "Restocks"
  | "Batches"
  | "Notifications"
  | "Audit"
  | "Dashboard"
  | "Users"
  | "Closeouts"
  | "Adjustments"
  | "Remittances"
  | "Preferences"
  | "OrgSettings"
  | "PushDevices";

const TABLE_TAGS: Record<string, FourtyTag[]> = {
  profiles: ["Profile", "Users", "Dashboard"],
  stores: ["Stores", "Dashboard"],
  brands: ["Brands", "Inventory", "Dashboard"],
  inventory: ["Inventory", "Dashboard"],
  restocks: ["Restocks", "Inventory", "Dashboard"],
  subagent_batches: ["Batches", "Inventory", "Dashboard"],
  sales: ["Sales", "Dashboard", "Inventory"],
  notifications: ["Notifications"],
  audit_logs: ["Audit"],
  daily_closeouts: ["Closeouts", "Dashboard"],
  daily_reports: ["Dashboard"],
  stock_adjustments: ["Adjustments", "Inventory", "Dashboard"],
  remittances: ["Remittances"],
  user_preferences: ["Preferences"],
  organization_settings: ["OrgSettings"],
  push_subscriptions: ["PushDevices"],
};

export function RealtimeSync() {
  const dispatch = useDispatch<AppDispatch>();
  const profileId = useSelector((s: RootState) => s.auth.profile?.id);
  const pending = useRef(new Set<FourtyTag>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profileId) return;

    const supabase = createClient();

    function flush() {
      const tags = [...pending.current];
      pending.current.clear();
      timer.current = null;
      if (tags.length) {
        dispatch(fourtyApi.util.invalidateTags(tags));
      }
    }

    function queue(table: string) {
      const tags = TABLE_TAGS[table];
      if (!tags) return;
      for (const tag of tags) pending.current.add(tag);
      if (timer.current == null) {
        timer.current = setTimeout(flush, 400);
      }
    }

    const channel = supabase
      .channel("fourty-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload) => queue(payload.table)
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [dispatch, profileId]);

  return null;
}
