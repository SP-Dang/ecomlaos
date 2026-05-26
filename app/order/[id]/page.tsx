'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';

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
      alert('ກະລຸນາປ້ອນເຫດຜົນການຂໍເງິນຄືນ');
      return;
    }
    if (!currentUser) {
      alert('ກະລຸນາເຂົ້າສູ່ລະບົບ');
      return;
    }
    // Get the seller's user ID from the shop's owner_id
    const sellerUserId = selectedOrderItem.shops?.owner_id;
    if (!sellerUserId) {
      alert('ບໍ່ພົບຂໍ້ມູນຜູ້ຂາຍ');
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
      alert('ສົ່ງຄຳຮ້ອງຂໍສຳເລັດ, ຜູ້ດູແລລະບົບຈະພິຈາລະນາ');
      setShowReturnModal(false);
      setReturnReason('');
      setReturnDescription('');
    }
  };

  if (loading) {
    return <div className="text-center p-8">ກຳລັງໂຫຼດ...</div>;
  }

  if (!order) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">ບໍ່ພົບຄຳສັ່ງ</h1>
        <Link href="/" className="text-blue-600 hover:underline">ກັບໄປໜ້າຫຼັກ</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-green-700">ສັ່ງຊື້ສຳເລັດ!</h1>
          <button onClick={refreshOrder} className="text-blue-600 underline text-sm">
            ໂຫຼດຂໍ້ມູນລ່າສຸດ
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-gray-600 mb-2">ຂອບໃຈສຳລັບການສັ່ງຊື້.</p>
            <p className="text-sm text-gray-500 break-all">
              ລະຫັດຄຳສັ່ງ: <strong>{order.id}</strong>
            </p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center">
            <QRCodeCanvas value={orderUrl} size={110} level="H" includeMargin={true} />
            <p className="text-xs text-gray-400 mt-1">ສະແກນ QR ນີ້</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">ລາຍລະອຽດຄຳສັ່ງ</h2>
        <div className="space-y-2">
          <p><strong>ຍອດລວມ:</strong> {order.total_amount.toLocaleString()} ກີບ</p>
          <p><strong>ທີ່ຢູ່ຈັດສົ່ງ:</strong> {order.shipping_address}</p>
          <p><strong>ວິທີຊຳລະ:</strong> {order.payment_method === 'cod' ? 'ຊຳລະເມື່ອໄດ້ຮັບສິນຄ້າ (COD)' : 'ໂອນເງິນຜ່ານທະນາຄານ'}</p>
          <p><strong>ສະຖານະການຊຳລະ:</strong> {order.payment_status === 'paid' ? 'ຊຳລະແລ້ວ' : 'ຍັງບໍ່ທັນຊຳລະ'}</p>
          <p><strong>ສະຖານະຄຳສັ່ງຊື້:</strong> {order.status === 'pending' ? 'ລໍຖ້າການຢືນຢັນ' : order.status}</p>
        </div>

        {orderItems.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">ສິນຄ້າທີ່ສັ່ງ</h3>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.products?.name_la}</p>
                    <p className="text-sm text-gray-500">ຈຳນວນ: {item.quantity} x {item.price_at_purchase.toLocaleString()} ກີບ</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{(item.price_at_purchase * item.quantity).toLocaleString()} ກີບ</p>
                    {canRequestReturn(item) && (
                      <button
                        onClick={() => openReturnModal(item)}
                        className="text-yellow-600 text-xs hover:underline mt-1"
                      >
                        ຂໍເງິນຄືນ
                      </button>
                    )}
                    {item.is_refunded && (
                      <p className="text-xs text-green-600 mt-1">ຄືນເງິນແລ້ວ</p>
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
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          ກັບໄປໜ້າຫຼັກ
        </Link>
      </div>

      {/* Return Request Modal */}
      {showReturnModal && selectedOrderItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">ຂໍເງິນຄືນສຳລັບ {selectedOrderItem.products?.name_la}</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ເຫດຜົນ *</label>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຕົວຢ່າງ: ສິນຄ້າຊຳລຸດ, ບໍ່ຖືກຕາມຄຳສັ່ງ, ໄດ້ຮັບສິນຄ້າຜິດ"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ລາຍລະອຽດ (ຖ້າມີ)</label>
              <textarea
                rows={2}
                value={returnDescription}
                onChange={(e) => setReturnDescription(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຂໍ້ມູນເພີ່ມເຕີມ (ຮູບພາບ, ເລກບັນຊີ, ແລະອື່ນໆ)..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={submitReturnRequest}
                disabled={submittingReturn}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {submittingReturn ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງຄຳຮ້ອງຂໍ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}