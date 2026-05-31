'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function SellerProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'ໝົດ', color: 'bg-red-100 text-red-700' };
    if (stock <= 5) return { label: `ໃກ້ໝົດ (${stock} ຊິ້ນ)`, color: 'bg-orange-100 text-orange-700' };
    return { label: `ມີຈຳນວນ (${stock} ຊິ້ນ)`, color: 'bg-green-100 text-green-700' };
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name_la')
      .order('name_la');
    setCategories(data || []);
  };

  const fetchProducts = async (page = 1) => {
    if (!shopId) return;
    setLoading(true);
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from('products')
      .select('*, categories(name_la)', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (searchTerm.trim()) {
      query = query.ilike('name_la', `%${searchTerm}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (!error && data) {
      setProducts(data);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
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
    fetchCategories();
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

    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, name_la, price, stock, discount_percent, discount_ends_at, categories(name_la)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error || !allProducts) { alert('ບໍ່ສາມາດດຶງຂໍ້ມູນໄດ້'); return; }

    const productIds = allProducts.map(p => p.id);
    const { data: soldData } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .in('product_id', productIds);

    const soldMap = new Map<string, number>();
    soldData?.forEach(item => {
      soldMap.set(item.product_id, (soldMap.get(item.product_id) || 0) + item.quantity);
    });

    const getStockStatusText = (stock: number) => {
      if (stock === 0) return 'ໝົດ';
      if (stock <= 5) return 'ໃກ້ໝົດ';
      return 'ປົກກະຕິ';
    };

    const isDiscountActive = (percent: number, endsAt: string | null) =>
      percent > 0 && !!endsAt && new Date(endsAt) > new Date();

    const exportData = allProducts.map(p => {
      const active = isDiscountActive(p.discount_percent, p.discount_ends_at);
      return {
        'ລະຫັດສິນຄ້າ': p.id,
        'ຊື່ສິນຄ້າ': p.name_la,
        'ປະເພດ': (p.categories as any)?.name_la || '-',
        'ລາຄາ (ກີບ)': p.price,
        'ສ່ວນຫຼຸດ (%)': p.discount_percent || 0,
        'ລາຄາຫຼັງຫຼຸດ (ກີບ)': active
          ? Math.round(p.price - (p.price * p.discount_percent / 100))
          : p.price,
        'ຈຳນວນ (ປັດຈຸບັນ)': p.stock,
        'ຂາຍໄດ້ (ທັງໝົດ)': soldMap.get(p.id) || 0,
        'ສະຖານະ': getStockStatusText(p.stock),
      };
    });

    const headers = ['ລະຫັດສິນຄ້າ', 'ຊື່ສິນຄ້າ', 'ປະເພດ', 'ລາຄາ (ກີບ)', 'ສ່ວນຫຼຸດ (%)', 'ລາຄາຫຼັງຫຼຸດ (ກີບ)', 'ຈຳນວນ (ປັດຈຸບັນ)', 'ຂາຍໄດ້ (ທັງໝົດ)', 'ສະຖານະ'];
    const ws = XLSX.utils.json_to_sheet(
      exportData.length > 0 ? exportData : [Object.fromEntries(headers.map(h => [h, '']))],
      { header: headers }
    );
    ws['!cols'] = [{ wch: 38 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── DOWNLOAD TEMPLATE WITH EXCELJS DROPDOWN ────────────────────────
  const handleDownloadTemplate = async () => {
    // Dynamically import exceljs (client-side only)
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // ── Sheet 2: Category reference (must be created first for the formula) ──
    const catSheet = wb.addWorksheet('ປະເພດ');
    catSheet.getColumn(1).width = 30;
    catSheet.getCell('A1').value = 'ປະເພດສິນຄ້າທີ່ມີ';
    catSheet.getCell('A1').font = { bold: true };
    categories.forEach((cat, i) => {
      catSheet.getCell(`A${i + 2}`).value = cat.name_la;
    });

    // ── Sheet 1: Main data entry ──
    const ws = wb.addWorksheet('ເພີ່ມສິນຄ້າ');

    // Set column widths
    ws.columns = [
      { header: 'ຊື່ສິນຄ້າ (ພາສາລາວ) *', key: 'name', width: 32 },
      { header: 'ລາຍລະອຽດ', key: 'desc', width: 32 },
      { header: 'ລາຄາ (ກີບ) *', key: 'price', width: 16 },
      { header: 'ຈຳນວນເຫຼືອ (Stock) *', key: 'stock', width: 22 },
      { header: 'ປະເພດສິນຄ້າ', key: 'category', width: 26 },
      { header: 'ສ່ວນຫຼຸດ (%) 0-90', key: 'discount', width: 20 },
      { header: 'ວັນໝົດອາຍຸສ່ວນຫຼຸດ (DD/MM/YYYY)', key: 'discountEnd', width: 32 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    // Add example row
    ws.addRow({
      name: 'ຕົວຢ່າງ: ສາຍສາກ Type C',
      desc: 'ລາຍລະອຽດສິນຄ້າ (ຖ້າມີ)',
      price: 50000,
      stock: 10,
      category: categories[0]?.name_la || '',
      discount: 0,
      discountEnd: '',
    });

    // Style example row
    const exampleRow = ws.getRow(2);
    exampleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    exampleRow.font = { italic: true, color: { argb: 'FF856404' } };

    // Add 19 empty rows for seller to fill
    for (let i = 0; i < 19; i++) {
      ws.addRow({});
    }

    // ── Add category dropdown validation for column E (rows 2-21) ──
    const catCount = categories.length;
    if (catCount > 0) {
      for (let row = 2; row <= 21; row++) {
        const cell = ws.getCell(`E${row}`);
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          // Reference to Sheet 2 category list
          formulae: [`ປະເພດ!$A$2:$A$${catCount + 1}`],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'ປະເພດບໍ່ຖືກຕ້ອງ',
          error: 'ກະລຸນາເລືອກປະເພດຈາກລາຍການ dropdown',
          showInputMessage: true,
          promptTitle: 'ເລືອກປະເພດ',
          prompt: 'ກົດ dropdown ເພື່ອເລືອກປະເພດສິນຄ້າ',
        };
      }
    }

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Generate and download file
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `add_products_template_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── BULK IMPORT NEW PRODUCTS (still uses xlsx for reading) ─────────
  const handleImportProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const categoryMap = new Map(categories.map(c => [c.name_la.trim(), c.id]));
      let successCount = 0;
      const skipped: string[] = [];
      const toInsert: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const nameLa = row['ຊື່ສິນຄ້າ (ພາສາລາວ) *']?.toString().trim();
        const price = parseFloat(row['ລາຄາ (ກີບ) *']);
        const stock = parseInt(row['ຈຳນວນເຫຼືອ (Stock) *']);
        const descriptionLa = row['ລາຍລະອຽດ']?.toString().trim() || null;
        const categoryName = row['ປະເພດສິນຄ້າ']?.toString().trim() || '';
        const discountPercent = parseInt(row['ສ່ວນຫຼຸດ (%) 0-90']) || 0;
        const discountEndsAtRaw = row['ວັນໝົດອາຍຸສ່ວນຫຼຸດ (DD/MM/YYYY)']?.toString().trim() || '';

        // Skip empty rows
        if (!nameLa && !row['ລາຄາ (ກີບ) *']) continue;

        if (!nameLa) { skipped.push(`ແຖວ ${rowNum}: ບໍ່ມີຊື່ສິນຄ້າ`); continue; }
        if (isNaN(price) || price <= 0) { skipped.push(`ແຖວ ${rowNum} (${nameLa}): ລາຄາບໍ່ຖືກຕ້ອງ`); continue; }
        if (isNaN(stock) || stock < 0) { skipped.push(`ແຖວ ${rowNum} (${nameLa}): ຈຳນວນເຫຼືອບໍ່ຖືກຕ້ອງ`); continue; }
        if (discountPercent < 0 || discountPercent > 90) { skipped.push(`ແຖວ ${rowNum} (${nameLa}): ສ່ວນຫຼຸດຕ້ອງຢູ່ 0-90%`); continue; }
        if (discountPercent > 0 && !discountEndsAtRaw) { skipped.push(`ແຖວ ${rowNum} (${nameLa}): ຕ້ອງມີວັນໝົດອາຍຸສ່ວນຫຼຸດ`); continue; }

        const categoryId = categoryName ? (categoryMap.get(categoryName) || null) : null;
        if (categoryName && !categoryId) {
          skipped.push(`ແຖວ ${rowNum} (${nameLa}): ປະເພດ "${categoryName}" ບໍ່ຖືກຕ້ອງ`);
          continue;
        }

        let discountEndsAt: string | null = null;
        if (discountPercent > 0 && discountEndsAtRaw) {
          const parts = discountEndsAtRaw.split('/');
          if (parts.length === 3) {
            const [day, month, year] = parts;
            discountEndsAt = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            skipped.push(`ແຖວ ${rowNum} (${nameLa}): ຮູບແບບວັນທີຕ້ອງເປັນ DD/MM/YYYY`);
            continue;
          }
        }

        toInsert.push({
          shop_id: shopId,
          name_la: nameLa,
          description_la: descriptionLa,
          price,
          stock,
          category_id: categoryId,
          images: [],
          discount_percent: discountPercent,
          discount_ends_at: discountEndsAt,
        });
      }

      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .insert(toInsert)
          .select();
        if (error) {
          alert('ເກີດຂໍ້ຜິດພາດ: ' + error.message);
        } else {
          successCount = data?.length || toInsert.length;
        }
      }

      setImportResults({ success: successCount, skipped });
      await fetchProducts(1);
      setCurrentPage(1);

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

      {/* Bulk toolbar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-3">📦 ຈັດການສິນຄ້າ ແລະ ສ່ວນ</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportStock} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
            📊 ສົ່ງອອກ Excel
          </button>
          <button onClick={handleDownloadTemplate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            📥 ດາວໂຫຼດ Template ເພີ່ມສິນຄ້າ
          </button>
          <label className={`px-4 py-2 rounded text-sm text-white cursor-pointer ${importing ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {importing ? 'ກຳລັງນຳເຂົ້າ...' : '📤 ນຳເຂົ້າ Excel ສິນຄ້າ'}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={handleImportProducts} disabled={importing} />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ຂັ້ນຕອນ: 1) ດາວໂຫຼດ Template → 2) ເລືອກປະເພດຈາກ dropdown → 3) ນຳເຂົ້າໄຟລ໌
        </p>
      </div>

      {/* Import results */}
      {importResults && (
        <div className="mb-6 p-4 bg-white border rounded-lg">
          <h3 className="font-semibold mb-2">ຜົນການນຳເຂົ້າ</h3>
          <p className="text-green-600">✅ ເພີ່ມສິນຄ້າສຳເລັດ: {importResults.success} ລາຍການ</p>
          {importResults.skipped.length > 0 && (
            <div className="mt-2">
              <p className="text-orange-600">⚠️ ຖືກຂ້າມ: {importResults.skipped.length} ລາຍການ</p>
              <ul className="text-sm text-gray-600 mt-1 list-disc list-inside">
                {importResults.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          <button onClick={() => setImportResults(null)} className="mt-2 text-xs text-gray-500 hover:underline">ປິດ</button>
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
                <div key={product.id}
                  className={`border rounded-lg p-3 shadow-sm hover:shadow-md transition bg-white flex flex-row justify-between gap-3 ${
                    product.stock === 0 ? 'border-red-200' : product.stock <= 5 ? 'border-orange-200' : ''
                  }`}>
                  <div className="flex-1">
                    <h2 className="text-md font-semibold">{product.name_la}</h2>
                    <p className="text-green-600 font-bold text-sm">{product.price.toLocaleString()} ກີບ</p>
                    {product.categories?.name_la && (
                      <p className="text-gray-400 text-xs">{product.categories.name_la}</p>
                    )}
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${stockStatus.color}`}>
                      {stockStatus.label}
                    </span>
                    {product.discount_percent > 0 && product.discount_ends_at && new Date(product.discount_ends_at) > new Date() && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ml-1 bg-red-100 text-red-700">
                        -{product.discount_percent}%
                      </span>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Link href={`/seller/products/${product.id}/edit`} className="text-blue-600 text-xs hover:underline">ແກ້ໄຂ</Link>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 text-xs hover:underline">ລຶບ</button>
                    </div>
                  </div>
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name_la} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">ບໍ່ມີຮູບ</div>
                    )}
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
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">ກ່ອນໜ້າ</button>
              <span className="px-3 py-1">ໜ້າ {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">ຕໍ່ໄປ</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}