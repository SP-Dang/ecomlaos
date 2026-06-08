'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

const getFinalPrice = (
  price: number,
  discountPercent: number,
  discountEndsAt: string | null,
  variantPriceAdjustment: number = 0
): number => {
  // 1. Apply discount to the base product price only
  let discountedBase = price;
  if (discountPercent > 0 && discountEndsAt && new Date(discountEndsAt) > new Date()) {
    discountedBase = Math.round(price - (price * discountPercent / 100));
  }
  // 2. Add variant price adjustment on top (not discounted)
  return discountedBase + variantPriceAdjustment;
};

export default function CheckoutPage() {
  const { items, clearCart, loading: cartLoading } = useCart();
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { locale, t } = useLanguage();

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    if (!cartLoading && items.length === 0 && !showQrModal && paymentMethod !== 'lao_qr' && !orderPlaced) {
      router.push('/cart');
    }
  }, [cartLoading, items, router, showQrModal, paymentMethod, orderPlaced]);

  const total = items.reduce((sum, i) => {
    const finalPrice = getFinalPrice(i.product.price, i.product.discount_percent, i.product.discount_ends_at, i.variant_price_adjustment);
    return sum + finalPrice * i.quantity;
  }, 0);

  const handlePlaceOrder = async () => {
    if (!shippingAddress) { setError(t('input_shipping_address')); return; }
    setLoading(true); setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { localStorage.setItem('redirectAfterLogin', '/checkout'); router.push('/login'); return; }

      const { data: commissionSetting } = await supabase
        .from('commission_settings').select('default_rate').single();
      const defaultCommission = commissionSetting?.default_rate || 10;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id, total_amount: total,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          status: 'pending', payment_status: 'unpaid',
        })
        .select().single();
      if (orderError) { setError(orderError.message); return; }

      // Include variant_name in order items
      const orderItems = items.map(item => {
        const finalPrice = getFinalPrice(
          item.product.price, item.product.discount_percent, item.product.discount_ends_at,
          item.variant_price_adjustment
        );
        return {
          order_id: order.id,
          product_id: item.product_id,
          shop_id: item.product.shop_id,
          quantity: item.quantity,
          price_at_purchase: finalPrice,
          seller_share: finalPrice * (1 - defaultCommission / 100),
          commission_charged: finalPrice * (defaultCommission / 100),
          variant_name: item.variant_name || null,
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) { setError(itemsError.message); return; }

      // Deduct stock
      try {
        const functionUrl = 'https://wridxxzzulcfneofcazz.supabase.co/functions/v1/deduct-stock';
        await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ orderItems: orderItems.map(oi => ({ product_id: oi.product_id, quantity: oi.quantity, variant_name: oi.variant_name })) }),
        });
      } catch (err) { console.error('Stock deduction failed:', err); }

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
            setQrImageUrl(URL.createObjectURL(blob));
            setShowQrModal(true);
            await clearCart();
          } else {
            setError(locale === 'en' ? 'Could not generate QR code, please try again' : 'ບໍ່ສາມາດສ້າງ QR code, ກະລຸນາລອງໃໝ່');
            await clearCart();
            router.push(`/order/${order.id}`);
          }
        } catch {
          setError(locale === 'en' ? 'Error generating QR code' : 'ເກີດຂໍ້ຜິດພາດໃນການສ້າງ QR');
          await clearCart();
          router.push(`/order/${order.id}`);
        }
      } else {
        setOrderPlaced(true);
        await clearCart();
        router.push(`/order/${order.id}`);
      }
    } catch (err: any) {
      setError((locale === 'en' ? 'An error occurred: ' : 'ເກີດຂໍ້ຜິດພາດ: ') + (err.message || (locale === 'en' ? 'please try again' : 'ກະລຸນາລອງໃໝ່')));
    } finally {
      setLoading(false);
    }
  };

  const submitTicket = async () => {
    if (!ticketNumber.trim()) { alert(locale === 'en' ? 'Please enter reference number' : 'ກະລຸນາໃສ່ເລກອ້າງອິງ'); return; }
    if (!currentOrderId) return;
    setSubmittingTicket(true);
    try {
      const { data: pv } = await supabase
        .from('payment_verifications').select('id').eq('order_id', currentOrderId).single();
      if (!pv) { alert(locale === 'en' ? 'Payment details not found' : 'ບໍ່ພົບຂໍ້ມູນການຊຳລະ'); return; }
      const { error } = await supabase.from('payment_verifications')
        .update({ ticket_number: ticketNumber, status: 'ticket_submitted', submitted_at: new Date().toISOString() })
        .eq('id', pv.id);
      if (error) alert(error.message);
      else {
        alert(locale === 'en' ? 'Thank you for your payment. Admin will verify it.' : 'ຂອບໃຈສຳລັບການຊຳລະ. ຜູ້ດູແລຈະກວດສອບ.');
        setShowQrModal(false); setTicketNumber('');
        router.push(`/order/${currentOrderId}`);
      }
    } finally { setSubmittingTicket(false); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl bg-white shadow rounded-lg mt-6">
      {cartLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center p-8">{t('loading')}</div>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">{t('checkout_page_title')}</h1>

      {/* Order summary */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h2 className="font-bold mb-2">{t('ordered_items')}</h2>
        {items.map(item => {
          const finalPrice = getFinalPrice(item.product.price, item.product.discount_percent, item.product.discount_ends_at, item.variant_price_adjustment);
          const hasDiscount = finalPrice < item.product.price;
          return (
            <div key={item.id} className="flex justify-between text-sm mb-2 border-b pb-2">
              <span>
                {item.product.name_la}
                {item.variant_name && (
                  <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">
                    {item.variant_name}
                  </span>
                )}
                {' '}x{item.quantity}
              </span>
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
          <span>{t('total_amount')}</span>
          <span className="text-green-600">{total.toLocaleString()} ກີບ</span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handlePlaceOrder(); }} className="space-y-4">
        <div>
          <label className="block font-medium">{t('shipping_address')}</label>
          <textarea required value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            className="w-full border rounded px-3 py-2" rows={3}
            placeholder={t('placeholder_address')} />
        </div>
        <div>
          <label className="block font-medium">{t('payment_method')}</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border rounded px-3 py-2">
            <option value="cod">{t('cod')}</option>
            <option value="bank_transfer">{t('bank_transfer')}</option>
            <option value="lao_qr">{t('qr_code')}</option>
          </select>
        </div>
        {error && <div className="text-red-500">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 cursor-pointer">
          {loading ? (locale === 'en' ? 'Processing...' : 'ກຳລັງດຳເນີນການ...') : t('confirm_purchase')}
        </button>
      </form>

      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{t('bank_details_title')}</h2>
            <div className="flex justify-center mb-4">
              {qrImageUrl && <img src={qrImageUrl} alt="QR Payment" className="w-64 h-64" />}
            </div>
            <p className="text-center text-sm mb-4">
              {t('bank_details_desc')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t('ref_number_label')}</label>
              <input type="text" value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full border rounded px-3 py-2" placeholder={t('ref_number_placeholder')} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push(`/order/${currentOrderId}`)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400 cursor-pointer">{t('skip_btn')}</button>
              <button onClick={submitTicket} disabled={submittingTicket}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer">
                {submittingTicket ? t('submitting_ref') : t('confirm_ref_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}