"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { PushPermissionBanner } from "@/components/providers/push-banner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/ModeToggle";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md supports-backdrop-filter:bg-background/80">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <p className="truncate font-heading text-sm font-semibold tracking-tight text-foreground">
              Fourty Distribution
            </p>
            <ModeToggle className="size-8 shrink-0" collapsed />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-3.5 pb-6 sm:px-5 sm:py-5">
          <PushPermissionBanner />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
