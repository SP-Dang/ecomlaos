'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SellerProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 21; // Change to 20 or 30 if you prefer
  const router = useRouter();

  // Fetch products with pagination and search
  const fetchProducts = async (page = 1) => {
    if (!shopId) return;
    setLoading(true);
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (searchTerm.trim()) {
      query = query.ilike('name_la', `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (!error && data) {
      setProducts(data);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } else {
      console.error(error);
    }
    setLoading(false);
  };

  // Refetch when shopId, page, or search changes
  useEffect(() => {
    if (shopId) {
      fetchProducts(currentPage);
    }
  }, [shopId, currentPage, searchTerm]);

  // Get shop ID on mount
  useEffect(() => {
    const fetchShop = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      if (!shop) return router.push('/register-shop');
      setShopId(shop.id);
    };
    fetchShop();
  }, [router]);

  const handleDelete = async (productId: string) => {
    if (!confirm('ທ່ານຕ້ອງການລຶບສິນຄ້ານີ້ແທ້ ຫຼື ບໍ່?')) return;
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) alert(error.message);
    else fetchProducts(currentPage); // Refresh current page after delete
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
    fetchProducts(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold">ສິນຄ້າຂອງຂ້ອຍ</h1>
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="ຄົ້ນຫາສິນຄ້າ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-1"
            />
            <button type="submit" className="bg-gray-200 px-3 py-1 rounded">
              ຄົ້ນຫາ
            </button>
          </form>
          <Link
            href="/seller/products/new"
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            + ເພີ່ມສິນຄ້າ
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8">ກຳລັງໂຫຼດ...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="border rounded-lg p-3 shadow-sm hover:shadow-md transition bg-white flex flex-row justify-between gap-3"
              >
                {/* Left side: details + buttons */}
                <div className="flex-1">
                  <h2 className="text-md font-semibold">{product.name_la}</h2>
                  <p className="text-green-600 font-bold text-sm">
                    {product.price.toLocaleString()} ກີບ
                  </p>
                  <p className="text-gray-500 text-xs">
                    ຈຳນວນເຫຼືອ: {product.stock}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Link
                      href={`/seller/products/${product.id}/edit`}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      ແກ້ໄຂ
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      ລຶບ
                    </button>
                  </div>
                </div>
                {/* Right side: square image 100x100 */}
                <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name_la}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      ບໍ່ມີຮູບ
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <p className="text-center text-gray-500 mt-8">ບໍ່ພົບສິນຄ້າ</p>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                ກ່ອນໜ້າ
              </button>
              <span className="px-3 py-1">
                ໜ້າ {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                ຕໍ່ໄປ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}