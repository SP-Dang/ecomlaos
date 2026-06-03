'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';

export default function ShippingLabelPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLabel = async () => {
      try {
        // Get current seller's shop
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('ກະລຸນາເຂົ້າສູ່ລະບົບ'); setLoading(false); return; }

        const { data: shop, error: shopErr } = await supabase
          .from('shops')
          .select('id, name_la')
          .eq('owner_id', user.id)
          .maybeSingle();
        if (shopErr || !shop) { setError('ບໍ່ພົບຮ້ານຂອງທ່ານ'); setLoading(false); return; }
        setShopName(shop.name_la || 'ຮ້ານຂາຍ');

        // Get seller's own phone from profiles
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .maybeSingle();
        setShopPhone(sellerProfile?.phone || '');

        // Fetch the order
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('id, created_at, shipping_address, total_amount, payment_method, status, user_id')
          .eq('id', orderId)
          .single();
        if (orderErr || !orderData) { setError('ບໍ່ພົບຄຳສັ່ງ'); setLoading(false); return; }

        // Fetch buyer profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', orderData.user_id)
          .single();

        setOrder({ ...orderData, buyer_name: profile?.full_name || 'ບໍ່ລະບຸ', buyer_phone: profile?.phone || '' });

        // Fetch order items that belong to this seller's shop only
        const { data: items } = await supabase
          .from('order_items')
          .select('*, products (name_la)')
          .eq('order_id', orderId)
          .eq('shop_id', shop.id);

        setShopItems(items || []);
      } catch (e: any) {
        setError('ເກີດຂໍ້ຜິດພາດ: ' + e.message);
      }
      setLoading(false);
    };
    if (orderId) fetchLabel();
  }, [orderId]);

  const handlePrint = () => window.print();

  const shortId = (id: string) => id?.slice(-8).toUpperCase() || '';
  const formatDate = (d: string) => new Date(d).toLocaleDateString('lo-LA', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const formatNumber = (n: number) => n?.toLocaleString('en-US') || '0';
  const isCOD = order?.payment_method === 'cod';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">ກຳລັງໂຫຼດ...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-500">{error}</p>
    </div>
  );

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .label-wrapper { padding: 0; }
          .label-card {
            width: 10cm;
            min-height: 15cm;
            border: 2px dashed #000 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
        @page {
          size: 10cm 15cm;
          margin: 0.3cm;
        }
      `}</style>

      {/* Screen: action bar */}
      <div className="no-print bg-gray-100 border-b px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">🖨️ ພິມປ້າຍຈັດສົ່ງ</h1>
        <div className="flex gap-3">
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
          >
            ✕ ປິດ
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-semibold text-sm"
          >
            🖨️ ພິມ
          </button>
        </div>
      </div>

      {/* Label wrapper — centered on screen */}
      <div className="label-wrapper min-h-screen bg-gray-200 flex items-center justify-center p-8">
        <div
          className="label-card bg-white border-2 border-dashed border-gray-800 rounded-lg shadow-xl"
          style={{ width: '10cm', minHeight: '15cm', fontFamily: "'Noto Sans Lao', 'Phetsarath OT', sans-serif" }}
        >
          {/* Header: shop logo area */}
          <div className="bg-gray-800 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-300">ຈາກ (From)</div>
              <div className="font-bold text-base">{shopName}</div>
              {shopPhone && <div className="text-xs text-gray-300">{shopPhone}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-300">ລະຫັດ</div>
              <div className="font-mono text-sm font-bold tracking-widest">#{shortId(order.id)}</div>
              <div className="text-xs text-gray-300">{formatDate(order.created_at)}</div>
            </div>
          </div>

          {/* COD Banner — only shown for cash on delivery */}
          {isCOD && (
            <div className="bg-orange-500 text-white text-center py-2 px-4">
              <span className="text-xs font-semibold">💵 ເກັບເງິນປາຍທາງ (COD)</span>
              <div className="text-2xl font-black tracking-wide">
                {formatNumber(order.total_amount)} ກີບ
              </div>
            </div>
          )}

          {/* Recipient */}
          <div className="px-4 pt-4 pb-2 border-b border-gray-300">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">📍 ຮັບ (To)</div>
            <div className="text-xl font-bold text-gray-900 leading-tight">{order.buyer_name}</div>
            {order.buyer_phone && (
              <div className="text-base font-semibold text-gray-700 mt-1">📞 {order.buyer_phone}</div>
            )}
            <div className="text-sm text-gray-800 mt-2 leading-relaxed whitespace-pre-line">
              {order.shipping_address}
            </div>
          </div>

          {/* Items */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-300">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-2">🛍️ ສິນຄ້າ</div>
            {shopItems.map((item, i) => (
              <div key={i} className="flex justify-between items-start text-sm mb-1">
                <div className="flex-1">
                  <span className="font-medium">{item.products?.name_la}</span>
                  {item.variant_name && (
                    <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {item.variant_name}
                    </span>
                  )}
                </div>
                <div className="ml-2 text-gray-600 flex-shrink-0">x{item.quantity}</div>
              </div>
            ))}
          </div>

          {/* Total (non-COD) */}
          {!isCOD && (
            <div className="px-4 py-2 border-b border-gray-300 flex justify-between text-sm">
              <span className="font-semibold text-gray-600">ຍອດລວມ</span>
              <span className="font-bold">{formatNumber(order.total_amount)} ກີບ</span>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 text-center text-xs text-gray-400">
            ຂອບໃຈທີ່ໃຊ້ບໍລິການ · ຮ້ານຄ້າລາວ
          </div>
        </div>
      </div>
    </>
  );
}
