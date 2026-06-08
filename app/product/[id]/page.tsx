'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface Variant {
  name: string;
  stock: number;
  price_adjustment: number;
}

const getFinalPrice = (price: number, discountPercent: number, discountEndsAt: string | null): number => {
  if (!discountPercent || discountPercent <= 0) return price;
  if (!discountEndsAt || new Date(discountEndsAt) <= new Date()) return price;
  return Math.round(price - (price * discountPercent / 100));
};

const isDiscountActive = (discountPercent: number, discountEndsAt: string | null): boolean => {
  if (!discountPercent || discountPercent <= 0) return false;
  if (!discountEndsAt) return false;
  return new Date(discountEndsAt) > new Date();
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const { addToCart } = useCart();
  const { locale, t } = useLanguage();

  // Review states
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [userCanReview, setUserCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`*, shops (name_la, slug, is_active), categories (name_la)`)
        .eq('id', id)
        .single();
      if (!error) setProduct(data);
      setLoading(false);
    };
    if (id) fetchProduct();
  }, [id]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`*, profiles (full_name)`)
        .eq('product_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setReviews(data);
        setAvgRating(data.reduce((sum, r) => sum + r.rating, 0) / (data.length || 1) || 0);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: orderItem } = await supabase
        .from('order_items')
        .select(`order_id, orders!inner (status, user_id)`)
        .eq('product_id', id)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'delivered')
        .limit(1).maybeSingle();
      setUserCanReview(!!orderItem);
      if (orderItem) {
        const { data: existingReview } = await supabase
          .from('product_reviews').select('id')
          .eq('product_id', id).eq('user_id', user.id).maybeSingle();
        setHasReviewed(!!existingReview);
      }
    };
    fetchReviews();
  }, [id]);

  useEffect(() => {
    if (searchParams?.get('review') === 'true' && userCanReview && !hasReviewed) {
      setShowReviewForm(true);
    }
  }, [searchParams, userCanReview, hasReviewed]);

  const handleAddToCart = async () => {
    setAddingToCart(true);

    // Check variants — must select one if product has variants
    const variants: Variant[] = product?.variants || [];
    if (variants.length > 0 && !selectedVariant) {
      alert('ກະລຸນາເລືອກຕົວເລືອກ (Size / ສີ) ກ່ອນ');
      setAddingToCart(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAddingToCart(false);
      localStorage.setItem('redirectAfterLogin', `/product/${product.id}`);
      router.push('/login');
      return;
    }

    await addToCart(product.id, quantity, selectedVariant?.name || null, selectedVariant?.price_adjustment || 0);
    setAddingToCart(false);

    const goToCheckout = confirm(
      `ເພີ່ມ ${product.name_la}${selectedVariant ? ` (${selectedVariant.name})` : ''} ຈຳນວນ ${quantity} ໃສ່ກະຕ່າແລ້ວ.\nທ່ານຕ້ອງການໄປທີ່ໜ້າຊຳລະເງິນ ຫຼື ບໍ?`
    );
    if (goToCheckout) router.push('/checkout');
  };

  const submitReview = async () => {
    if (!userCanReview || hasReviewed) { alert('ທ່ານບໍ່ສາມາດຂຽນຄຳຕິຊົມໄດ້'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('ກະລຸນາເຂົ້າສູ່ລະບົບ'); return; }
    const { data: orderItem } = await supabase
      .from('order_items').select(`order_id, orders!inner (status, user_id)`)
      .eq('product_id', id).eq('orders.user_id', user.id).eq('orders.status', 'delivered')
      .limit(1).maybeSingle();
    if (!orderItem) { alert('ບໍ່ພົບຄຳສັ່ງທີ່ສາມາດຂຽນຄຳຕິຊົມໄດ້'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('product_reviews').insert({
      product_id: id, user_id: user.id, order_id: orderItem.order_id,
      rating: newRating, comment: newComment.trim() || null, status: 'approved',
    });
    if (error) { alert(error.message); }
    else {
      alert('ຂອບໃຈສຳລັບຄຳຕິຊົມ');
      setShowReviewForm(false); setNewRating(5); setNewComment(''); setHasReviewed(true);
      const { data: newReviews } = await supabase
        .from('product_reviews').select(`*, profiles (full_name)`)
        .eq('product_id', id).eq('status', 'approved').order('created_at', { ascending: false });
      if (newReviews) {
        setReviews(newReviews);
        setAvgRating(newReviews.reduce((sum, r) => sum + r.rating, 0) / (newReviews.length || 1) || 0);
      }
    }
    setSubmitting(false);
  };

  const submitProductReport = async () => {
    if (!currentUser) { alert('ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນລາຍງານ'); return; }
    if (!reportReason.trim()) { alert('ກະລຸນາປ້ອນເຫດຜົນ'); return; }
    setSubmittingReport(true);
    const { error } = await supabase.from('product_reports').insert({
      product_id: id, reporter_user_id: currentUser.id,
      reason: reportReason, description: reportDescription.trim() || null, status: 'pending',
    });
    setSubmittingReport(false);
    if (error) alert(error.message);
    else {
      alert('ຂອບໃຈສຳລັບການລາຍງານ');
      setShowReportModal(false); setReportReason(''); setReportDescription('');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>{t('loading')}</p></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center"><p>{t('no_products_found')}</p></div>;

  const images: string[] = product.images || [];
  const variants: Variant[] = product.variants || [];
  const hasVariants = variants.length > 0;
  const hasDiscount = isDiscountActive(product.discount_percent, product.discount_ends_at);

  // Price calculation
  const basePrice = hasDiscount
    ? getFinalPrice(product.price, product.discount_percent, product.discount_ends_at)
    : product.price;
  const finalPrice = selectedVariant
    ? basePrice + (selectedVariant.price_adjustment || 0)
    : basePrice;

  // Stock: use selected variant stock or product stock
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Product Images */}
        <div className="max-w-md w-full mx-auto">
          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 shadow mb-3">
            {images[selectedImage] ? (
              <Image src={images[selectedImage]} alt={product.name_la} fill
                sizes="(max-width: 768px) 100vw, 448px" className="object-contain" priority />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                {t('no_image') === 'no_image' ? 'ບໍ່ມີຮູບ' : t('no_image')}
              </div>
            )}
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-red-600 text-white text-sm font-bold px-2 py-1 rounded-full">
                -{product.discount_percent}%
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button key={idx} onClick={() => setSelectedImage(idx)}
                  className={`relative w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 transition ${selectedImage === idx ? 'border-blue-600' : 'border-transparent'}`}>
                  <Image src={img} alt={`${product.name_la} ${idx + 1}`} fill sizes="64px" className="object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name_la}</h1>
          <p className="text-gray-600 mb-4">{product.description_la}</p>

          {/* Price */}
          <div className="mb-4">
            {hasDiscount ? (
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-bold text-red-600">{finalPrice.toLocaleString()} ກີບ</span>
                  <span className="bg-red-600 text-white text-sm font-bold px-2 py-0.5 rounded-full">-{product.discount_percent}%</span>
                </div>
                <div className="text-gray-400 line-through text-lg mt-1">{product.price.toLocaleString()} ກີບ</div>
                <div className="text-green-600 text-sm mt-1">
                  {locale === 'en' ? `Save ${(product.price - basePrice).toLocaleString()} Kip` : `ປະຫຍັດ ${(product.price - basePrice).toLocaleString()} ກີບ`}
                </div>
                {product.discount_ends_at && (
                  <div className="text-orange-500 text-sm mt-1">
                    ⏰ {locale === 'en' ? 'Ends:' : 'ໝົດອາຍຸ:'} {new Date(product.discount_ends_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'lo-LA')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {finalPrice.toLocaleString()} ກີບ
                {selectedVariant && selectedVariant.price_adjustment !== 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({selectedVariant.price_adjustment > 0 ? '+' : ''}{selectedVariant.price_adjustment.toLocaleString()} ກີບ)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Variant selector */}
          {hasVariants && (
            <div className="mb-4">
              <label className="block font-semibold mb-2">{t('select_option')}:</label>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant, idx) => {
                  const isSelected = selectedVariant?.name === variant.name;
                  const isOutOfStock = variant.stock === 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !isOutOfStock && setSelectedVariant(isSelected ? null : variant)}
                      disabled={isOutOfStock}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition ${
                        isOutOfStock
                          ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through bg-gray-50'
                          : isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 text-gray-700 hover:border-blue-400'
                      }`}
                    >
                      {variant.name}
                      {isOutOfStock && <span className="ml-1 text-xs">{locale === 'en' ? '(Out)' : '(ໝົດ)'}</span>}
                    </button>
                  );
                })}
              </div>
              {selectedVariant && (
                <p className="text-sm text-gray-600 mt-2">
                  {t('products_left')}: <strong>{selectedVariant.stock}</strong> {locale === 'en' ? 'pcs' : 'ຊິ້ນ'}
                </p>
              )}
            </div>
          )}

          {/* Stock display (no variants) */}
          {!hasVariants && (
            <div className="mb-4">
              <span className="font-semibold">{t('products_left')}:</span>{' '}
              {product.stock > 0 ? `${product.stock} ${locale === 'en' ? 'pcs' : 'ຊິ້ນ'}` : t('out_of_stock')}
            </div>
          )}

          <div className="mb-4">
            <span className="font-semibold">{t('shop')}:</span>{' '}
            <Link href={`/shop/${product.shops?.slug}`} className="text-blue-600 hover:underline">
              {product.shops?.name_la || (locale === 'en' ? 'General Shop' : 'ຮ້ານທົ່ວໄປ')}
            </Link>
          </div>

          {availableStock > 0 && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <label className="font-semibold">{t('quantity')}:</label>
                <input type="number" min="1" max={availableStock} value={quantity}
                  onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, availableStock))}
                  className="w-20 border rounded px-2 py-1" />
              </div>
              <button onClick={handleAddToCart} disabled={addingToCart || (hasVariants && !selectedVariant)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-lg transition cursor-pointer">
                {addingToCart ? (locale === 'en' ? 'Adding...' : 'ກຳລັງເພີ່ມ...') :
                  hasVariants && !selectedVariant ? (locale === 'en' ? 'Select Option First' : 'ກະລຸນາເລືອກຕົວເລືອກ') : t('add_to_cart')}
              </button>
            </>
          )}

          {availableStock === 0 && (
            <button disabled className="w-full bg-gray-400 text-white py-3 rounded-lg font-semibold text-lg">
              {hasVariants && !selectedVariant ? (locale === 'en' ? 'Select Option First' : 'ກະລຸນາເລືອກຕົວເລືອກ') : t('out_of_stock')}
            </button>
          )}

          {currentUser && (
            <button onClick={() => setShowReportModal(true)} className="mt-4 text-red-600 text-sm hover:underline cursor-pointer">
              {t('report_product_title')}
            </button>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">{t('buyer_feedback')}</h2>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
          <div className="text-yellow-500 text-xl">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</div>
          <div className="text-gray-500">({reviews.length} {locale === 'en' ? 'reviews' : 'ຄຳຕິຊົມ'})</div>
        </div>
        {userCanReview && !hasReviewed && !showReviewForm && (
          <button onClick={() => setShowReviewForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded mb-6 cursor-pointer">{t('write_feedback')}</button>
        )}
        {showReviewForm && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">{t('buyer_feedback_title')}</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium">{t('rating_label')}</label>
              <select value={String(newRating)} onChange={(e) => setNewRating(Number(e.target.value))} className="border rounded px-3 py-1">
                {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r} {locale === 'en' ? 'Stars' : 'ດາວ'}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">{t('comment_label')}</label>
              <textarea rows={3} value={newComment} onChange={(e) => setNewComment(e.target.value)}
                className="w-full border rounded px-3 py-2" placeholder={t('comment_placeholder')} />
            </div>
            <button onClick={submitReview} disabled={submitting} className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400 cursor-pointer">
              {submitting ? t('submitting_btn') : t('submit_feedback_btn')}
            </button>
            <button onClick={() => setShowReviewForm(false)} className="ml-2 text-gray-500 hover:underline cursor-pointer">{t('cancel_btn')}</button>
          </div>
        )}
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{review.profiles?.full_name || (locale === 'en' ? 'User' : 'ຜູ້ໃຊ້')}</div>
                  <div className="text-yellow-500 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                </div>
                <div className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'lo-LA')}</div>
              </div>
              <p className="mt-2 text-gray-700">{review.comment}</p>
            </div>
          ))}
          {reviews.length === 0 && <div className="text-center text-gray-500 py-4">{locale === 'en' ? 'No reviews yet' : 'ຍັງບໍ່ມີຄຳຕິຊົມ'}</div>}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{t('report_modal_title')} {product.name_la}</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t('reason_label')}</label>
              <textarea rows={3} value={reportReason} onChange={(e) => setReportReason(e.target.value)}
                className="w-full border rounded px-3 py-2" placeholder={t('reason_placeholder')} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t('details_label')}</label>
              <textarea rows={2} value={reportDescription} onChange={(e) => setReportDescription(e.target.value)}
                className="w-full border rounded px-3 py-2" placeholder={t('details_placeholder')} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 cursor-pointer">{t('cancel_btn')}</button>
              <button onClick={submitProductReport} disabled={submittingReport}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 cursor-pointer">
                {submittingReport ? t('submitting_btn') : t('submit_report_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}