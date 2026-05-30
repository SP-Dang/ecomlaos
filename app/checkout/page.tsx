'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// Helper: returns discounted price if discount is active, otherwise original price
const getFinalPrice = (price: number, discountPercent: number, discountEndsAt: string | null): number => {
  if (!discountPercent || discountPercent <= 0) return price;
  if (!discountEndsAt || new Date(discountEndsAt) <= new Date()) return price;
  return Math.round(price - (price * discountPercent / 100));
};

export default function CheckoutPage() {
  const { items, clearCart, loading: cartLoading } = useCart();
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // QR payment states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  useEffect(() => {
    if (!cartLoading && items.length === 0 && !showQrModal && paymentMethod !== 'lao_qr') {
      router.push('/cart');
    }
  }, [cartLoading, items, router, showQrModal, paymentMethod]);

  // Total using discounted prices
  const total = items.reduce((sum, i) => {
    const finalPrice = getFinalPrice(
      i.product.price,
      i.product.discount_percent,
      i.product.discount_ends_at
    );
    return sum + finalPrice * i.quantity;
  }, 0);

  const handlePlaceOrder = async () => {
    if (!shippingAddress) {
      setError('ກະລຸນາປ້ອນທີ່ຢູ່ຈັດສົ່ງ');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        localStorage.setItem('redirectAfterLogin', '/checkout');
        router.push('/login');
        return;
      }

      // Get commission rate
      const { data: commissionSetting } = await supabase
        .from('commission_settings')
        .select('default_rate')
        .single();
      const defaultCommission = commissionSetting?.default_rate || 10;

      // 1. Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total_amount: total,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          status: 'pending',
          payment_status: 'unpaid',
        })
        .select()
        .single();
      if (orderError) {
        setError(orderError.message);
        return;
      }

      // 2. Insert order items using discounted price
      const orderItems = items.map(item => {
        const finalPrice = getFinalPrice(
          item.product.price,
          item.product.discount_percent,
          item.product.discount_ends_at
        );
        return {
          order_id: order.id,
          product_id: item.product_id,
          shop_id: item.product.shop_id,
          quantity: item.quantity,
          price_at_purchase: finalPrice,
          seller_share: finalPrice * (1 - defaultCommission / 100),
          commission_charged: finalPrice * (defaultCommission / 100),
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) {
        setError(itemsError.message);
        return;
      }

      // 3. Deduct stock
      try {
        const functionUrl = 'https://wridxxzzulcfneofcazz.supabase.co/functions/v1/deduct-stock';
        await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            orderItems: orderItems.map(oi => ({
              product_id: oi.product_id,
              quantity: oi.quantity,
            })),
          }),
        });
      } catch (err) {
        console.error('Stock deduction failed:', err);
      }

      // 4. Handle payment method
      if (paymentMethod === 'lao_qr') {
        setCurrentOrderId(order.id);
        try {
          const qrRes = await fetch('/api/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, amount: total }),
          });
          if (qrRes.ok) {
            const blob = await qrRes.blob();
            const url = URL.createObjectURL(blob);
            setQrImageUrl(url);
            setShowQrModal(true);
            await clearCart();
          } else {
            setError('ບໍ່ສາມາດສ້າງ QR code, ກະລຸນາລອງໃໝ່');
            await clearCart();
            router.push(`/order/${order.id}`);
          }
        } catch (qrErr) {
          console.error('QR generation error:', qrErr);
          setError('ເກີດຂໍ້ຜິດພາດໃນການສ້າງ QR, ກະລຸນາລອງໃໝ່');
          await clearCart();
          router.push(`/order/${order.id}`);
        }
      } else {
        await clearCart();
        router.push(`/order/${order.id}`);
      }
    } catch (err: any) {
      console.error('handlePlaceOrder error:', err);
      setError('ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ກະລຸນາລອງໃໝ່'));
    } finally {
      setLoading(false);
    }
  };

  const submitTicket = async () => {
    if (!ticketNumber.trim()) {
      alert('ກະລຸນາໃສ່ເບິໂທ ແລະ ເລກອ້າງອິງ (6 ໂຕສຸດທ້າຍ) ຫຼັງຈາກໂອນເງິນສຳເລັດ');
      return;
    }
    if (!currentOrderId) return;
    setSubmittingTicket(true);
    try {
      const { data: pv, error: findError } = await supabase
        .from('payment_verifications')
        .select('id')
        .eq('order_id', currentOrderId)
        .single();
      if (findError || !pv) {
        alert('ບໍ່ພົບຂໍ້ມູນການຊຳລະ, ກະລຸນາຕິດຕໍ່ຜູ້ດູແລ');
        return;
      }
      const { error } = await supabase
        .from('payment_verifications')
        .update({
          ticket_number: ticketNumber,
          status: 'ticket_submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', pv.id);
      if (error) {
        alert(error.message);
      } else {
        alert('ຂອບໃຈສຳລັບການຊຳລະ. ຜູ້ດູແລລະບົບຈະກວດສອບເລກອ້າງອິງຂອງທ່ານ ແລະ ຢືນຢັນການສັ່ງຊື້.');
        setShowQrModal(false);
        setTicketNumber('');
        router.push(`/order/${currentOrderId}`);
      }
    } catch (err: any) {
      alert('ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ກະລຸນາລອງໃໝ່'));
    } finally {
      setSubmittingTicket(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {cartLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center p-8">ກຳລັງໂຫຼດກະຕ່າ...</div>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">ຊຳລະຄ່າສິນຄ້າ</h1>

      {/* Order summary */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h2 className="font-bold mb-2">ສິນຄ້າທີ່ສັ່ງ</h2>
        {items.map(item => {
          const finalPrice = getFinalPrice(
            item.product.price,
            item.product.discount_percent,
            item.product.discount_ends_at
          );
          const hasDiscount = finalPrice < item.product.price;
          return (
            <div key={item.id} className="flex justify-between text-sm mb-1">
              <span>{item.product.name_la} x{item.quantity}</span>
              <span className="text-right">
                {hasDiscount && (
                  <span className="text-gray-400 line-through mr-2">
                    {(item.product.price * item.quantity).toLocaleString()} ກີບ
                  </span>
                )}
                <span className={hasDiscount ? 'text-red-600 font-bold' : ''}>
                  {(finalPrice * item.quantity).toLocaleString()} ກີບ
                </span>
                {hasDiscount && (
                  <span className="ml-1 bg-red-100 text-red-600 text-xs px-1 rounded">
                    -{item.product.discount_percent}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div className="border-t pt-2 mt-2 font-bold flex justify-between">
          <span>ຍອດລວມ</span>
          <span className="text-green-600">{total.toLocaleString()} ກີບ</span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handlePlaceOrder(); }} className="space-y-4">
        <div>
          <label className="block font-medium">ທີ່ຢູ່ຈັດສົ່ງ</label>
          <textarea
            required
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
            placeholder="ບ້ານ, ເມືອງ, ແຂວງ, ເບີໂທ"
          />
        </div>
        <div>
          <label className="block font-medium">ວິທີຊຳລະ</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="cod">ຊຳລະເມື່ອໄດ້ຮັບສິນຄ້າ (COD)</option>
            <option value="bank_transfer">ໂອນເງິນຜ່ານທະນາຄານ</option>
            <option value="lao_qr">ຊຳລະຜ່ານ QR Code (ທະນາຄານລາວ)</option>
          </select>
        </div>
        {error && <div className="text-red-500">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'ກຳລັງດຳເນີນການ...' : 'ຢືນຢັນການສັ່ງຊື້'}
        </button>
      </form>

      {/* QR Payment Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">ຊຳລະດ້ວຍ QR Code</h2>
            <div className="flex justify-center mb-4">
              {qrImageUrl && <img src={qrImageUrl} alt="QR Payment" className="w-64 h-64" />}
            </div>
            <p className="text-center text-sm mb-4">
              ສະແກນ QR ດ້ວຍແອັບທະນາຄານຂອງທ່ານ ແລະ ຊຳລະ.<br />
              ຫຼັງຈາກຊຳລະສຳເລັດ, ທ່ານຈະໄດ້ຮັບ <strong>ເລກອ້າງອິງ</strong> (ລະຫັດທຸລະກຳ).<br />
              ກະລຸນາປ້ອນເລກອ້າງອິງ 6 ໂຕເລກສຸດທ້າຍ ເພື່ອຢືນຢັນການຊຳລະ.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                ເບີໂທ - ເລກອ້າງອິງ (6 ໂຕເລກສຸດທ້າຍ)
              </label>
              <input
                type="text"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຕົວຢ່າງ: 0205511234-123456"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/order/${currentOrderId}`)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
              >
                ຂ້າມ
              </button>
              <button
                onClick={submitTicket}
                disabled={submittingTicket}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {submittingTicket ? 'ກຳລັງສົ່ງ...' : 'ຢືນຢັນ Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}