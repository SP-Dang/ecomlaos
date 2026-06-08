'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';

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
  const { locale, t } = useLanguage();

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
    return t(status);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('seller_orders_title')}</h1>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder={t('filter_search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          />
          <input
            type="date"
            placeholder={t('filter_start_date')}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          />
          <input
            type="date"
            placeholder={t('filter_end_date')}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          />
          <select
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          >
            <option value="all">{t('filter_all_orders')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="confirmed">{t('confirmed')}</option>
            <option value="processing">{t('processing')}</option>
            <option value="shipped">{t('shipped')}</option>
            <option value="delivered">{t('delivered')}</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          >
            <option value="all">{t('filter_all_payments')}</option>
            <option value="unpaid">{t('unpaid')}</option>
            <option value="paid">{t('paid')}</option>
          </select>
        </div>
        <button onClick={resetFilters} className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer">
          {t('clear_filters')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">{t('loading')}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{locale === 'en' ? 'No orders' : 'ບໍ່ມີຄຳສັ່ງ'}</div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((item) => (
            <div key={item.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1 flex-1 min-w-0 text-sm">
                  <p><strong>{t('buyer_name')}:</strong> {item.orders?.buyer_name}</p>
                  {item.orders?.buyer_phone && (
                    <p><strong>{t('buyer_phone')}:</strong> {item.orders.buyer_phone}</p>
                  )}
                  <p><strong>{locale === 'en' ? 'Product' : 'ສິນຄ້າ'}:</strong> {item.products?.name_la}{item.variant_name ? ` (${item.variant_name})` : ''}</p>
                  <p><strong>{t('quantity')}:</strong> {item.quantity}</p>
                  <p><strong>{locale === 'en' ? 'Price at Purchase:' : 'ລາຄາຕອນຊື້:'}</strong> {formatNumber(item.price_at_purchase)} ກີບ</p>
                  <p><strong>{locale === 'en' ? 'Order Total:' : 'ຍອດລວມຄຳສັ່ງ:'}</strong> {formatNumber(item.orders?.total_amount)} ກີບ</p>
                  <p><strong>{t('shipping_address')}:</strong> {item.orders?.shipping_address}</p>
                </div>
                {/* Print Label Button */}
                <a
                  href={`/seller/orders/${item.orders?.id}/label`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2.5 sm:py-2 rounded text-sm hover:bg-indigo-700 transition font-medium cursor-pointer"
                >
                  {t('print_label')}
                </a>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 items-center text-sm border-t pt-3">
                <div>
                  <span className="font-semibold">{t('payment_status')}:</span>{' '}
                  {item.orders?.payment_status === 'paid' ? (
                    <span className="text-green-600 font-medium">{t('paid')}</span>
                  ) : (
                    <span className="text-red-600 font-medium">{t('unpaid')}</span>
                  )}
                </div>
                {item.orders?.payment_status !== 'paid' && (
                  <button
                    onClick={() => handleMarkPaid(item.orders.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm cursor-pointer"
                  >
                    {t('confirm_payment_btn')}
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <label className="font-semibold">{t('order_status')}:</label>
                  <select
                    value={item.orders?.status}
                    onChange={(e) => handleStatusChange(item.orders.id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value="pending">{t('pending')}</option>
                    <option value="confirmed">{t('confirmed')}</option>
                    <option value="processing">{t('processing')}</option>
                    <option value="shipped">{t('shipped')}</option>
                    <option value="delivered">{t('delivered')}</option>
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
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 cursor-pointer"
          >
            {t('pagination_prev')}
          </button>
          <span className="px-3 py-1 text-sm">
            {locale === 'en' ? `Page ${currentPage} / ${totalPages}` : `ໜ້າ ${currentPage} / ${totalPages}`}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 cursor-pointer"
          >
            {t('pagination_next')}
          </button>
        </div>
      )}
    </div>
  );
}