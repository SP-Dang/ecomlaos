'use client';

import { useCart } from '@/hooks/useCart';
import Link from 'next/link';

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

export default function CartPage() {
  const { items, loading, updateQuantity, removeItem } = useCart();

  const total = items.reduce((sum, i) => {
    const finalPrice = getFinalPrice(i.product.price, i.product.discount_percent, i.product.discount_ends_at, i.variant_price_adjustment);
    return sum + finalPrice * i.quantity;
  }, 0);

  if (loading) return <div className="text-center p-8">ກຳລັງໂຫຼດກະຕ່າ...</div>;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">ກະຕ່າຂອງທ່ານຫວ່າງເປົ່າ</h1>
        <Link href="/" className="text-blue-600 hover:underline">ກັບໄປຊື້ສິນຄ້າ</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ກະຕ່າສິນຄ້າ</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const finalPrice = getFinalPrice(
              item.product.price,
              item.product.discount_percent,
              item.product.discount_ends_at,
              item.variant_price_adjustment
            );
            const hasDiscount = finalPrice < item.product.price;
            return (
              <div key={item.id} className="flex gap-4 border rounded p-4">
                {item.product.images?.[0] && (
                  <img src={item.product.images[0]} alt={item.product.name_la}
                    className="w-24 h-24 object-cover rounded flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">{item.product.name_la}</h2>
                  {/* Show variant name if exists */}
                  {item.variant_name && (
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded mt-1 mb-1">
                      {item.variant_name}
                    </span>
                  )}
                  {/* Price display */}
                  <div className="flex items-center gap-2">
                    <p className={`${hasDiscount ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                      {finalPrice.toLocaleString()} ກີບ
                    </p>
                    {hasDiscount && (
                      <p className="text-gray-400 line-through text-sm">
                        {item.product.price.toLocaleString()} ກີບ
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <label>ຈຳນວນ:</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      className="w-20 border rounded px-2 py-1"
                    />
                    <button onClick={() => removeItem(item.id)} className="text-red-600 hover:underline">ລຶບ</button>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold">{(finalPrice * item.quantity).toLocaleString()} ກີບ</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-gray-50 p-4 rounded h-fit">
          <h2 className="text-xl font-bold mb-4">ສະຫຼຸບຍອດຊຳລະ</h2>
          <div className="flex justify-between mb-2">
            <span>ລາຄາສິນຄ້າ:</span>
            <span>{total.toLocaleString()} ກີບ</span>
          </div>
          <div className="flex justify-between mb-4 font-bold text-lg">
            <span>ຍອດລວມ:</span>
            <span>{total.toLocaleString()} ກີບ</span>
          </div>
          <Link href="/checkout"
            className="block w-full bg-blue-600 text-white text-center py-2 rounded hover:bg-blue-700">
            ດຳເນີນການຊຳລະ
          </Link>
        </div>
      </div>
    </div>
  );
}