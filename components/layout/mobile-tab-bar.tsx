"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getMobileTabs, navLabelForRole } from "@/components/layout/nav-config";

export function MobileTabBar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const role = useSelector((s: RootState) => s.auth.profile?.role) || "storekeeper";
  const tabs = getMobileTabs(role);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md md:hidden dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
        {tabs.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const label = navLabelForRole(item, role);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium tracking-wide",
                  active
                    ? "text-accent"
                    : "text-muted-foreground active:bg-muted/70"
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.25]")} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium tracking-wide text-muted-foreground active:bg-muted/70"
          >
            <Menu className="size-5" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
