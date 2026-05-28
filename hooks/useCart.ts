'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name_la: string;
    price: number;
    stock: number;
    images: string[];
    shop_id: string;
    discount_percent: number;
    discount_ends_at: string | null;
    shops: { name_la: string; slug: string };
  };
}

interface GuestCartItem {
  product_id: string;
  quantity: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cartIdRef = useRef<string | null>(null);

  // ── Supabase cart (logged-in users only) ──────────────────────────
  const getOrCreateSupabaseCart = async (userId: string): Promise<string> => {
    if (cartIdRef.current) return cartIdRef.current;

    const { data: existing } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      cartIdRef.current = existing.id;
      return existing.id;
    }

    const { data: newCart, error } = await supabase
      .from('carts')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) throw error;
    cartIdRef.current = newCart.id;
    return newCart.id;
  };

  const fetchSupabaseCart = async (userId: string) => {
    const cid = await getOrCreateSupabaseCart(userId);
    setCartId(cid);

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id, product_id, quantity,
        product:products (
          id, name_la, price, stock, images, shop_id,
          discount_percent, discount_ends_at,
          shops (name_la, slug)
        )
      `)
      .eq('cart_id', cid);

    if (error) { console.error(error); setLoading(false); return; }

    setItems((data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name_la: item.product.name_la,
        price: item.product.price,
        stock: item.product.stock,
        images: item.product.images || [],
        shop_id: item.product.shop_id,
        discount_percent: item.product.discount_percent || 0,
        discount_ends_at: item.product.discount_ends_at || null,
        shops: item.product.shops,
      },
    })));
    setLoading(false);
  };

  // ── localStorage cart (guest users) ──────────────────────────────
  const fetchGuestCart = async () => {
    try {
      const raw = localStorage.getItem('guest_cart');
      const guestItems: GuestCartItem[] = raw ? JSON.parse(raw) : [];

      if (guestItems.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: products } = await supabase
        .from('products')
        .select('id, name_la, price, stock, images, shop_id, discount_percent, discount_ends_at, shops (name_la, slug)')
        .in('id', guestItems.map(i => i.product_id));

      setItems(
        guestItems
          .map(gi => {
            const p = products?.find(p => p.id === gi.product_id);
            if (!p) return null;
            return {
              id: `guest-${gi.product_id}`,
              product_id: gi.product_id,
              quantity: gi.quantity,
              product: {
                id: p.id,
                name_la: p.name_la,
                price: p.price,
                stock: p.stock,
                images: p.images || [],
                shop_id: p.shop_id,
                discount_percent: p.discount_percent || 0,
                discount_ends_at: p.discount_ends_at || null,
                shops: p.shops as any,
              },
            };
          })
          .filter(Boolean) as CartItem[]
      );
    } catch (e) {
      console.error('Guest cart error:', e);
      setItems([]);
    }
    setLoading(false);
  };

  // ── Main fetch ────────────────────────────────────────────────────
  const fetchCart = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await fetchSupabaseCart(user.id);
      else await fetchGuestCart();
    } catch (e) {
      console.error('fetchCart error:', e);
      setItems([]);
      setLoading(false);
    }
  };

  // ── Add to cart ───────────────────────────────────────────────────
  const addToCart = async (productId: string, quantity: number = 1) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const cid = await getOrCreateSupabaseCart(user.id);
      const existing = items.find(i => i.product_id === productId);
      if (existing) {
        await supabase.from('cart_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({ cart_id: cid, product_id: productId, quantity });
      }
      await fetchSupabaseCart(user.id);
    } else {
      const raw = localStorage.getItem('guest_cart');
      const guestItems: GuestCartItem[] = raw ? JSON.parse(raw) : [];
      const existing = guestItems.find(i => i.product_id === productId);
      if (existing) existing.quantity += quantity;
      else guestItems.push({ product_id: productId, quantity });
      localStorage.setItem('guest_cart', JSON.stringify(guestItems));
      await fetchGuestCart();
    }
  };

  // ── Update quantity ───────────────────────────────────────────────
  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) { await removeItem(itemId); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
      await fetchCart();
    } else {
      const productId = itemId.replace('guest-', '');
      const raw = localStorage.getItem('guest_cart');
      const guestItems: GuestCartItem[] = raw ? JSON.parse(raw) : [];
      const item = guestItems.find(i => i.product_id === productId);
      if (item) item.quantity = quantity;
      localStorage.setItem('guest_cart', JSON.stringify(guestItems));
      await fetchGuestCart();
    }
  };

  // ── Remove item ───────────────────────────────────────────────────
  const removeItem = async (itemId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('cart_items').delete().eq('id', itemId);
      await fetchCart();
    } else {
      const productId = itemId.replace('guest-', '');
      const raw = localStorage.getItem('guest_cart');
      const guestItems: GuestCartItem[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem('guest_cart', JSON.stringify(guestItems.filter(i => i.product_id !== productId)));
      await fetchGuestCart();
    }
  };

  // ── Clear cart ────────────────────────────────────────────────────
  const clearCart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && cartId) {
      await supabase.from('cart_items').delete().eq('cart_id', cartId);
    } else {
      localStorage.removeItem('guest_cart');
    }
    setItems([]);
  };

  useEffect(() => {
    fetchCart();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      cartIdRef.current = null;
      fetchCart();
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  return { items, loading, addToCart, updateQuantity, removeItem, clearCart, cartId, refetch: fetchCart };
}