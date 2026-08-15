import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  Store,
  Cigarette,
  Users,
  UserCog,
  FileBarChart2,
  Shield,
  Bell,
  Settings,
  ClipboardCheck,
  SlidersHorizontal,
  Banknote,
} from "lucide-react";
import type { UserRole } from "@/types/database";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

export const mainNav: NavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "storekeeper", "subagent"],
  },
  {
    href: "/app/inventory",
    label: "Inventory",
    icon: Package,
    roles: ["owner", "storekeeper"],
  },
  {
    href: "/app/sales",
    label: "Sales",
    icon: ShoppingCart,
    roles: ["owner", "storekeeper", "subagent"],
  },
  {
    href: "/app/restock",
    label: "Restock",
    icon: Warehouse,
    roles: ["owner", "storekeeper"],
  },
  {
    href: "/app/closeout",
    label: "Daily closeout",
    icon: ClipboardCheck,
    roles: ["owner", "storekeeper"],
  },
  {
    href: "/app/adjustments",
    label: "Adjustments",
    icon: SlidersHorizontal,
    roles: ["owner", "storekeeper"],
  },
  {
    href: "/app/remittances",
    label: "Remittances",
    icon: Banknote,
    roles: ["owner", "storekeeper", "subagent"],
  },
];

export const catalogNav: NavItem[] = [
  {
    href: "/app/stores",
    label: "Stores",
    icon: Store,
    roles: ["owner"],
  },
  {
    href: "/app/brands",
    label: "Brands",
    icon: Cigarette,
    roles: ["owner"],
  },
  {
    href: "/app/subagents",
    label: "Subagents",
    icon: Users,
    roles: ["owner", "storekeeper", "subagent"],
  },
  {
    href: "/app/users",
    label: "Team",
    icon: UserCog,
    roles: ["owner"],
  },
];

export const insightNav: NavItem[] = [
  {
    href: "/app/reports",
    label: "Reports",
    icon: FileBarChart2,
    roles: ["owner", "storekeeper"],
  },
  {
    href: "/app/audit",
    label: "Audit trail",
    icon: Shield,
    roles: ["owner"],
  },
  {
    href: "/app/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["owner", "storekeeper", "subagent"],
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    roles: ["owner", "storekeeper", "subagent"],
  },
];

const MOBILE_TABS: Record<UserRole, string[]> = {
  owner: ["/app/dashboard", "/app/sales", "/app/inventory", "/app/reports"],
  storekeeper: [
    "/app/dashboard",
    "/app/sales",
    "/app/inventory",
    "/app/closeout",
  ],
  subagent: [
    "/app/dashboard",
    "/app/sales",
    "/app/subagents",
    "/app/remittances",
  ],
};

const ALL_NAV = [...mainNav, ...catalogNav, ...insightNav];

export function getMobileTabs(role: UserRole): NavItem[] {
  const hrefs = MOBILE_TABS[role] || MOBILE_TABS.storekeeper;
  return hrefs
    .map((href) => ALL_NAV.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

export function navLabelForRole(item: NavItem, role: UserRole) {
  if (item.href === "/app/subagents" && role === "subagent") return "Batches";
  return item.label;
}
