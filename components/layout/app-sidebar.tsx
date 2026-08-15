"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { clearAuth } from "@/store/slices/authSlice";
import type { RootState } from "@/store";
import { ModeToggle } from "@/components/ModeToggle";
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
    <SidebarGroup>
      <SidebarGroupLabel className="font-heading text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.label}
                  className="font-sans"
                  render={<Link href={item.href} />}
                >
                  <Icon className="size-4" />
                  <span className="font-sans">{navLabelForRole(item, role)}</span>
                </SidebarMenuButton>
                {item.href === "/app/notifications" && unread > 0 && (
                  <SidebarMenuBadge className="font-mono">
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
    <Sidebar collapsible="icon" variant="sidebar" className="font-sans">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Fourty"
              className="font-sans"
              render={<Link href="/app/dashboard" />}
            >
              <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary font-heading text-sm font-bold text-sidebar-primary-foreground">
                40
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading text-base font-semibold tracking-tight">
                  Fourty
                </span>
                <span className="truncate font-sans text-xs text-sidebar-foreground/70">
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

      <SidebarFooter className="border-t border-sidebar-border font-sans">
        {!collapsed && (
          <div className="px-2 py-1.5 text-xs text-sidebar-foreground/70">
            <p className="truncate font-heading text-sm font-semibold text-sidebar-foreground">
              {profile?.full_name || "…"}
            </p>
            <p className="truncate font-sans capitalize">
              {role}
              {profile?.stores?.name ? ` · ${profile.stores.name}` : ""}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={collapsed ? "flex justify-center px-1" : "px-1"}>
              <ModeToggle
                collapsed={collapsed}
                className="border-sidebar-border bg-transparent font-sans"
              />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="font-sans"
              onClick={logout}
            >
              <LogOut className="size-4" />
              <span className="font-sans">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
