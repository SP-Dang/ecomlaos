'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AdminReportedShops() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  const fetchReports = async () => {
    setLoading(true);
    let query = supabase
      .from('shop_reports')
      .select(`*, shops (name_la, owner_id, is_active)`)
      .order('created_at', { ascending: false });

    if (searchTerm.trim()) {
      query = query.ilike('shops.name_la', `%${searchTerm}%`);
    }

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const { data, error, count } = await query.range(from, to);
    if (!error) setReports(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [searchTerm, currentPage]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('shop_reports')
      .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) alert(error.message);
    else fetchReports();
  };

  const suspendShop = async (shopId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('shops')
      .update({ is_active: !currentActive })
      .eq('id', shopId);
    if (error) alert(error.message);
    else fetchReports();
  };

  const totalPages = Math.ceil(reports.length / itemsPerPage); // simplified; better to use count from query

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ຮ້ານທີ່ຖືກລາຍງານ</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder="ຄົ້ນຫາຕາມຊື່ຮ້ານ"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 border rounded px-3 py-2"
        />
      </div>
      {loading ? <div className="text-center">ກຳລັງໂຫຼດ...</div> : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead><tr className="bg-gray-100">
              <th className="px-4 py-2 border">ຮ້ານ</th>
              <th className="px-4 py-2 border">ຜູ້ລາຍງານ</th>
              <th className="px-4 py-2 border">ເຫດຜົນ</th>
              <th className="px-4 py-2 border">ລາຍລະອຽດ</th>
              <th className="px-4 py-2 border">ສະຖານະ</th>
              <th className="px-4 py-2 border">ວັນທີ</th>
              <th className="px-4 py-2 border">ການຈັດການ</th>
            </tr></thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td className="px-4 py-2 border">{report.shops?.name_la || '-'}</td>
                  <td className="px-4 py-2 border">{report.reporter_user_id?.slice(0,8)}</td>
                  <td className="px-4 py-2 border">{report.reason}</td>
                  <td className="px-4 py-2 border">{report.description || '-'}</td>
                  <td className="px-4 py-2 border">{report.status}</td>
                  <td className="px-4 py-2 border">{new Date(report.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 border">
                    {report.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(report.id, 'resolved')} className="bg-green-500 text-white px-2 py-1 rounded mr-1">ຢືນຢັນ</button>
                        <button onClick={() => updateStatus(report.id, 'dismissed')} className="bg-red-500 text-white px-2 py-1 rounded">ປະຕິເສດ</button>
                      </>
                    )}
                    {report.shops && (
                      <button onClick={() => suspendShop(report.shop_id, report.shops.is_active)} className="bg-yellow-500 text-white px-2 py-1 rounded ml-1">
                        {report.shops.is_active ? 'ປິດຮ້ານ' : 'ເປີດຮ້ານ'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && <tr><td colSpan={7} className="text-center py-4">ບໍ່ມີຂໍ້ມູນ</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {/* Add pagination if needed */}
    </div>
  );
}