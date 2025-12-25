import { useState, useCallback } from 'react';
import { CartItem, MenuItem } from '@/types/pos';
import { toast } from 'sonner';

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((menuItem: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(item =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
    toast.success(`${menuItem.name} ditambahkan ke keranjang`);
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart(prev => prev.filter(item => item.menuItem.id !== menuItemId));
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.menuItem.id === menuItemId
          ? { ...item, quantity }
          : item
      )
    );
  }, [removeFromCart]);

  const updateNotes = useCallback((menuItemId: string, notes: string) => {
    setCart(prev =>
      prev.map(item =>
        item.menuItem.id === menuItemId
          ? { ...item, notes }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const tax = subtotal * 0;
  const total = subtotal + tax;

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateNotes,
    clearCart,
    subtotal,
    tax,
    total,
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
  };
}