export type StaffRole = "admin" | "server" | "kitchen";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
}

export type TableShape = "square" | "round" | "rectangle";

export interface Floor {
  id: string;
  name: string;
  sort_order: number;
}

export interface RestaurantTable {
  id: string;
  floor_id: string;
  label: string;
  seats: number;
  pos_x: number;
  pos_y: number;
  shape: TableShape;
  width: number;
  height: number;
}

// No tab row at all = "empty" table. Otherwise the tab moves through this lifecycle.
export type TabStatus = "seated" | "ordered" | "eating" | "needs_payment" | "closed";
export type PaymentMethod = "cash" | "card" | "other";

export interface Tab {
  id: string;
  table_id: string;
  status: TabStatus;
  server_id: string | null;
  guest_count: number;
  opened_at: string;
  closed_at: string | null;
  payment_method: PaymentMethod | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
}

export type OrderStatus = "pending" | "ready" | "served" | "cancelled";

export interface Order {
  id: string;
  tab_id: string;
  status: OrderStatus;
  created_at: string;
  created_by: string | null;
}

export type OrderItemStatus = "pending" | "ready" | "served" | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  note: string | null;
  status: OrderItemStatus;
  created_at: string;
}

export interface TabTotal {
  tab_id: string;
  total: number;
}

export interface SessionPayload {
  staffId: string;
  name: string;
  role: StaffRole;
  [key: string]: unknown;
}
