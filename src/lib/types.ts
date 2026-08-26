export type UserRole = 'admin' | 'customer' | 'delegate';
export type OrderStatus = 'pending' | 'modified_by_owner' | 'approved' | 'out_for_delivery' | 'delivering' | 'completed' | 'returned' | 'cancelled';
export type PaymentMethod = 'cash' | 'credit';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
  role: UserRole;
  address: string | null;
  customer_code: string | null;
  store_name: string | null;
  credit_limit: number;
  previous_balance: number;
  current_debt?: number;
  credit_enabled?: boolean;
  is_credit_enabled?: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PricingTier {
  id: string;
  product_id: string;
  min_quantity: number;
  max_quantity: number | null;
  price_per_unit: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  sku_code: string | null;
  category_id: string;
  description: string | null;
  images: string[];
  unit: string;
  wholesale_unit: string;
  base_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  min_order_quantity: number;
  is_active: boolean;
  is_paused?: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  pricing_tiers?: PricingTier[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Order {
  id: string;
  order_number: string;
  invoice_no: string | null;
  customer_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  delivery_address: string | null;
  contact_phone: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  store_code: string;
  store_name_ref: string;
  delegate_name: string | null;
  previous_balance: number;
  paid_amount: number;
  remaining_amount?: number;
  total_amount?: number;
  delivery_fee?: number;
  shipping_fee?: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
  customer?: Profile;
  order_items?: OrderItem[];
}

export interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  received_by: string | null;
  created_at: string;
  customer?: Profile;
  receiver?: Profile;
}

export interface StockLog {
  id: string;
  product_id: string;
  quantity_change: number;
  reason: string | null;
  performed_by: string;
  created_at: string;
  product?: Product;
  performer?: Profile;
}

export interface DashboardStats {
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  total_products: number;
  low_stock_count: number;
  total_receivables: number;
  credit_customers: number;
  today_collections: number;
  recent_orders: Order[];
}
