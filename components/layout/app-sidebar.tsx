"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { clearAuth } from "@/store/slices/authSlice";
import type { RootState } from "@/store";
import { useGetNotificationsQuery } from "@/store/api/fourtyApi";
import {
  catalogNav,
  insightNav,
  mainNav,
  navLabelForRole,
  type NavItem,
} from "@/components/layout/nav-config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

function NavGroup({
  label,
  items,
  unread,
  role,
}: {
  label: string;
  items: NavItem[];
  unread: number;
  role: "owner" | "storekeeper" | "subagent";
}) {
  const pathname = usePathname();
  if (!items.length) return null;

  return (
    <SidebarGroup className="max-md:px-2">
      <SidebarGroupLabel className="font-heading text-[11px] font-semibold tracking-wide uppercase max-md:mb-1 max-md:px-2 max-md:font-nav max-md:text-[11px] max-md:font-medium max-md:tracking-[0.12em]">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="max-md:gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.label}
                  className="font-sans max-md:h-12 max-md:gap-3 max-md:rounded-xl max-md:px-3 max-md:font-nav max-md:text-[15px] max-md:font-normal max-md:[&_svg]:size-5"
                  render={<Link href={item.href} />}
                >
                  <Icon className="size-4" />
                  <span className="font-sans max-md:font-nav max-md:font-normal">
                    {navLabelForRole(item, role)}
                  </span>
                </SidebarMenuButton>
                {item.href === "/app/notifications" && unread > 0 && (
                  <SidebarMenuBadge className="font-mono max-md:text-xs">
                    {unread}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { state } = useSidebar();
  const profile = useSelector((s: RootState) => s.auth.profile);
  const { data: notifications = [] } = useGetNotificationsQuery();
  const unread = notifications.filter((n) => !n.is_read).length;
  const role = profile?.role || "storekeeper";
  const collapsed = state === "collapsed";

  const filter = (items: NavItem[]) =>
    items.filter((i) => i.roles.includes(role));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    dispatch(clearAuth());
    toast.success("Signed out");
    router.push("/login");
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="font-sans max-md:font-nav">
      <SidebarHeader className="border-b border-sidebar-border max-md:px-3 max-md:py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Fourty"
              className="font-sans max-md:h-14 max-md:gap-3 max-md:rounded-xl max-md:px-2"
              render={<Link href="/app/dashboard" />}
            >
              <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground max-md:size-10 max-md:text-base">
                40
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading text-base font-semibold tracking-tight max-md:font-nav max-md:text-[17px] max-md:font-medium">
                  Fourty
                </span>
                <span className="truncate font-sans text-xs text-sidebar-foreground/70 max-md:font-nav max-md:text-[12px] max-md:font-normal">
                  Inventory & Sales
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Operations" items={filter(mainNav)} unread={unread} role={role} />
        <NavGroup label="Organization" items={filter(catalogNav)} unread={unread} role={role} />
        <NavGroup label="Insights" items={filter(insightNav)} unread={unread} role={role} />
      </SidebarContent>

      <SidebarFooter className="overflow-visible border-t border-sidebar-border px-3 pt-3 pb-3 font-sans group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2 max-md:pb-[calc(2.75rem+env(safe-area-inset-bottom,0px))]">
        {!collapsed && (
          <div className="mb-1.5 rounded-lg bg-sidebar-accent/60 px-3 py-2 max-md:px-3.5 max-md:py-2.5">
            <p className="truncate font-heading text-sm font-semibold text-sidebar-foreground max-md:font-nav max-md:text-[15px] max-md:font-medium">
              {profile?.full_name || "…"}
            </p>
            <p className="truncate text-[11px] capitalize text-sidebar-foreground/65 max-md:font-nav max-md:text-[12px] max-md:font-normal">
              {role}
              {profile?.stores?.name ? ` · ${profile.stores.name}` : ""}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={logout}
              className="h-9 overflow-visible px-3 font-sans bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground active:bg-sidebar-primary/80 active:text-sidebar-primary-foreground max-md:h-12 max-md:rounded-xl max-md:font-nav max-md:text-[15px] max-md:font-medium max-md:[&_svg]:size-5"
            >
              <LogOut className="size-4" />
              <span className="font-medium">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
