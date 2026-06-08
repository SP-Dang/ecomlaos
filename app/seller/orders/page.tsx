'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SellerOrders() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [allOrderItems, setAllOrderItems] = useState<any[]>([]); // all items for current page (before client filters)
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');

  // Fetch raw order_items for the shop with pagination (no filters)
  const fetchOrderItems = useCallback(async (page: number) => {
    if (!shopId) return;
    setLoading(true);
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    // Simple query: get order_items for this shop with product and order details
    let query = supabase
      .from('order_items')
      .select(`
        *,
        products (name_la),
        orders (
          id,
          created_at,
          shipping_address,
          status,
          payment_status,
          total_amount,
          user_id
        )
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      setAllOrderItems([]);
      setTotalPages(1);
    } else {
      // Fetch buyer names separately for this batch
      const userIds = [...new Set(data?.map(item => item.orders?.user_id).filter(Boolean) || [])];
      let profileMap = new Map();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', userIds);
        profileMap = new Map(profiles?.map(p => [p.id, { full_name: p.full_name, phone: p.phone }]) || []);
      }
      // Attach buyer name + phone to each item
      const itemsWithBuyer = (data || []).map(item => {
        const profile = profileMap.get(item.orders?.user_id);
        return {
          ...item,
          orders: {
            ...item.orders,
            buyer_name: profile?.full_name || 'ບໍ່ລະບຸ',
            buyer_phone: profile?.phone || '',
          }
        };
      });
      setAllOrderItems(itemsWithBuyer);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    }
    setLoading(false);
  }, [shopId, itemsPerPage]);

  // Apply client-side filters to the current page items
  const applyFilters = useCallback(() => {
    let filtered = [...allOrderItems];
    // Search: product name or buyer name
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.products?.name_la?.toLowerCase().includes(term) ||
        item.orders?.buyer_name?.toLowerCase().includes(term)
      );
    }
    // Date range
    if (startDate) {
      filtered = filtered.filter(item => new Date(item.created_at) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(item => new Date(item.created_at) <= new Date(endDate));
    }
    // Order status
    if (orderStatus !== 'all') {
      filtered = filtered.filter(item => item.orders?.status === orderStatus);
    }
    // Payment status
    if (paymentStatus !== 'all') {
      filtered = filtered.filter(item => item.orders?.payment_status === paymentStatus);
    }
    setFilteredOrders(filtered);
  }, [allOrderItems, searchTerm, startDate, endDate, orderStatus, paymentStatus]);

  // Fetch when shopId or page changes
  useEffect(() => {
    if (shopId) fetchOrderItems(currentPage);
  }, [shopId, currentPage, fetchOrderItems]);

  // Re-apply filters whenever the current page data or filter criteria change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Reset page to 1 when filters change (so we fetch page 1 with new filters)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, orderStatus, paymentStatus]);

  // Get shop ID on mount
  useEffect(() => {
    const fetchShop = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      if (shop) setShopId(shop.id);
    };
    fetchShop();
  }, []);

  const handleMarkPaid = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId);
    if (error) alert(error.message);
    else fetchOrderItems(currentPage);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    if (error) alert(error.message);
    else fetchOrderItems(currentPage);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setOrderStatus('all');
    setPaymentStatus('all');
    setCurrentPage(1);
  };

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: 'ລໍຖ້າການຢືນຢັນ',
      confirmed: 'ຢືນຢັນແລ້ວ',
      processing: 'ກຳລັງກະກຽມ',
      shipped: 'ຈັດສົ່ງແລ້ວ',
      delivered: 'ລູກຄ້າໄດ້ຮັບສິນຄ້າ',
    };
    return map[status] || status;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ຄຳສັ່ງຊື້ຂອງຮ້ານ</h1>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="ຄົ້ນຫາ (ສິນຄ້າ / ຜູ້ຊື້)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-1"
          />
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
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="border rounded px-3 py-1"
          >
            <option value="all">ສະຖານະການຊຳລະທັງໝົດ</option>
            <option value="unpaid">ຍັງບໍ່ທັນຊຳລະ</option>
            <option value="paid">ຊຳລະແລ້ວ</option>
          </select>
        </div>
        <button onClick={resetFilters} className="mt-3 text-sm text-blue-600 hover:underline">
          ລ້າງຕົວກອງ
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">ກຳລັງໂຫຼດ...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ບໍ່ມີຄຳສັ່ງ</div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((item) => (
            <div key={item.id} className="border rounded p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <p><strong>ຊື່ຜູ້ຊື້:</strong> {item.orders?.buyer_name}</p>
                  {item.orders?.buyer_phone && (
                    <p><strong>ເບີໂທ:</strong> {item.orders.buyer_phone}</p>
                  )}
                  <p><strong>ສິນຄ້າ:</strong> {item.products?.name_la}{item.variant_name ? ` (${item.variant_name})` : ''}</p>
                  <p><strong>ຈຳນວນ:</strong> {item.quantity}</p>
                  <p><strong>ລາຄາຕອນຊື້:</strong> {formatNumber(item.price_at_purchase)} ກີບ</p>
                  <p><strong>ຍອດລວມຄຳສັ່ງ:</strong> {formatNumber(item.orders?.total_amount)} ກີບ</p>
                  <p><strong>ທີ່ຢູ່ຈັດສົ່ງ:</strong> {item.orders?.shipping_address}</p>
                </div>
                {/* Print Label Button */}
                <a
                  href={`/seller/orders/${item.orders?.id}/label`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2.5 sm:py-2 rounded text-sm hover:bg-indigo-700 transition font-medium"
                >
                  🖨️ ພິມປ້າຍ
                </a>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <div>
                  <span className="font-semibold">ສະຖານະການຊຳລະ:</span>{' '}
                  {item.orders?.payment_status === 'paid' ? (
                    <span className="text-green-600">ຊຳລະແລ້ວ</span>
                  ) : (
                    <span className="text-red-600">ຍັງບໍ່ທັນຊຳລະ</span>
                  )}
                </div>
                {item.orders?.payment_status !== 'paid' && (
                  <button
                    onClick={() => handleMarkPaid(item.orders.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                  >
                    ຢືນຢັນການຊຳລະ
                  </button>
                )}

                <div className="ml-auto">
                  <label className="font-semibold mr-2">ສະຖານະຄຳສັ່ງ:</label>
                  <select
                    value={item.orders?.status}
                    onChange={(e) => handleStatusChange(item.orders.id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="pending">ລໍຖ້າການຢືນຢັນ</option>
                    <option value="confirmed">ຢືນຢັນແລ້ວ</option>
                    <option value="processing">ກຳລັງກະກຽມ</option>
                    <option value="shipped">ຈັດສົ່ງແລ້ວ</option>
                    <option value="delivered">ລູກຄ້າໄດ້ຮັບສິນຄ້າ</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
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