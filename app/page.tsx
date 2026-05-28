'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [discountedProducts, setDiscountedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const itemsPerPage = 12;

  const searchRef = useRef(searchTerm);
  const categoryRef = useRef(selectedCategory);
  searchRef.current = searchTerm;
  categoryRef.current = selectedCategory;

  const fetchDiscountedProducts = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('products')
        .select('id, name_la, price, images, discount_percent, discount_ends_at, shops ( name_la, slug )')
        .gt('discount_percent', 0)
        .gt('discount_ends_at', now)
        .order('discount_percent', { ascending: false })
        .limit(10);
      setDiscountedProducts(data || []);
    } catch (err) {
      console.error('fetchDiscountedProducts error:', err);
      setDiscountedProducts([]);
    }
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('categories')
          .select('id, name_la')
          .order('name_la');
        setCategories(data || []);
      } catch (err) {
        console.error('fetchCategories error:', err);
      }
    };
    fetchCategories();
    fetchDiscountedProducts();
  }, [fetchDiscountedProducts]);

  const fetchProducts = useCallback(async (reset = true, pageOverride?: number) => {
    const currentPage = pageOverride ?? 1;
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
      let query = supabase
        .from('products')
        .select(
          'id, name_la, description_la, price, images, discount_percent, discount_ends_at, shops ( name_la, slug )',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      if (searchRef.current.trim()) {
        query = query.ilike('name_la', `%${searchRef.current.trim()}%`);
      }
      if (categoryRef.current !== 'all') {
        query = query.eq('category_id', categoryRef.current);
      }

      const { data, error, count } = await query.range(from, to);

      if (!error && data) {
        if (reset) setProducts(data);
        else setProducts(prev => [...prev, ...data]);
        setHasMore((count || 0) > currentPage * itemsPerPage);
      } else {
        console.error('fetchProducts error:', error);
        if (reset) setProducts([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('fetchProducts exception:', err);
      if (reset) setProducts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(true, 1);
  }, [fetchProducts]);

  useEffect(() => {
    if (page > 1) {
      setLoadingMore(true);
      fetchProducts(false, page);
    }
  }, [page, fetchProducts]);

  const applyFilters = useCallback(() => {
    setLoading(true);
    setPage(1);
    setProducts([]);
    setHasMore(true);
    fetchProducts(true, 1);
  }, [fetchProducts]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategory('all');
    searchRef.current = '';
    categoryRef.current = 'all';
    setLoading(true);
    setPage(1);
    setProducts([]);
    setHasMore(true);
    fetchProducts(true, 1);
  }, [fetchProducts]);

  const getDiscountedPrice = (price: number, percent: number) =>
    Math.round(price - (price * percent / 100));

  const isDiscountActive = (endsAt: string | null) =>
    endsAt ? new Date(endsAt) > new Date() : false;

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">ກຳລັງໂຫຼດ...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          ສະບາຍດີ ຍິນດີຕ້ອນຮັບສູ່ຮ້ານຄ້າອອນລາຍ
        </h1>

        {discountedProducts.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔥</span>
              <h2 className="text-2xl font-bold text-red-600">ສິນຄ້າລົດລາຄາ</h2>
              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">SALE</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {discountedProducts.map((product) => {
                if (!isDiscountActive(product.discount_ends_at)) return null;
                const discountedPrice = getDiscountedPrice(product.price, product.discount_percent);
                const hoursLeft = Math.ceil((new Date(product.discount_ends_at).getTime() - Date.now()) / (1000 * 60 * 60));
                return (
                  <Link key={product.id} href={`/product/${product.id}`}
                    className="flex-shrink-0 w-44 bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden border border-red-100">
                    <div className="relative w-full h-44 bg-gray-100">
                      {product.images?.[0] ? (
                        <Image src={product.images[0]} alt={product.name_la} fill sizes="176px" className="object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">ບໍ່ມີຮູບ</div>
                      )}
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        -{product.discount_percent}%
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold line-clamp-2 mb-1">{product.name_la}</p>
                      <p className="text-red-600 font-bold text-sm">{discountedPrice.toLocaleString()} ກີບ</p>
                      <p className="text-gray-400 text-xs line-through">{product.price.toLocaleString()} ກີບ</p>
                      {hoursLeft <= 24 && (
                        <p className="text-orange-500 text-xs mt-1 font-medium">⏰ ເຫຼືອ {hoursLeft} ຊົ່ວໂມງ</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">ຄົ້ນຫາສິນຄ້າ</label>
            <input type="text" placeholder="ຊື່ສິນຄ້າ..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="w-full border rounded px-3 py-2" />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium mb-1">ປະເພດສິນຄ້າ</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="all">ທັງໝົດ</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name_la}</option>)}
            </select>
          </div>
          <button onClick={applyFilters} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">ຄົ້ນຫາ</button>
          <button onClick={clearFilters} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">ລ້າງ</button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🛍️</span>
          <h2 className="text-2xl font-bold text-gray-800">ສິນຄ້າທັງໝົດ</h2>
        </div>

        {products.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">ບໍ່ພົບສິນຄ້າ</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const active = isDiscountActive(product.discount_ends_at);
              const hasDiscount = product.discount_percent > 0 && active;
              const discountedPrice = hasDiscount ? getDiscountedPrice(product.price, product.discount_percent) : null;
              return (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition flex justify-between gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold mb-2 truncate">{product.name_la}</h2>
                    <p className="text-gray-600 mb-2 line-clamp-2 text-sm">{product.description_la}</p>
                    <div className="mb-2">
                      {hasDiscount ? (
                        <>
                          <span className="text-lg font-bold text-red-600">{discountedPrice!.toLocaleString()} ກີບ</span>
                          <span className="text-gray-400 text-sm line-through ml-2">{product.price.toLocaleString()} ກີບ</span>
                          <span className="bg-red-100 text-red-600 text-xs font-bold px-1 py-0.5 rounded ml-1">-{product.discount_percent}%</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-green-600">{product.price.toLocaleString()} ກີບ</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/product/${product.id}`} className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition">ເບິ່ງ</Link>
                      <Link href={product.shops?.slug ? `/shop/${product.shops.slug}` : '#'} className="text-sm text-blue-600 hover:underline truncate">
                        {product.shops?.name_la || 'ຮ້ານທົ່ວໄປ'}
                      </Link>
                    </div>
                  </div>
                  <div className="w-24 h-24 flex-shrink-0 relative rounded overflow-hidden bg-gray-100">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.name_la} fill sizes="96px" className="object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">ບໍ່ມີຮູບ</div>
                    )}
                    {hasDiscount && (
                      <div className="absolute top-0 left-0 bg-red-600 text-white text-xs font-bold px-1">-{product.discount_percent}%</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && products.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={() => { setLoadingMore(true); setPage(p => p + 1); }}
              disabled={loadingMore}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {loadingMore ? 'ກຳລັງໂຫຼດ...' : 'ໂຫຼດເພີ່ມເຕີມ'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}