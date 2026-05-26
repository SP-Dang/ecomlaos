'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SellerDashboard() {
  const [shop, setShop] = useState<any>(null);
  const [stats, setStats] = useState({
    products: 0,
    orders: 0,
    earnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchShopAndStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get shop
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error || !data) {
        router.push('/register-shop');
        return;
      }
      setShop(data);

      // Count products
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', data.id);

      // Count unique orders for this shop
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('shop_id', data.id);
      const uniqueOrders = new Set(orderItems?.map(oi => oi.order_id) || []);
      const ordersCount = uniqueOrders.size;

      // Calculate total earnings (from seller_earnings with status 'paid' or all? Let's use seller_share from order_items where order is paid/completed? Simpler: sum seller_share from order_items for this shop)
      const { data: earningsData } = await supabase
        .from('order_items')
        .select('seller_share')
        .eq('shop_id', data.id);
      const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.seller_share || 0), 0) || 0;

      setStats({
        products: productsCount || 0,
        orders: ordersCount,
        earnings: totalEarnings,
      });
      setLoading(false);
    };
    fetchShopAndStats();
  }, [router]);

  if (loading) return <div className="p-8">ກຳລັງໂຫຼດ...</div>;
  if (!shop) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{shop.name_la}</h1>
      <p className="text-gray-600 mb-6">ສະຖານະ: {shop.is_active ? 'ເປີດການໃຊ້ງານ' : 'ລໍຖ້າອະນຸມັດ'}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/seller/products" className="bg-blue-100 p-6 rounded-lg text-center hover:bg-blue-200 transition">
          <h2 className="text-2xl font-bold text-blue-800">{stats.products}</h2>
          <p className="text-xl font-semibold">ສິນຄ້າ</p>
          <p className="text-sm text-gray-600">ຈັດການສິນຄ້າທັງໝົດ</p>
        </Link>
        <Link href="/seller/orders" className="bg-green-100 p-6 rounded-lg text-center hover:bg-green-200 transition">
          <h2 className="text-2xl font-bold text-green-800">{stats.orders}</h2>
          <p className="text-xl font-semibold">ຄຳສັ່ງຊື້</p>
          <p className="text-sm text-gray-600">ເບິ່ງຄຳສັ່ງຂອງຮ້ານ</p>
        </Link>
        <Link href="/seller/earnings" className="bg-yellow-100 p-6 rounded-lg text-center hover:bg-yellow-200 transition">
          <h2 className="text-2xl font-bold text-yellow-800">{stats.earnings.toLocaleString()} ກີບ</h2>
          <p className="text-xl font-semibold">ລາຍຮັບ</p>
          <p className="text-sm text-gray-600">ເງິນທີ່ໄດ້ ແລະ ຖອນ</p>
        </Link>
      </div>

      {!shop.is_active && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          ຮ້ານຂອງທ່ານຍັງບໍ່ທັນໄດ້ຮັບການອະນຸມັດ. ກະລຸນາລໍຖ້າຜູ້ດູແລລະບົບ.
        </div>
      )}
    </div>
  );
}