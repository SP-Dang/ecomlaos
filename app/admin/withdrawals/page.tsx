// app/admin/withdrawals/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

type WithdrawalRequest = any;

export default function AdminWithdrawals() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('withdrawal_requests')
      .select(`
        *,
        shops (name_la, owner_id)
      `)
      .order('requested_at', { ascending: false });

    if (activeTab === 'pending') {
      query = query.eq('status', 'pending');
    } else {
      query = query.neq('status', 'pending');
    }

    if (startDate) {
      query = query.gte('requested_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('requested_at', `${endDate}T23:59:59`);
    }

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) {
      console.error(error);
      setRequests([]);
    } else {
      let filtered = data || [];
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.shops?.name_la && r.shops.name_la.toLowerCase().includes(term)) ||
            (r.amount && r.amount.toString().includes(term)) ||
            (r.bank_account_details && r.bank_account_details.toLowerCase().includes(term))
        );
      }
      setRequests(filtered);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    }
    setLoading(false);
  }, [activeTab, searchTerm, startDate, endDate, currentPage, itemsPerPage]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      if (profile?.role !== 'admin') router.push('/');
      else fetchRequests();
    };
    checkAdmin();
  }, [fetchRequests, router]);

  const updateStatus = async (requestId: string, status: string) => {
    const { error } = await supabase
      .from('withdrawal_requests')
      .update({ status, processed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) alert(error.message);
    else fetchRequests();
  };

  const exportToExcel = () => {
    const exportData = requests.map(r => ({
      'ຮ້ານ': r.shops?.name_la || '-',
      'ຈຳນວນ (ກີບ)': r.amount,
      'ບັນຊີທະນາຄານ': r.bank_account_details,
      'ສະຖານະ': r.status,
      'ວັນທີຂໍ': new Date(r.requested_at).toLocaleString(),
      'ວັນທີດຳເນີນການ': r.processed_at ? new Date(r.processed_at).toLocaleString() : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Withdrawals');
    XLSX.writeFile(wb, `withdrawals_${new Date().toISOString().slice(0,19)}.xlsx`);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: 'ລໍຖ້າອະນຸມັດ',
      approved: 'ອະນຸມັດແລ້ວ',
      rejected: 'ປະຕິເສດ',
    };
    return map[status] || status;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ຄຳຮ້ອງຂໍຖອນເງິນ</h1>
        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded">
          ສົ່ງອອກ Excel
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          className={`pb-2 px-4 ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-500'}`}
        >
          ລໍຖ້າອະນຸມັດ
        </button>
        <button
          onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
          className={`pb-2 px-4 ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-500'}`}
        >
          ປະຫວັດການອະນຸມັດ
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="ຄົ້ນຫາຕາມຊື່ຮ້ານ, ຈຳນວນ, ຫຼື ບັນຊີທະນາຄານ"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="date"
            placeholder="ວັນທີເລີ່ມ"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="date"
            placeholder="ວັນທີສິ້ນສຸດ"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button onClick={resetFilters} className="bg-gray-600 text-white px-3 py-2 rounded">
            ລ້າງຕົວກອງ
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">ກຳລັງໂຫຼດ...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ບໍ່ມີຂໍ້ມູນ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">ຮ້ານ</th>
                <th className="px-4 py-2 border">ຈຳນວນ (ກີບ)</th>
                <th className="px-4 py-2 border">ບັນຊີທະນາຄານ</th>
                <th className="px-4 py-2 border">ສະຖານະ</th>
                <th className="px-4 py-2 border">ວັນທີຂໍ</th>
                <th className="px-4 py-2 border">ວັນທີດຳເນີນການ</th>
                <th className="px-4 py-2 border">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-2 border">{req.shops?.name_la || '-'}</td>
                  <td className="px-4 py-2 border">{req.amount.toLocaleString()}</td>
                  <td className="px-4 py-2 border">{req.bank_account_details || '-'}</td>
                  <td className="px-4 py-2 border">{getStatusLabel(req.status)}</td>
                  <td className="px-4 py-2 border">{new Date(req.requested_at).toLocaleDateString('lo-LA')}</td>
                  <td className="px-4 py-2 border">
                    {req.processed_at ? new Date(req.processed_at).toLocaleDateString('lo-LA') : '-'}
                  </td>
                  <td className="px-4 py-2 border">
                    {req.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(req.id, 'approved')} className="bg-green-600 text-white px-2 py-1 rounded mr-1">
                          ອະນຸມັດ
                        </button>
                        <button onClick={() => updateStatus(req.id, 'rejected')} className="bg-red-600 text-white px-2 py-1 rounded">
                          ປະຕິເສດ
                        </button>
                      </>
                    )}
                    {req.status === 'approved' && <span className="text-green-600">ອະນຸມັດແລ້ວ</span>}
                    {req.status === 'rejected' && <span className="text-red-600">ປະຕິເສດ</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}