'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function MyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const router = useRouter();
  const { locale, t } = useLanguage();

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch all orders for this user with their order items and product names
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price_at_purchase,
            products (name_la, images)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setOrders(data || []);
        setFilteredOrders(data || []);
      }
      setLoading(false);
    };
    fetchOrders();
  }, [router]);

  // Filter orders by product name (client‑side)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOrders(orders);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = orders.filter(order =>
        order.order_items?.some((item: any) =>
          item.products?.name_la?.toLowerCase().includes(term)
        )
      );
      setFilteredOrders(filtered);
    }
  }, [searchTerm, orders]);

  const getStatusText = (status: string) => {
    return t(status);
  };

  const getPaymentStatusText = (status: string) => {
    return t(status);
  };

  if (loading) return <div className="text-center p-8">{t('loading')}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('order_history')}</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder={t('search_orders_placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 border rounded px-3 py-2"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-center text-gray-500">{t('no_orders')}</p>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <p className="text-sm text-gray-500">
                    {t('order_date')}: {new Date(order.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'lo-LA')}
                  </p>
                  <p className="text-sm font-mono">{t('order_code')}: {order.id.slice(0, 8)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {order.total_amount.toLocaleString()} ກີບ
                  </p>
                  <p className="text-sm">
                    {t('order_status')}: {getStatusText(order.status)}
                  </p>
                  <p className="text-sm">
                    {t('payment_status')}: {getPaymentStatusText(order.payment_status)}
                  </p>
                </div>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="font-semibold mb-2">{t('ordered_items')}:</p>
                {order.order_items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm mb-1">
                    <span>{item.products?.name_la} x {item.quantity}</span>
                    <span>{(item.price_at_purchase * item.quantity).toLocaleString()} ກີບ</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <Link
                  href={`/order/${order.id}`}
                  className="text-blue-600 hover:underline text-sm cursor-pointer"
                >
                  {t('view_details')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}