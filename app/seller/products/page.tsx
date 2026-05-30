'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function SellerProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; skipped: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 21;
  const router = useRouter();

  // Stock status helper
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'ໝົດສ່ວນ', color: 'bg-red-100 text-red-700' };
    if (stock <= 5) return { label: `ໃກ້ໝົດ (${stock} ຊິ້ນ)`, color: 'bg-orange-100 text-orange-700' };
    return { label: `ມີສ່ວນ (${stock} ຊິ້ນ)`, color: 'bg-green-100 text-green-700' };
  };

  // Fetch products
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

  useEffect(() => {
    if (shopId) fetchProducts(currentPage);
  }, [shopId, currentPage, searchTerm]);

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
    else fetchProducts(currentPage);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts(1);
  };

  // ── EXPORT STOCK EXCEL ─────────────────────────────────────────────
  const handleExportStock = async () => {
    if (!shopId) return;

    // Fetch ALL products for this shop (not just current page)
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, name_la, price, stock, discount_percent, discount_ends_at, category_id, categories(name_la)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error || !allProducts) { alert('ບໍ່ສາມາດດຶງຂໍ້ມູນໄດ້'); return; }

    // Fetch total sold quantity per product
    const productIds = allProducts.map(p => p.id);
    const { data: soldData } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .in('product_id', productIds);

    // Sum sold quantities per product
    const soldMap = new Map<string, number>();
    soldData?.forEach(item => {
      soldMap.set(item.product_id, (soldMap.get(item.product_id) || 0) + item.quantity);
    });

    const isDiscountActive = (percent: number, endsAt: string | null) => {
      if (!percent || percent <= 0) return false;
      if (!endsAt) return false;
      return new Date(endsAt) > new Date();
    };

    const getStockStatusText = (stock: number) => {
      if (stock === 0) return 'ໝົດສ່ວນ';
      if (stock <= 5) return 'ໃກ້ໝົດ';
      return 'ປົກກະຕິ';
    };

    // Build export rows
    const exportData = allProducts.map(p => {
      const active = isDiscountActive(p.discount_percent, p.discount_ends_at);
      const discountedPrice = active
        ? Math.round(p.price - (p.price * p.discount_percent / 100))
        : null;

      return {
        'ລະຫັດສິນຄ້າ (ຢ່າແກ້ໄຂ)': p.id,
        'ຊື່ສິນຄ້າ': p.name_la,
        'ປະເພດ': (p.categories as any)?.name_la || '-',
        'ລາຄາ (ກີບ)': p.price,
        'ສ່ວນຫຼຸດ (%)': p.discount_percent || 0,
        'ລາຄາຫຼັງຫຼຸດ (ກີບ)': discountedPrice || p.price,
        'ສ່ວນ (ປັດຈຸບັນ)': p.stock,
        'ຂາຍໄດ້ (ທັງໝົດ)': soldMap.get(p.id) || 0,
        'ສະຖານະສ່ວນ': getStockStatusText(p.stock),
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 38 }, // ລະຫັດ
      { wch: 30 }, // ຊື່
      { wch: 15 }, // ປະເພດ
      { wch: 15 }, // ລາຄາ
      { wch: 12 }, // ສ່ວນຫຼຸດ
      { wch: 18 }, // ລາຄາຫຼັງຫຼຸດ
      { wch: 15 }, // ສ່ວນ
      { wch: 15 }, // ຂາຍໄດ້
      { wch: 15 }, // ສະຖານະ
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── DOWNLOAD IMPORT TEMPLATE ───────────────────────────────────────
  const handleDownloadTemplate = async () => {
    if (!shopId) return;

    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name_la, stock')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    const templateData = (allProducts || []).map(p => ({
      'ລະຫັດສິນຄ້າ (ຢ່າແກ້ໄຂ)': p.id,
      'ຊື່ສິນຄ້າ (ອ້າງອີງ)': p.name_la,
      'ສ່ວນໃໝ່ (ໃສ່ຕົວເລກ)': p.stock,
    }));

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 38 }, { wch: 30 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `stock_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── BULK IMPORT STOCK ──────────────────────────────────────────────
  const handleImportStock = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;

    setImporting(true);
    setImportResults(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) {
        alert('ໄຟລ໌ວ່າງເປົ່າ');
        setImporting(false);
        return;
      }

      // Fetch all product IDs belonging to this shop for validation
      const { data: shopProducts } = await supabase
        .from('products')
        .select('id')
        .eq('shop_id', shopId);
      const validIds = new Set(shopProducts?.map(p => p.id) || []);

      let successCount = 0;
      const skipped: string[] = [];

      for (const row of rows) {
        const productId = row['ລະຫັດສິນຄ້າ (ຢ່າແກ້ໄຂ)']?.toString().trim();
        const newStock = parseInt(row['ສ່ວນໃໝ່ (ໃສ່ຕົວເລກ)']);
        const productName = row['ຊື່ສິນຄ້າ (ອ້າງອີງ)'] || productId;

        // Validate
        if (!productId) { skipped.push(`ແຖວໃດໜຶ່ງ: ບໍ່ມີລະຫັດ`); continue; }
        if (!validIds.has(productId)) { skipped.push(`${productName}: ບໍ່ພົບໃນຮ້ານຂອງທ່ານ`); continue; }
        if (isNaN(newStock) || newStock < 0) { skipped.push(`${productName}: ສ່ວນບໍ່ຖືກຕ້ອງ`); continue; }

        // Update stock
        const { error } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId)
          .eq('shop_id', shopId); // Double safety check

        if (error) {
          skipped.push(`${productName}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      setImportResults({ success: successCount, skipped });
      await fetchProducts(currentPage);
    } catch (err: any) {
      alert('ອ່ານໄຟລ໌ບໍ່ສຳເລັດ: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold">ສິນຄ້າຂອງຂ້ອຍ</h1>
        <div className="flex flex-wrap gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="ຄົ້ນຫາສິນຄ້າ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-1"
            />
            <button type="submit" className="bg-gray-200 px-3 py-1 rounded">ຄົ້ນຫາ</button>
          </form>
          <Link href="/seller/products/new" className="bg-green-600 text-white px-4 py-2 rounded">
            + ເພີ່ມສິນຄ້າ
          </Link>
        </div>
      </div>

      {/* Stock management toolbar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-3">📦 ຈັດການສ່ວນ</h3>
        <div className="flex flex-wrap gap-3">
          {/* Export stock summary */}
          <button
            onClick={handleExportStock}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
          >
            📊 ສົ່ງອອກ Excel ສ່ວນ
          </button>

          {/* Download import template */}
          <button
            onClick={handleDownloadTemplate}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            📥 ດາວໂຫຼດແມ່ແບບ Excel
          </button>

          {/* Import stock */}
          <label className={`px-4 py-2 rounded text-sm text-white cursor-pointer ${importing ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {importing ? 'ກຳລັງນຳເຂົ້າ...' : '📤 ນຳເຂົ້າ Excel ສ່ວນ'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportStock}
              disabled={importing}
            />
          </label>
        </div>

        <p className="text-xs text-blue-600 mt-2">
          ຂັ້ນຕອນ: 1) ດາວໂຫຼດແມ່ແບບ → 2) ໃສ່ຕົວເລກສ່ວນໃໝ່ → 3) ນຳເຂົ້າໄຟລ໌
        </p>
      </div>

      {/* Import results */}
      {importResults && (
        <div className="mb-6 p-4 bg-white border rounded-lg">
          <h3 className="font-semibold mb-2">ຜົນການນຳເຂົ້າ</h3>
          <p className="text-green-600">✅ ອັບເດດສຳເລັດ: {importResults.success} ສິນຄ້າ</p>
          {importResults.skipped.length > 0 && (
            <div className="mt-2">
              <p className="text-orange-600">⚠️ ຖືກຂ້າມ: {importResults.skipped.length} ລາຍການ</p>
              <ul className="text-sm text-gray-600 mt-1 list-disc list-inside">
                {importResults.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          <button onClick={() => setImportResults(null)} className="mt-2 text-xs text-gray-500 hover:underline">
            ປິດ
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center py-8">ກຳລັງໂຫຼດ...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const stockStatus = getStockStatus(product.stock);
              return (
                <div
                  key={product.id}
                  className={`border rounded-lg p-3 shadow-sm hover:shadow-md transition bg-white flex flex-row justify-between gap-3 ${product.stock === 0 ? 'border-red-200' : product.stock <= 5 ? 'border-orange-200' : ''}`}
                >
                  {/* Left side */}
                  <div className="flex-1">
                    <h2 className="text-md font-semibold">{product.name_la}</h2>
                    <p className="text-green-600 font-bold text-sm">
                      {product.price.toLocaleString()} ກີບ
                    </p>
                    {/* Stock badge */}
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${stockStatus.color}`}>
                      {stockStatus.label}
                    </span>
                    {/* Discount badge */}
                    {product.discount_percent > 0 && new Date(product.discount_ends_at) > new Date() && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ml-1 bg-red-100 text-red-700">
                        -{product.discount_percent}%
                      </span>
                    )}
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
                  {/* Right side: image */}
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative">
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
                    {/* Out of stock overlay */}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-red-600 bg-opacity-60 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">ໝົດ</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {products.length === 0 && (
            <p className="text-center text-gray-500 mt-8">ບໍ່ພົບສິນຄ້າ</p>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                ກ່ອນໜ້າ
              </button>
              <span className="px-3 py-1">ໜ້າ {currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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