'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import Link from 'next/link';

export default function ProductDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const { addToCart } = useCart();

  // Review states
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [userCanReview, setUserCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Report product state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          shops (name_la, slug, is_active),
          categories (name_la)
        `)
        .eq('id', id)
        .single();
      if (!error) setProduct(data);
      setLoading(false);
    };
    if (id) fetchProduct();
  }, [id]);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Fetch reviews and check user eligibility (unchanged)
  useEffect(() => {
    const fetchReviewsAndEligibility = async () => {
      if (!id) return;

      // Fetch approved reviews
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          profiles (full_name)
        `)
        .eq('product_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setReviews(data);
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / (data.length || 1);
        setAvgRating(avg || 0);
      }

      // Check if current user can review
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          orders!inner (status, user_id)
        `)
        .eq('product_id', id)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'delivered')
        .limit(1)
        .maybeSingle();

      if (!itemError && orderItem) {
        setUserCanReview(true);
      } else {
        setUserCanReview(false);
        return;
      }

      const { data: existingReview } = await supabase
        .from('product_reviews')
        .select('id')
        .eq('product_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      setHasReviewed(!!existingReview);
    };
    fetchReviewsAndEligibility();
  }, [id]);

  // Auto-open review form if ?review=true in URL
  useEffect(() => {
    if (searchParams?.get('review') === 'true' && userCanReview && !hasReviewed) {
      setShowReviewForm(true);
    }
  }, [searchParams, userCanReview, hasReviewed]);

  const handleAddToCart = async () => {
  console.log('Product page handleAddToCart triggered'); // <-- ADD THIS LINE
  setAddingToCart(true);
  await addToCart(product.id, quantity);
  setAddingToCart(false);
  const goToCheckout = confirm(
    `ເພີ່ມ ${product.name_la} ຈຳນວນ ${quantity} ໃສ່ກະຕ່າແລ້ວ.\nທ່ານຕ້ອງການໄປທີ່ໜ້າຊຳລະເງິນ ຫຼື ບໍ?`
  );
  if (goToCheckout) router.push('/checkout');
};

  const submitReview = async () => {
    if (!userCanReview || hasReviewed) {
      alert('ທ່ານບໍ່ສາມາດຂຽນຄຳຕິຊົມສຳລັບສິນຄ້ານີ້');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('ກະລຸນາເຂົ້າສູ່ລະບົບ');
      return;
    }
    const { data: orderItem, error: findError } = await supabase
      .from('order_items')
      .select(`
        order_id,
        orders!inner (status, user_id)
      `)
      .eq('product_id', id)
      .eq('orders.user_id', user.id)
      .eq('orders.status', 'delivered')
      .limit(1)
      .maybeSingle();

    if (findError || !orderItem) {
      console.error('Order item fetch error:', findError);
      alert('ບໍ່ພົບຄຳສັ່ງທີ່ສາມາດຂຽນຄຳຕິຊົມໄດ້ (ກະລຸນາໃຫ້ແນ່ໃຈວ່າຄຳສັ່ງຖືກຈັດສົ່ງແລ້ວ)');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('product_reviews').insert({
      product_id: id,
      user_id: user.id,
      order_id: orderItem.order_id,
      rating: newRating,
      comment: newComment.trim() || null,
      status: 'approved',
    });
    if (error) alert(error.message);
    else {
      alert('ຂອບໃຈສຳລັບຄຳຕິຊົມ');
      setShowReviewForm(false);
      setNewRating(5);
      setNewComment('');
      const { data: newReviews } = await supabase
        .from('product_reviews')
        .select(`*, profiles (full_name)`)
        .eq('product_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (newReviews) {
        setReviews(newReviews);
        const avg = newReviews.reduce((sum, r) => sum + r.rating, 0) / (newReviews.length || 1);
        setAvgRating(avg || 0);
      }
      setHasReviewed(true);
    }
    setSubmitting(false);
  };

  const reportReview = async (reviewId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອລາຍງານ');
      return;
    }
    const reason = prompt('ເຫດຜົນທີ່ລາຍງານ (ຂາຍສິນຄ້າບໍ່ຖືກຕ້ອງ, ສິນຄ້າບໍ່ກົງ, ພາສາບໍ່ສຸພາບ)');
    if (!reason) return;
    const { error } = await supabase.from('review_reports').insert({
      review_id: reviewId,
      reporter_user_id: user.id,
      reason,
    });
    if (error) alert(error.message);
    else alert('ຂອບໃຈສຳລັບການລາຍງານ, ພວກເຮົາຈະກວດສອບ');
  };

  // Report product handler
  const submitProductReport = async () => {
    if (!currentUser) {
      alert('ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນລາຍງານ');
      return;
    }
    if (!reportReason.trim()) {
      alert('ກະລຸນາປ້ອນເຫດຜົນການລາຍງານ');
      return;
    }
    setSubmittingReport(true);
    const { error } = await supabase.from('product_reports').insert({
      product_id: id,
      reporter_user_id: currentUser.id,
      reason: reportReason,
      description: reportDescription.trim() || null,
      status: 'pending',
    });
    setSubmittingReport(false);
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
  if (!product) return <div className="text-center p-8">ບໍ່ພົບສິນຄ້າ</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div>
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name_la} className="w-full rounded-lg shadow" />
          ) : (
            <div className="bg-gray-200 w-full h-64 rounded-lg flex items-center justify-center">
              ບໍ່ມີຮູບ
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name_la}</h1>
          <p className="text-gray-600 mb-4">{product.description_la}</p>
          <div className="text-2xl font-bold text-green-600 mb-4">
            {product.price.toLocaleString()} ກີບ
          </div>
          <div className="mb-4">
            <span className="font-semibold">ຮ້ານ:</span>{' '}
            <Link href={`/shop/${product.shops?.slug}`} className="text-blue-600 hover:underline">
              {product.shops?.name_la || 'ຮ້ານທົ່ວໄປ'}
            </Link>
          </div>
          <div className="mb-4">
            <span className="font-semibold">ສິນຄ້າຄົງເຫຼືອ:</span>{' '}
            {product.stock > 0 ? `${product.stock} ຊິ້ນ` : 'ໝົດ'}
          </div>
          {product.stock > 0 && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <label className="font-semibold">ຈຳນວນ:</label>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-20 border rounded px-2 py-1"
                />
              </div>
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {addingToCart ? 'ກຳລັງເພີ່ມ...' : 'ເພີ່ມໃສ່ກະຕ່າ'}
              </button>
            </>
          )}
          {product.stock === 0 && (
            <button disabled className="w-full bg-gray-400 text-white py-2 rounded">
              ສິນຄ້າໝົດ
            </button>
          )}

          {/* Report Product button (only for logged‑in users) */}
          {currentUser && (
            <button
              onClick={() => setShowReportModal(true)}
              className="mt-4 text-red-600 text-sm hover:underline"
            >
              ລາຍງານສິນຄ້ານີ້
            </button>
          )}
        </div>
      </div>

      {/* Reviews Section (unchanged) */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">ຄຳຕິຊົມຈາກຜູ້ຊື້</h2>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
          <div className="text-yellow-500 text-xl">
            {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
          </div>
          <div className="text-gray-500">({reviews.length} ຄຳຕິຊົມ)</div>
        </div>

        {userCanReview && !hasReviewed && !showReviewForm && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded mb-6"
          >
            ຂຽນຄຳຕິຊົມ
          </button>
        )}

        {showReviewForm && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">ຂຽນຄຳຕິຊົມຂອງທ່ານ</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium">ຄະແນນ</label>
              <select
                value={String(newRating)}
                onChange={(e) => setNewRating(Number(e.target.value))}
                className="border rounded px-3 py-1"
              >
                {[1,2,3,4,5].map(r => (
                  <option key={r} value={r}>{r} ດາວ</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">ຄຳເຫັນ</label>
              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຂຽນປະສົບການຂອງທ່ານ..."
              />
            </div>
            <button
              onClick={submitReview}
              disabled={submitting}
              className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {submitting ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງຄຳຕິຊົມ'}
            </button>
            <button
              onClick={() => setShowReviewForm(false)}
              className="ml-2 text-gray-500 hover:underline"
            >
              ຍົກເລີກ
            </button>
          </div>
        )}

        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{review.profiles?.full_name || 'ຜູ້ໃຊ້'}</div>
                  <div className="text-yellow-500 text-sm">
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleDateString()}
                </div>
              </div>
              <p className="mt-2 text-gray-700">{review.comment}</p>
              <button
                onClick={() => reportReview(review.id)}
                className="text-xs text-red-500 mt-2 hover:underline"
              >
                ລາຍງານຄຳຕິຊົມ
              </button>
            </div>
          ))}
          {reviews.length === 0 && (
            <div className="text-center text-gray-500 py-4">ຍັງບໍ່ມີຄຳຕິຊົມ</div>
          )}
        </div>
      </div>

      {/* Report Product Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">ລາຍງານສິນຄ້າ {product.name_la}</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ເຫດຜົນ *</label>
              <textarea
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="ຕົວຢ່າງ: ສິນຄ້າປອມ, ຂາຍສິນຄ້າຜິດກົດໝາຍ, ລາຄາບໍ່ສົມເຫດສົມຜົນ"
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
                onClick={submitProductReport}
                disabled={submittingReport}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {submittingReport ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງລາຍງານ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}