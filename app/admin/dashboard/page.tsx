// app/admin/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalShops: 0,
    pendingShops: 0,
    totalOrders: 0,
    totalCommission: 0,
    pendingWithdrawals: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      if (profile?.role !== 'admin') router.push('/');

      // Shops
      const { count: totalShops } = await supabase.from('shops').select('*', { count: 'exact', head: true });
      const { count: pendingShops } = await supabase.from('shops').select('*', { count: 'exact', head: true }).eq('is_active', false);

      // Orders
      const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });

      // Total commission (sum of commission_charged from order_items)
      const { data: commissionData } = await supabase.from('order_items').select('commission_charged');
      const totalCommission = commissionData?.reduce((sum, item) => sum + (item.commission_charged || 0), 0) || 0;

      // Pending withdrawals
      const { count: pendingWithdrawals } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      setStats({
        totalShops: totalShops || 0,
        pendingShops: pendingShops || 0,
        totalOrders: totalOrders || 0,
        totalCommission,
        pendingWithdrawals: pendingWithdrawals || 0,
      });
    };
    fetchStats();
  }, []);

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">ແຜງຄວບຄຸມຜູ້ດູແລລະບົບ</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Shops card */}
        <Link href="/admin/shops" className="bg-blue-100 p-6 rounded-lg text-center hover:bg-blue-200 transition block">
          <h2 className="text-2xl font-bold text-blue-800">{stats.totalShops}</h2>
          <p className="text-xl font-semibold">ຮ້ານຄ້າ</p>
          <p className="text-sm text-gray-600">ທັງໝົດ: {stats.totalShops} | ລໍຖ້າອະນຸມັດ: {stats.pendingShops}</p>
        </Link>

        {/* Orders card */}
        <Link href="/admin/orders" className="bg-green-100 p-6 rounded-lg text-center hover:bg-green-200 transition block">
          <h2 className="text-2xl font-bold text-green-800">{stats.totalOrders}</h2>
          <p className="text-xl font-semibold">ຄຳສັ່ງຊື້</p>
          <p className="text-sm text-gray-600">ທັງໝົດ</p>
        </Link>

        {/* Withdrawals card */}
        <Link href="/admin/withdrawals" className="bg-yellow-100 p-6 rounded-lg text-center hover:bg-yellow-200 transition block">
          <h2 className="text-2xl font-bold text-yellow-800">{stats.pendingWithdrawals}</h2>
          <p className="text-xl font-semibold">ຄຳຮ້ອງຂໍຖອນເງິນ</p>
          <p className="text-sm text-gray-600">ລໍຖ້າອະນຸມັດ</p>
        </Link>

        {/* Commission card (clickable) */}
        <Link href="/admin/reports" className="bg-purple-100 p-6 rounded-lg text-center hover:bg-purple-200 transition block">
          <h2 className="text-2xl font-bold text-purple-800">{formatNumber(stats.totalCommission)} ກີບ</h2>
          <p className="text-xl font-semibold">ຄ່າຄອມມິດຊັ່ນທັງໝົດ</p>
          <p className="text-sm text-gray-600">ລາຍຮັບຂອງ Platform (ກົດເພື່ອເບິ່ງລາຍລະອຽດ)</p>
        </Link>

        {/* Report overview card */}
        <Link href="/admin/reports/overview" className="bg-indigo-100 p-6 rounded-lg text-center hover:bg-indigo-200 transition block">
          <h2 className="text-2xl font-bold text-indigo-800">ລາຍງານພາບລວມ</h2>
          <p className="text-sm text-gray-600">GMV, ລາຍຮັບ, ສິນຄ້າຂາຍດີ, ສິນຄ້າຄົງເຫຼືອໜ້ອຍ</p>
        </Link>

        <Link href="/admin/customers" className="bg-teal-100 p-6 rounded-lg text-center hover:bg-teal-200 transition block">
          <h2 className="text-2xl font-bold text-teal-800">ຈັດການລູກຄ້າ</h2>
          <p className="text-sm text-gray-600">ຄົ້ນຫາ ແລະ ເບິ່ງຂໍ້ມູນລູກຄ້າ</p>
        </Link>
      </div>

      {/* New row for reported items and returns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <Link href="/admin/reports/shops" className="bg-red-100 p-6 rounded-lg text-center hover:bg-red-200 transition block">
          <h2 className="text-xl font-semibold">ຮ້ານທີ່ຖືກລາຍງານ</h2>
          <p className="text-sm text-gray-600">ຈັດການຮ້ານທີ່ຖືກລາຍງານ</p>
        </Link>
        <Link href="/admin/reports/products" className="bg-orange-100 p-6 rounded-lg text-center hover:bg-orange-200 transition block">
          <h2 className="text-xl font-semibold">ສິນຄ້າທີ່ຖືກລາຍງານ</h2>
          <p className="text-sm text-gray-600">ຈັດການສິນຄ້າທີ່ຖືກລາຍງານ</p>
        </Link>
        <Link href="/admin/returns" className="bg-pink-100 p-6 rounded-lg text-center hover:bg-pink-200 transition block">
          <h2 className="text-xl font-semibold">ຄຳຮ້ອງຂໍເງິນຄືນ</h2>
          <p className="text-sm text-gray-600">ອະນຸມັດ / ປະຕິເສດ / ຄືນເງິນ</p>
        </Link>
        <Link href="/admin/payments" className="bg-pink-100 p-6 rounded-lg text-center hover:bg-pink-200 transition block">
          <h2 className="text-2xl font-bold text-pink-800">ຢືນຢັນການຊຳລະ QR</h2>
          <p className="text-sm text-gray-600">ກວດສອບ ເລກ Ticket ຈາກທະນາຄານ</p>
        </Link>
      </div>
    </div>
  );
}