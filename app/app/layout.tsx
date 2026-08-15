"use client";

import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { PushPermissionBanner } from "@/components/providers/push-banner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/ModeToggle";
import { Bell } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useGetNotificationsQuery } from "@/store/api/fourtyApi";

function AppTopBar() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { data: notifications = [] } = useGetNotificationsQuery();
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/80 bg-background/90 px-3 backdrop-blur-md supports-backdrop-filter:bg-background/75 sm:h-12 sm:px-4">
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-xs font-bold text-accent-foreground md:hidden">
          40
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-[15px] font-semibold tracking-tight text-foreground sm:text-sm">
            Fourty
          </p>
          <p className="truncate text-[11px] text-muted-foreground md:hidden">
            {profile?.full_name
              ? `Hello, ${profile.full_name.split(" ")[0]}`
              : "Distribution OS"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/app/notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground shadow-sm active:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-figure text-[10px] font-semibold text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <ModeToggle className="size-9 rounded-full" collapsed />
      </div>
    </header>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AppTopBar />
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden px-4 py-4 pb-[5.5rem] sm:px-5 sm:py-5 md:pb-6">
          <PushPermissionBanner />
          {children}
        </main>
        <MobileTabBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
