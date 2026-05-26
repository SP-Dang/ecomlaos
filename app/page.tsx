'use client';

import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const itemsPerPage = 12;

  // Fetch categories once
  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('id, name_la').order('name_la');
      setCategories(data || []);
    };
    fetchCategories();
  }, []);

  const fetchProducts = useCallback(async (reset = true) => {
    if (reset) {
      setPage(1);
      setProducts([]);
      setHasMore(true);
    }
    const currentPage = reset ? 1 : page;
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from('products')
      .select(`*, shops ( name_la, slug )`, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (searchTerm.trim()) {
      query = query.ilike('name_la', `%${searchTerm}%`);
    }
    if (selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }

    const { data, error, count } = await query.range(from, to);
    if (!error && data) {
      if (reset) {
        setProducts(data);
      } else {
        setProducts(prev => [...prev, ...data]);
      }
      setHasMore((count || 0) > (currentPage * itemsPerPage));
    } else {
      console.error(error);
      if (reset) setProducts([]);
      setHasMore(false);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [searchTerm, selectedCategory, page, itemsPerPage]);

  // Fetch when page changes (for "Load More")
  useEffect(() => {
    if (page > 1) {
      fetchProducts(false);
    }
  }, [page, fetchProducts]);

  // Reset and fetch when search or category changes
  const applyFilters = () => {
    setLoading(true);
    setPage(1);
    fetchProducts(true);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setPage(prev => prev + 1);
  };

  // Initial load
  useEffect(() => {
    applyFilters();
  }, []);

  if (loading && products.length === 0) {
    return <div className="text-center p-8">ກຳລັງໂຫຼດ...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          ສະບາຍດີ ຍິນດີຕ້ອນຮັບສູ່ຮ້ານຄ້າອອນລາຍ
        </h1>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">ຄົ້ນຫາສິນຄ້າ</label>
            <input
              type="text"
              placeholder="ຊື່ສິນຄ້າ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium mb-1">ປະເພດສິນຄ້າ</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="all">ທັງໝົດ</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name_la}</option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            ຄົ້ນຫາ
          </button>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              applyFilters();
            }}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          >
            ລ້າງ
          </button>
        </div>

        {/* Products grid */}
        {products.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">ບໍ່ພົບສິນຄ້າ</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition flex justify-between gap-3 p-3">
                {/* Left side: product details */}
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
                      href={product.shops?.slug ? `/shop/${product.shops.slug}` : '#'}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {product.shops?.name_la || 'ຮ້ານທົ່ວໄປ'}
                    </Link>
                  </div>
                </div>
                {/* Right side: fixed square image */}
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

        {/* Load More button */}
        {hasMore && products.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
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