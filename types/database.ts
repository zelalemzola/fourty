export type UserRole = "owner" | "storekeeper" | "subagent";
export type SaleChannel = "store" | "subagent";
export type BatchStatus = "active" | "partially_returned" | "settled" | "overdue";
export type NotificationType =
  | "sale"
  | "restock"
  | "low_stock"
  | "report"
  | "batch"
  | "settlement"
  | "user"
  | "system"
  | "audit";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  store_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stores?: Store | null;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  carton_size: number;
  unit_price: number;
  cost_price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  store_id: string;
  brand_id: string;
  quantity: number;
  min_stock: number;
  updated_at: string;
  stores?: Store;
  brands?: Brand;
}

export interface Restock {
  id: string;
  store_id: string;
  brand_id: string;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  performed_by: string;
  created_at: string;
  stores?: Store;
  brands?: Brand;
  profiles?: Profile;
}

export interface SubagentBatch {
  id: string;
  store_id: string;
  subagent_id: string;
  brand_id: string;
  quantity_taken: number;
  quantity_sold: number;
  quantity_returned: number;
  quantity_in_hand: number;
  status: BatchStatus;
  notes: string | null;
  issued_by: string;
  issued_at: string;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  stores?: Store;
  brands?: Brand;
  subagent?: Profile;
  issuer?: Profile;
}

export interface Sale {
  id: string;
  store_id: string;
  brand_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  channel: SaleChannel;
  sold_by: string;
  subagent_id: string | null;
  batch_id: string | null;
  screenshot_url: string;
  notes: string | null;
  sold_at: string;
  created_at: string;
  stores?: Store;
  brands?: Brand;
  seller?: Profile;
  subagent?: Profile;
}

export interface DailyReport {
  id: string;
  store_id: string;
  report_date: string;
  total_sales_amount: number;
  total_cartons_sold: number;
  total_transactions: number;
  notes: string | null;
  submitted_by: string | null;
  created_at: string;
  stores?: Store;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  link: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  store_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  stores?: Store;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface DateRangeFilter {
  from?: string;
  to?: string;
  preset?: "today" | "week" | "month" | "quarter" | "year" | "custom";
}

export interface DashboardStats {
  totalRevenue: number;
  totalCartonsSold: number;
  totalTransactions: number;
  lowStockCount: number;
  activeStores: number;
  activeSubagents: number;
  inventoryValue: number;
  pendingBatches: number;
  revenueChange: number;
  salesChange: number;
}

export interface MinStockUpdate {
  store_id: string;
  brand_id: string;
  min_stock: number;
}

export type CloseoutStatus = "draft" | "submitted" | "reviewed";
export type AdjustmentReason =
  | "damage"
  | "shrinkage"
  | "count_correction"
  | "return_to_supplier"
  | "other";
export type RemittanceStatus = "pending" | "confirmed" | "rejected";

export interface StockSnapshotItem {
  brand_id: string;
  brand_name: string;
  quantity: number;
  min_stock: number;
}

export interface DailyCloseout {
  id: string;
  store_id: string;
  closeout_date: string;
  opening_notes: string | null;
  closing_notes: string | null;
  total_sales_amount: number;
  total_cartons_sold: number;
  total_transactions: number;
  cash_declared: number;
  stock_snapshot: StockSnapshotItem[];
  status: CloseoutStatus;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  stores?: Store;
  submitter?: Profile;
}

export interface StockAdjustment {
  id: string;
  store_id: string;
  brand_id: string;
  quantity_delta: number;
  reason: AdjustmentReason;
  notes: string | null;
  performed_by: string;
  created_at: string;
  stores?: Store;
  brands?: Brand;
  profiles?: Profile;
}

export interface Remittance {
  id: string;
  store_id: string;
  submitted_by: string;
  subagent_id: string | null;
  amount: number;
  method: string;
  reference_code: string | null;
  proof_url: string | null;
  notes: string | null;
  status: RemittanceStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  stores?: Store;
  submitter?: Profile;
  subagent?: Profile;
}

export interface UserPreferences {
  user_id: string;
  notify_sales: boolean;
  notify_restock: boolean;
  notify_low_stock: boolean;
  notify_batches: boolean;
  notify_reports: boolean;
  notify_remittances: boolean;
  notify_closeouts: boolean;
  notify_users: boolean;
  notify_system: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  id: number;
  company_name: string;
  company_phone: string | null;
  company_address: string | null;
  company_city: string | null;
  currency_code: string;
  timezone: string;
  default_min_stock: number;
  require_sale_screenshot: boolean;
  require_remittance_proof: boolean;
  allow_negative_stock: boolean;
  closeout_reminder_hour: number;
  fiscal_year_start_month: number;
  updated_by: string | null;
  updated_at: string;
}

export interface PushDevice {
  id: string;
  user_id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
}

