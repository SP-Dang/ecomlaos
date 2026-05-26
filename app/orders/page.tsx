'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const router = useRouter();

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
    const map: Record<string, string> = {
      pending: 'ລໍຖ້າການຢືນຢັນ',
      confirmed: 'ຢືນຢັນແລ້ວ',
      processing: 'ກຳລັງກະກຽມ',
      shipped: 'ຈັດສົ່ງແລ້ວ',
      delivered: 'ລູກຄ້າໄດ້ຮັບສິນຄ້າ',
    };
    return map[status] || status;
  };

  const getPaymentStatusText = (status: string) => {
    return status === 'paid' ? 'ຊຳລະແລ້ວ' : 'ຍັງບໍ່ທັນຊຳລະ';
  };

  if (loading) return <div className="text-center p-8">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ປະຫວັດການສັ່ງຊື້</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="ຄົ້ນຫາຕາມຊື່ສິນຄ້າ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 border rounded px-3 py-2"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-center text-gray-500">ບໍ່ມີຄຳສັ່ງຊື້</p>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <p className="text-sm text-gray-500">
                    ວັນທີສັ່ງ: {new Date(order.created_at).toLocaleDateString('lo-LA')}
                  </p>
                  <p className="text-sm font-mono">ລະຫັດ: {order.id.slice(0, 8)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {order.total_amount.toLocaleString()} ກີບ
                  </p>
                  <p className="text-sm">
                    ສະຖານະ: {getStatusText(order.status)}
                  </p>
                  <p className="text-sm">
                    ການຊຳລະ: {getPaymentStatusText(order.payment_status)}
                  </p>
                </div>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="font-semibold mb-2">ສິນຄ້າທີ່ສັ່ງ:</p>
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
                  className="text-blue-600 hover:underline text-sm"
                >
                  ເບິ່ງລາຍລະອຽດ
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}