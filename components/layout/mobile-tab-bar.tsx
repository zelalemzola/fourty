"use client";

import { useEffect, useState } from "react";
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
  const role =
    useSelector((s: RootState) => s.auth.profile?.role) || "storekeeper";
  const tabs = getMobileTabs(role);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const readY = () => {
      const inset = document.querySelector<HTMLElement>(
        "[data-slot='sidebar-inset']"
      );
      const main = document.querySelector("main");
      return Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        inset?.scrollTop ?? 0,
        main?.scrollTop ?? 0
      );
    };

    const onScroll = () => setCompact(readY() > 18);
    onScroll();

    const inset = document.querySelector("[data-slot='sidebar-inset']");
    const main = document.querySelector("main");
    window.addEventListener("scroll", onScroll, { passive: true });
    inset?.addEventListener("scroll", onScroll, { passive: true });
    main?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      inset?.removeEventListener("scroll", onScroll);
      main?.removeEventListener("scroll", onScroll);
    };
  }, []);

  const activeTab = tabs.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const moreActive = activeTab < 0;
  const indicatorIndex = moreActive ? tabs.length : activeTab;
  const count = tabs.length + 1;

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 md:hidden"
      style={{
        paddingBottom: "max(0.7rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-full border border-white/35 bg-background/55 shadow-[0_8px_32px_rgba(15,23,42,0.14)] backdrop-blur-xl transition-[width,height,padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:border-white/10 dark:bg-card/45 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
          compact
            ? "h-12 w-[min(100%,20.5rem)] p-1"
            : "h-14 w-[min(100%,24.5rem)] p-1.5"
        )}
      >
        <div className="relative flex h-full w-full items-stretch">
          <span
            aria-hidden
            className="absolute top-1/2 rounded-[1.05rem] bg-accent motion-reduce:transition-none"
            style={{
              width: `calc(100% / ${count} - 4px)`,
              height: compact ? "2rem" : "2.35rem",
              left: `calc(${indicatorIndex} * 100% / ${count} + 2px)`,
              transform: "translateY(-50%)",
              transition:
                "left 320ms cubic-bezier(0.32, 0.72, 0, 1), height 300ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          />
          {tabs.map((item, i) => {
            const active = i === activeTab;
            const Icon = item.icon;
            const label = navLabelForRole(item, role);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-full transition-colors duration-200",
                  active
                    ? "text-accent-foreground"
                    : "text-foreground/65 active:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "transition-[width,height] duration-300",
                    compact ? "size-5" : "size-[1.35rem]",
                    active && "stroke-[2.2]"
                  )}
                />
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="More"
            onClick={() => setOpenMobile(true)}
            className={cn(
              "relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-full transition-colors duration-200",
              moreActive
                ? "text-accent-foreground"
                : "text-foreground/65 active:text-foreground"
            )}
          >
            <Menu
              className={cn(
                "transition-[width,height] duration-300",
                compact ? "size-5" : "size-[1.35rem]"
              )}
            />
          </button>
        </div>
      </div>
    </nav>
  );
}
