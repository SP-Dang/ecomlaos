// hooks/useCart.ts
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

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cartIdRef = useRef<string | null>(null);

  const getOrCreateCart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let sessionId: string | null = null;
    if (!user) {
      sessionId = localStorage.getItem('guest_cart_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('guest_cart_id', sessionId);
      }
    }

    if (cartIdRef.current) return cartIdRef.current;

    let query = supabase.from('carts').select('id');
    if (user) query = query.eq('user_id', user.id);
    else query = query.eq('session_id', sessionId!);

    const { data: existingCart } = await query.maybeSingle();
    if (existingCart) {
      cartIdRef.current = existingCart.id;
      return existingCart.id;
    }

    const insertData: { user_id?: string; session_id?: string } = {};
    if (user) insertData.user_id = user.id;
    else insertData.session_id = sessionId!;

    const { data: newCart, error } = await supabase
      .from('carts')
      .insert(insertData)
      .select()
      .single();
    if (error) {
      console.error('Failed to create cart:', error);
      throw error;
    }
    cartIdRef.current = newCart.id;
    return newCart.id;
  };

  const fetchCart = async () => {
    setLoading(true);
    const cid = await getOrCreateCart();
    setCartId(cid);

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        product_id,
        quantity,
        product:products (
          id,
          name_la,
          price,
          stock,
          images,
          shop_id,
          discount_percent,
          discount_ends_at,
          shops (name_la, slug)
        )
      `)
      .eq('cart_id', cid);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const mappedItems: CartItem[] = (data || []).map((item: any) => {
      const productData = item.product;
      const shopData = productData.shops;
      return {
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: {
          id: productData.id,
          name_la: productData.name_la,
          price: productData.price,
          stock: productData.stock,
          images: productData.images || [],
          shop_id: productData.shop_id,
          discount_percent: productData.discount_percent || 0,
          discount_ends_at: productData.discount_ends_at || null,
          shops: shopData,
        },
      };
    });

    setItems(mappedItems);
    setLoading(false);
  };

  const addToCart = async (productId: string, quantity: number = 1) => {
    const cid = await getOrCreateCart();
    const existing = items.find(i => i.product_id === productId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQty })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert({ cart_id: cid, product_id: productId, quantity });
      if (error) throw error;
    }
    await fetchCart();
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(itemId);
      return;
    }
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId);
    if (error) throw error;
    await fetchCart();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) throw error;
    await fetchCart();
  };

  const clearCart = async () => {
    if (!cartId) return;
    const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
    if (error) throw error;
    setItems([]);
  };

  useEffect(() => {
    fetchCart();
  }, []);

  return { items, loading, addToCart, updateQuantity, removeItem, clearCart, cartId, refetch: fetchCart };
}