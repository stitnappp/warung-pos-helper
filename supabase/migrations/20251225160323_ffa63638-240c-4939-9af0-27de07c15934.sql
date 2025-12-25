-- Create a helper function to check if user has staff role (admin or kasir)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'kasir')
  )
$$;

-- ============================================
-- Fix menu_categories RLS policies
-- ============================================
DROP POLICY IF EXISTS "Staff can manage categories" ON menu_categories;

CREATE POLICY "Staff can insert categories"
ON menu_categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update categories"
ON menu_categories
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete categories"
ON menu_categories
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

-- ============================================
-- Fix menu_items RLS policies
-- ============================================
DROP POLICY IF EXISTS "Staff can manage menu items" ON menu_items;

CREATE POLICY "Staff can insert menu items"
ON menu_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update menu items"
ON menu_items
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete menu items"
ON menu_items
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

-- ============================================
-- Fix restaurant_tables RLS policies
-- ============================================
DROP POLICY IF EXISTS "Staff can manage tables" ON restaurant_tables;

CREATE POLICY "Staff can insert tables"
ON restaurant_tables
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update tables"
ON restaurant_tables
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete tables"
ON restaurant_tables
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));

-- ============================================
-- Fix orders RLS policies
-- ============================================
DROP POLICY IF EXISTS "Staff can manage orders" ON orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON orders;

CREATE POLICY "Staff can view orders"
ON orders
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete orders"
ON orders
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Fix order_items RLS policies
-- ============================================
DROP POLICY IF EXISTS "Staff can manage order items" ON order_items;
DROP POLICY IF EXISTS "Staff can view all order items" ON order_items;

CREATE POLICY "Staff can view order items"
ON order_items
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert order items"
ON order_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update order items"
ON order_items
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete order items"
ON order_items
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));