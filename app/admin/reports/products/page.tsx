'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminReportedProducts() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const { data: reportsData, error: reportsError } = await supabase
        .from('product_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (reportsError) {
        console.error(reportsError);
        setLoading(false);
        return;
      }
      if (!reportsData || reportsData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }
      const productIds = [...new Set(reportsData.map(r => r.product_id).filter(Boolean))];
      console.log('Product IDs from reports:', productIds);
      let productMap = new Map();
      if (productIds.length) {
        let productsData: any[] = [];
let productsError = null;
if (productIds.length === 1) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name_la, is_active')
    .eq('id', productIds[0])
    .single();
  productsData = data ? [data] : [];
  productsError = error;
} else if (productIds.length > 1) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name_la, is_active')
    .in('id', productIds);
  productsData = data || [];
  productsError = error;
}
console.log('Products fetch result:', productsData, productsError);
if (!productsError && productsData.length) {
  productMap = new Map(productsData.map(p => [p.id, p]));
}
        console.log('Products fetch result:', productsData, productsError);
        if (!productsError && productsData) {
          productMap = new Map(productsData.map(p => [p.id, p]));
        }
      }
      let combined = reportsData.map(r => ({
        ...r,
        product: productMap.get(r.product_id) || null
      }));
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        combined = combined.filter(r => r.product?.name_la?.toLowerCase().includes(term));
      }
      setReports(combined);
      setLoading(false);
    };
    fetchReports();
  }, [searchTerm]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('product_reports')
      .update({ status })
      .eq('id', id);
    if (error) alert(error.message);
    else window.location.reload();
  };

  const toggleProductActive = async (productId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !currentActive })
      .eq('id', productId);
    if (error) alert(error.message);
    else window.location.reload();
  };

  if (loading) return <div className="text-center py-8">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ສິນຄ້າທີ່ຖືກລາຍງານ</h1>
      <input
        type="text"
        placeholder="ຄົ້ນຫາຕາມຊື່ສິນຄ້າ"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="border rounded px-3 py-2 mb-4 w-full md:w-96"
      />
      {reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ບໍ່ມີຂໍ້ມູນ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">ສິນຄ້າ</th>
                <th className="px-4 py-2 border">ຜູ້ລາຍງານ</th>
                <th className="px-4 py-2 border">ເຫດຜົນ</th>
                <th className="px-4 py-2 border">ສະຖານະ</th>
                <th className="px-4 py-2 border">ວັນທີ</th>
                <th className="px-4 py-2 border">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 border">{r.product?.name_la || '-'}</td>
                  <td className="px-4 py-2 border">{r.reporter_user_id?.slice(0,8)}...</td>
                  <td className="px-4 py-2 border">{r.reason}</td>
                  <td className="px-4 py-2 border">{r.status}</td>
                  <td className="px-4 py-2 border">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 border">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(r.id, 'resolved')}
                        className="bg-green-500 text-white px-2 py-1 rounded mr-1"
                      >
                        ຢືນຢັນ
                      </button>
                    )}
                    {r.product && (
                      <button
                        onClick={() => toggleProductActive(r.product_id, r.product.is_active)}
                        className="bg-yellow-500 text-white px-2 py-1 rounded"
                      >
                        {r.product.is_active ? 'ເຊື່ອງ' : 'ສະແດງ'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}