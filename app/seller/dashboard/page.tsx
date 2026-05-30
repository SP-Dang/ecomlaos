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
    outOfStock: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchShopAndStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error || !data) { router.push('/register-shop'); return; }
      setShop(data);

      // Count total products
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', data.id);

      // Count out of stock products
      const { count: outOfStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', data.id)
        .eq('stock', 0);

      // Count low stock products (1-5 units)
      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', data.id)
        .gt('stock', 0)
        .lte('stock', 5);

      // Count unique orders
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('shop_id', data.id);
      const uniqueOrders = new Set(orderItems?.map(oi => oi.order_id) || []);

      // Total earnings
      const { data: earningsData } = await supabase
        .from('order_items')
        .select('seller_share')
        .eq('shop_id', data.id);
      const totalEarnings = earningsData?.reduce((sum, item) => sum + (item.seller_share || 0), 0) || 0;

      setStats({
        products: productsCount || 0,
        orders: uniqueOrders.size,
        earnings: totalEarnings,
        outOfStock: outOfStockCount || 0,
        lowStock: lowStockCount || 0,
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
      <p className="text-gray-600 mb-6">
        ສະຖານະ: {shop.is_active ? '🟢 ເປີດການໃຊ້ງານ' : '🟡 ລໍຖ້າອະນຸມັດ'}
      </p>

      {/* Stock alerts */}
      {(stats.outOfStock > 0 || stats.lowStock > 0) && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ ແຈ້ງເຕືອນສ່ວນ</h3>
          <div className="flex flex-wrap gap-4">
            {stats.outOfStock > 0 && (
              <Link href="/seller/products" className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200 transition">
                🔴 <span className="font-bold">{stats.outOfStock}</span> ສິນຄ້າໝົດສ່ວນ
              </Link>
            )}
            {stats.lowStock > 0 && (
              <Link href="/seller/products" className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-2 rounded hover:bg-orange-200 transition">
                🟠 <span className="font-bold">{stats.lowStock}</span> ສິນຄ້າໃກ້ໝົດ (≤5 ຊິ້ນ)
              </Link>
            )}
          </div>
          <p className="text-xs text-yellow-700 mt-2">ກົດທີ່ຄຳເຕືອນ ເພື່ອໄປຈັດການສ່ວນ</p>
        </div>
      )}

      {/* Main stats grid */}
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