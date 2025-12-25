export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  created_at: string;
}

export interface Order {
  id: string;
  table_id: string | null;
  user_id: string | null;
  customer_name: string | null;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}