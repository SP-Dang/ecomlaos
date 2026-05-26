'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [allShops, setAllShops] = useState<any[]>([]);
  const [filteredShops, setFilteredShops] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  useEffect(() => {
    const fetchReports = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      if (profile?.role !== 'admin') router.push('/');

      // Fetch all shops
      const { data: shops } = await supabase.from('shops').select('id, name_la');
      if (!shops) return;

      // For each shop, compute sales and commission
      const shopStats = [];
      for (const shop of shops) {
        const { data: items } = await supabase
          .from('order_items')
          .select('price_at_purchase, quantity, commission_charged')
          .eq('shop_id', shop.id);
        let sales = 0, commission = 0;
        items?.forEach(item => {
          sales += item.price_at_purchase * item.quantity;
          commission += item.commission_charged || 0;
        });
        shopStats.push({
          id: shop.id,
          name: shop.name_la,
          sales,
          commission,
        });
      }
      // Sort by commission descending (or sales)
      shopStats.sort((a, b) => b.commission - a.commission);
      setAllShops(shopStats);
      setFilteredShops(shopStats);
      setLoading(false);
    };
    fetchReports();
  }, []);

  // Filter shops by name
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredShops(allShops);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = allShops.filter(shop =>
        shop.name.toLowerCase().includes(term)
      );
      setFilteredShops(filtered);
    }
    setCurrentPage(1);
  }, [searchTerm, allShops]);

  // Pagination
  const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentShops = filteredShops.slice(startIndex, startIndex + itemsPerPage);

  const totalSales = allShops.reduce((sum, shop) => sum + shop.sales, 0);
  const totalCommission = allShops.reduce((sum, shop) => sum + shop.commission, 0);

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  if (loading) return <div className="p-8 text-center">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ລາຍງານການຂາຍ ແລະ ຄ່າຄອມມິດຊັ່ນ</h1>

      <div className="bg-gray-100 p-4 rounded mb-6">
        <p><strong>ຍອດຂາຍທັງໝົດ:</strong> {formatNumber(totalSales)} ກີບ</p>
        <p><strong>ຄ່າຄອມມິດຊັ່ນທັງໝົດ:</strong> {formatNumber(totalCommission)} ກີບ</p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="ຄົ້ນຫາຕາມຊື່ຮ້ານ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 border rounded px-3 py-2"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ຮ້ານ</th>
              <th className="px-4 py-2 border">ຍອດຂາຍ (ກີບ)</th>
              <th className="px-4 py-2 border">ຄ່າຄອມມິດຊັ່ນ (ກີບ)</th>
             </tr>
          </thead>
          <tbody>
            {currentShops.map(shop => (
              <tr key={shop.id}>
                <td className="px-4 py-2 border">{shop.name}</td>
                <td className="px-4 py-2 border text-right">{formatNumber(shop.sales)}</td>
                <td className="px-4 py-2 border text-right">{formatNumber(shop.commission)}</td>
              </tr>
            ))}
            {currentShops.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-4">ບໍ່ມີຂໍ້ມູນ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            ກ່ອນໜ້າ
          </button>
          <span className="px-3 py-1">
            ໜ້າ {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            ຕໍ່ໄປ
          </button>
        </div>
      )}
    </div>
  );
}