// app/admin/payments/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

type PaymentRecord = any;

export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  const fetchRecords = async () => {
    setLoading(true);
    let query = supabase
      .from('payment_verifications')
      .select(`
        *,
        orders (
          id,
          user_id,
          total_amount,
          status,
          payment_status
        )
      `)
      .order('created_at', { ascending: false });

    if (activeTab === 'pending') {
      query = query.eq('status', 'ticket_submitted');
    } else {
      query = query.neq('status', 'ticket_submitted');
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) {
      console.error('Fetch error:', error);
      setRecords([]);
    } else {
      let filteredData = data || [];
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        filteredData = filteredData.filter(
          (r) =>
            (r.ticket_number && r.ticket_number.toLowerCase().includes(term)) ||
            (r.order_id && r.order_id.toLowerCase().includes(term))
        );
      }
      setRecords(filteredData);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    }
    setLoading(false);
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      if (profile?.role !== 'admin') router.push('/');
      else fetchRecords();
    };
    checkAdmin();
  }, [activeTab, searchTerm, startDate, endDate, currentPage]);

  const verifyPayment = async (pvId: string, orderId: string) => {
    const { error: pvError } = await supabase
      .from('payment_verifications')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', pvId);
    if (pvError) {
      alert(pvError.message);
      return;
    }
    const { error: orderError } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId);
    if (orderError) alert(orderError.message);
    else alert('ຢືນຢັນການຊຳລະສຳເລັດ');
    fetchRecords();
  };

  const rejectPayment = async (pvId: string) => {
    const { error } = await supabase
      .from('payment_verifications')
      .update({ status: 'rejected' })
      .eq('id', pvId);
    if (error) alert(error.message);
    else alert('ປະຕິເສດຄຳຮ້ອງຂໍ');
    fetchRecords();
  };

  const exportToExcel = () => {
    const exportData = records.map(r => ({
      'ລະຫັດຄຳສັ່ງ': r.order_id,
      'ຈຳນວນເງິນ': r.amount,
      'ເລກ Ticket': r.ticket_number,
      'ສະຖານະ': r.status,
      'ສົ່ງເມື່ອ': new Date(r.created_at).toLocaleString(),
      'ຢືນຢັນເມື່ອ': r.verified_at ? new Date(r.verified_at).toLocaleString() : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    XLSX.writeFile(wb, `payments_${new Date().toISOString().slice(0,19)}.xlsx`);
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: 'ລໍຖ້າ',
      ticket_submitted: 'ສົ່ງ Ticket ແລ້ວ',
      verified: 'ຢືນຢັນແລ້ວ',
      rejected: 'ປະຕິເສດ',
      failed: 'ຜິດພາດ',
    };
    return map[status] || status;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ຈັດການການຊຳລະຜ່ານ QR</h1>
        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded">
          ສົ່ງອອກ Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          className={`pb-2 px-4 ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-500'}`}
        >
          ລໍຖ້າຢືນຢັນ
        </button>
        <button
          onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
          className={`pb-2 px-4 ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-500'}`}
        >
          ປະຫວັດການຢືນຢັນ
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="ເລກສັ່ງຊື້ ຫຼື ເບີໂທ-ເລກອ້າງອິງ"
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
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ບໍ່ມີຂໍ້ມູນ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">ເລກສັ່ງຊື້</th>
                <th className="px-4 py-2 border">ຈຳນວນ (ກີບ)</th>
                <th className="px-4 py-2 border">ເບິໂທ - ເລກອ້າງອິງ</th>
                <th className="px-4 py-2 border">ສະຖານະ</th>
                <th className="px-4 py-2 border">ວັນທີສົ່ງ</th>
                <th className="px-4 py-2 border">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {records.map((pv) => (
                <tr key={pv.id}>
                  <td className="px-4 py-2 border">{pv.order_id.slice(0,8)}...</td>
                  <td className="px-4 py-2 border">{pv.amount.toLocaleString()}</td>
                  <td className="px-4 py-2 border">{pv.ticket_number || '-'}</td>
                  <td className="px-4 py-2 border">{getStatusLabel(pv.status)}</td>
                  <td className="px-4 py-2 border">{new Date(pv.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 border">
                    {pv.status === 'ticket_submitted' && (
                      <>
                        <button onClick={() => verifyPayment(pv.id, pv.order_id)} className="bg-green-600 text-white px-2 py-1 rounded mr-1">
                          ຢືນຢັນ
                        </button>
                        <button onClick={() => rejectPayment(pv.id)} className="bg-red-600 text-white px-2 py-1 rounded">
                          ປະຕິເສດ
                        </button>
                      </>
                    )}
                    {pv.status === 'verified' && <span className="text-green-600">ຢືນຢັນແລ້ວ</span>}
                    {pv.status === 'rejected' && <span className="text-red-600">ປະຕິເສດ</span>}
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