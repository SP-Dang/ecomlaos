'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { useLanguage } from '@/context/LanguageContext';

export default function OrderSuccessPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderUrl, setOrderUrl] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Return request modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] = useState<any>(null);
  const [returnReason, setReturnReason] = useState('');
  const { locale, t } = useLanguage();
  const [returnDescription, setReturnDescription] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const refreshOrder = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    setOrderUrl(`${window.location.origin}/order/${id}`);
    const fetchOrderAndItems = async () => {
      if (!id) return;
      setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      if (!orderError && orderData) {
        setOrder(orderData);
        // Fetch order items with product and shop owner details
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            *,
            products (id, name_la, price, shop_id),
            shops!inner (id, name_la, owner_id)
          `)
          .eq('order_id', id);
        if (!itemsError) {
          setOrderItems(items || []);
        } else {
          console.error(itemsError);
        }
      } else {
        console.error(orderError);
      }
      setLoading(false);
    };
    fetchOrderAndItems();
  }, [id, refreshKey]);

  const canRequestReturn = (item: any) => {
    return order?.status === 'delivered' && !item.is_refunded;
  };

  const openReturnModal = (item: any) => {
    setSelectedOrderItem(item);
    setShowReturnModal(true);
  };

  const submitReturnRequest = async () => {
    if (!selectedOrderItem) return;
    if (!returnReason.trim()) {
      alert(locale === 'en' ? 'Please enter a reason for refund' : 'ກະລຸນາປ້ອນເຫດຜົນການຂໍເງິນຄືນ');
      return;
    }
    if (!currentUser) {
      alert(locale === 'en' ? 'Please log in' : 'ກະລຸນາເຂົ້າສູ່ລະບົບ');
      return;
    }
    // Get the seller's user ID from the shop's owner_id
    const sellerUserId = selectedOrderItem.shops?.owner_id;
    if (!sellerUserId) {
      alert(locale === 'en' ? 'Seller details not found' : 'ບໍ່ພົບຂໍ້ມູນຜູ້ຂາຍ');
      return;
    }
    setSubmittingReturn(true);
    const { error } = await supabase.from('return_requests').insert({
      order_item_id: selectedOrderItem.id,
      buyer_id: currentUser.id,
      seller_id: sellerUserId,
      reason: returnReason,
      description: returnDescription.trim() || null,
      status: 'pending',
    });
    setSubmittingReturn(false);
    if (error) {
      alert(error.message);
    } else {
      alert(locale === 'en' ? 'Return request submitted successfully. Admin will review it.' : 'ສົ່ງຄຳຮ້ອງຂໍສຳເລັດ, ຜູ້ດູແລລະບົບຈະພິຈາລະນາ');
      setShowReturnModal(false);
      setReturnReason('');
      setReturnDescription('');
    }
  };

  if (loading) {
    return <div className="text-center p-8">{t('loading')}</div>;
  }

  if (!order) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">{locale === 'en' ? 'Order not found' : 'ບໍ່ພົບຄຳສັ່ງ'}</h1>
        <Link href="/" className="text-blue-600 hover:underline">{t('back_to_homepage')}</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-green-700">{t('order_success')}</h1>
          <button onClick={refreshOrder} className="text-blue-600 underline text-sm cursor-pointer">
            {t('refresh_latest')}
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-gray-600 mb-2">{locale === 'en' ? 'Thank you for your order.' : 'ຂອບໃຈສຳລັບການສັ່ງຊື້.'}</p>
            <p className="text-sm text-gray-500 break-all">
              {t('order_code')}: <strong>{order.id}</strong>
            </p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center bg-white p-2 rounded border">
            <QRCodeCanvas value={orderUrl} size={110} level="H" includeMargin={false} />
            <p className="text-xs text-gray-400 mt-1">{locale === 'en' ? 'Scan this QR' : 'ສະແກນ QR ນີ້'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">{t('order_details')}</h2>
        <div className="space-y-2 border-b pb-4">
          <p><strong>{t('total_amount')}:</strong> {order.total_amount.toLocaleString()} ກີບ</p>
          <p><strong>{t('shipping_address')}:</strong> {order.shipping_address}</p>
          <p><strong>{t('payment_method')}:</strong> {order.payment_method === 'cod' ? t('cod') : order.payment_method === 'lao_qr' ? t('qr_code') : t('bank_transfer')}</p>
          <p><strong>{t('payment_status')}:</strong> {t(order.payment_status)}</p>
          <p><strong>{t('order_status')}:</strong> {t(order.status)}</p>
        </div>

        {orderItems.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">{t('ordered_items')}</h3>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.products?.name_la}</p>
                    <p className="text-sm text-gray-500">{t('quantity')}: {item.quantity} x {item.price_at_purchase.toLocaleString()} ກີບ</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{(item.price_at_purchase * item.quantity).toLocaleString()} ກີບ</p>
                    {canRequestReturn(item) && (
                      <button
                        onClick={() => openReturnModal(item)}
                        className="text-yellow-600 text-xs hover:underline mt-1 cursor-pointer"
                      >
                        {locale === 'en' ? 'Request Refund' : 'ຂໍເງິນຄືນ'}
                      </button>
                    )}
                    {item.is_refunded && (
                      <p className="text-xs text-green-600 mt-1">{locale === 'en' ? 'Refunded' : 'ຄືນເງິນແລ້ວ'}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 cursor-pointer"
        >
          {t('back_to_homepage')}
        </Link>
      </div>

      {/* Return Request Modal */}
      {showReturnModal && selectedOrderItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{locale === 'en' ? 'Refund Request for' : 'ຂໍເງິນຄືນສຳລັບ'} {selectedOrderItem.products?.name_la}</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t('reason_label')}</label>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder={locale === 'en' ? 'e.g., Damaged item, incorrect item' : 'ຕົວຢ່າງ: ສິນຄ້າຊຳລຸດ, ບໍ່ຖືກຕາມຄຳສັ່ງ'}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t('details_label')}</label>
              <textarea
                rows={2}
                value={returnDescription}
                onChange={(e) => setReturnDescription(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder={locale === 'en' ? 'Additional details...' : 'ຂໍ້ມູນເພີ່ມເຕີມ...'}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 cursor-pointer"
              >
                {t('cancel_btn')}
              </button>
              <button
                onClick={submitReturnRequest}
                disabled={submittingReturn}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer"
              >
                {submittingReturn ? t('submitting_ref') : (locale === 'en' ? 'Submit Request' : 'ສົ່ງຄຳຮ້ອງຂໍ')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}