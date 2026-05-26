// app/admin/orders/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_purchase,
          products (name_la),
          shops (name_la)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (searchTerm.trim()) {
      // Exact match on order ID (UUID)
      query = query.eq('id', searchTerm);
    }
    if (orderStatus !== 'all') {
      query = query.eq('status', orderStatus);
    }
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const { data, error, count } = await query.range(from, to);
    if (!error && data) {
      const userIds = [...new Set(data.map(o => o.user_id).filter(Boolean))];
      let buyerMap = new Map();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        buyerMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      }
      const ordersWithBuyer = data.map(order => ({
        ...order,
        buyer_name: buyerMap.get(order.user_id) || order.user_id.slice(0,8)
      }));
      setOrders(ordersWithBuyer);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } else {
      if (error) console.error(error);
    }
    setLoading(false);
  }, [searchTerm, orderStatus, startDate, endDate, currentPage, itemsPerPage]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      if (profile?.role !== 'admin') router.push('/');
      else fetchOrders();
    };
    checkAdmin();
  }, [fetchOrders, router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, orderStatus, startDate, endDate]);

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: 'ລໍຖ້າການຢືນຢັນ',
      confirmed: 'ຢືນຢັນແລ້ວ',
      processing: 'ກຳລັງກະກຽມ',
      shipped: 'ຈັດສົ່ງແລ້ວ',
      delivered: 'ລູກຄ້າໄດ້ຮັບສິນຄ້າ',
      cancelled: 'ຍົກເລີກ',
      refunded: 'ຄືນເງິນ',
    };
    return map[status] || status;
  };

  const getPaymentStatusText = (status: string) => {
    return status === 'paid' ? 'ຊຳລະແລ້ວ' : status === 'unpaid' ? 'ຍັງບໍ່ທັນຊຳລະ' : status;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setOrderStatus('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ຄຳສັ່ງທັງໝົດ</h1>

      <div className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="ຄົ້ນຫາຕາມລະຫັດຄຳສັ່ງ (ສຳເນົາ UUID)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-1"
          />
          <select
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="border rounded px-3 py-1"
          >
            <option value="all">ສະຖານະຄຳສັ່ງທັງໝົດ</option>
            <option value="pending">ລໍຖ້າການຢືນຢັນ</option>
            <option value="confirmed">ຢືນຢັນແລ້ວ</option>
            <option value="processing">ກຳລັງກະກຽມ</option>
            <option value="shipped">ຈັດສົ່ງແລ້ວ</option>
            <option value="delivered">ລູກຄ້າໄດ້ຮັບສິນຄ້າ</option>
            <option value="cancelled">ຍົກເລີກ</option>
            <option value="refunded">ຄືນເງິນ</option>
          </select>
          <input
            type="date"
            placeholder="ວັນທີເລີ່ມ"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-1"
          />
          <input
            type="date"
            placeholder="ວັນທີສິ້ນສຸດ"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-1"
          />
          <button
            onClick={resetFilters}
            className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
          >
            ລ້າງຕົວກອງ
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">ກຳລັງໂຫຼດ...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ບໍ່ມີຄຳສັ່ງ</div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="flex justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm text-gray-500">ລະຫັດຄຳສັ່ງ: {order.id}</p>
                  <p className="text-sm">ຜູ້ສັ່ງ: {order.buyer_name}</p>
                  <p className="text-sm">ຍອດລວມ: <strong>{formatNumber(order.total_amount)} ກີບ</strong></p>
                  <p className="text-sm">ສະຖານະ: {getStatusText(order.status)}</p>
                  <p className="text-sm">ການຊຳລະ: {getPaymentStatusText(order.payment_status)}</p>
                  <p className="text-sm">ວັນທີສັ່ງ: {new Date(order.created_at).toLocaleDateString('lo-LA')}</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>ທີ່ຢູ່ຈັດສົ່ງ:</strong></p>
                  <p>{order.shipping_address}</p>
                </div>
              </div>
              <div className="mt-3 border-t pt-2">
                <p className="font-semibold">ສິນຄ້າ:</p>
                {order.order_items?.map((item: any, idx: number) => (
                  <div key={idx} className="text-sm flex justify-between">
                    <span>{item.products?.name_la} x {item.quantity}</span>
                    <span>{formatNumber(item.price_at_purchase * item.quantity)} ກີບ (ຮ້ານ: {item.shops?.name_la})</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            ກ່ອນໜ້າ
          </button>
          <span className="px-3 py-1">
            ໜ້າ {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            ຕໍ່ໄປ
          </button>
        </div>
      )}
    </div>
  );
}