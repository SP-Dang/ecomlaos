'use client';

import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ShopPage() {
  const { slug } = useParams();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    async function fetchShopAndProducts() {
      if (!slug) return;

      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .single();

      if (shopError || !shopData) {
        console.error(shopError);
        setLoading(false);
        return;
      }

      setShop(shopData);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`*, shops ( name_la, slug )`)
        .eq('shop_id', shopData.id)
        .order('created_at', { ascending: false });

      if (!productsError) {
        setProducts(productsData || []);
      } else {
        console.error(productsError);
      }
      setLoading(false);
    }

    fetchShopAndProducts();
  }, [slug]);

  const reportShop = async () => {
    if (!user) {
      alert('ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນລາຍງານ');
      return;
    }
    if (!reportReason.trim()) {
      alert('ກະລຸນາປ້ອນເຫດຜົນການລາຍງານ');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('shop_reports').insert({
      shop_id: shop.id,
      reporter_user_id: user.id,
      reason: reportReason,
      description: reportDescription.trim() || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      alert(error.message);
    } else {
      alert('ຂອບໃຈສຳລັບການລາຍງານ, ພວກເຮົາຈະກວດສອບ');
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
    }
  };

  if (loading) return <div className="text-center p-8">ກຳລັງໂຫຼດ...</div>;
  if (!shop) return <div className="text-center p-8">ບໍ່ພົບຮ້ານຄ້າ</div>;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Shop header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 text-center">
          {shop.logo_url && (
            <img src={shop.logo_url} alt={shop.name_la} className="w-24 h-24 object-cover rounded-full mx-auto mb-4" />
          )}
          <h1 className="text-3xl font-bold text-gray-800">{shop.name_la}</h1>
          <p className="text-gray-600 mt-2">{shop.description_la}</p>
          <div className="mt-2 text-sm text-gray-500">
            ສະຖານະ: {shop.is_active ? 'ເປີດການໃຊ້ງານ' : 'ປິດການໃຊ້ງານ'}
          </div>
          {/* Report button – only for logged‑in users */}
          {user && (
            <button
              onClick={() => setShowReportModal(true)}
              className="mt-3 text-red-600 text-sm hover:underline"
            >
              ລາຍງານຮ້ານນີ້
            </button>
          )}
        </div>

        {/* Products grid */}
        <h2 className="text-2xl font-bold mb-6">ສິນຄ້າທັງໝົດໃນຮ້ານ</h2>
        {products.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">ຮ້ານນີ້ຍັງບໍ່ມີສິນຄ້າ</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition flex justify-between gap-3 p-3">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">{product.name_la}</h2>
                  <p className="text-gray-600 mb-2 line-clamp-2">{product.description_la}</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-green-600">
                      {product.price.toLocaleString()} ກີບ
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <Link
                      href={`/product/${product.id}`}
                      className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition"
                    >
                      ເບິ່ງ
                    </Link>
                    <Link
                      href={`/shop/${shop.slug}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {shop.name_la}
                    </Link>
                  </div>
                </div>
                <div className="w-24 h-24 flex-shrink-0">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name_la}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                      ບໍ່ມີຮູບ
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">ລາຍງານຮ້ານ {shop.name_la}</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ເຫດຜົນ *</label>
              <textarea
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຕົວຢ່າງ: ສິນຄ້າປອມ, ບໍລິການບໍ່ດີ, ຂາຍສິນຄ້າຜິດກົດໝາຍ"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ລາຍລະອຽດ (ຖ້າມີ)</label>
              <textarea
                rows={2}
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຂໍ້ມູນເພີ່ມເຕີມ..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={reportShop}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {submitting ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລາຍງານ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}