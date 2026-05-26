'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';

export default function SellerEarnings() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalApprovedWithdrawals, setTotalApprovedWithdrawals] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      if (!shop) return;
      setShopId(shop.id);

      // Fetch order items
      const { data: items } = await supabase
        .from('order_items')
        .select(`
          *,
          products (name_la),
          orders (created_at, status, payment_status)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (items) {
        setOrderItems(items);
        setFilteredItems(items);
        let earnings = 0, commission = 0, sales = 0;
        for (const item of items) {
          earnings += item.seller_share || 0;
          commission += item.commission_charged || 0;
          sales += item.price_at_purchase * item.quantity;
        }
        setTotalEarned(earnings);
        setTotalCommission(commission);
        setTotalSales(sales);
      }

      // Fetch withdrawal history and approved sum
      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('shop_id', shop.id)
        .order('requested_at', { ascending: false });
      setWithdrawalHistory(withdrawals || []);
      const approvedSum = withdrawals
        ?.filter(w => w.status === 'approved')
        .reduce((sum, w) => sum + w.amount, 0) || 0;
      setTotalApprovedWithdrawals(approvedSum);
    };
    fetchData();
  }, []);

  useEffect(() => {
    setAvailableBalance(totalEarned - totalApprovedWithdrawals);
  }, [totalEarned, totalApprovedWithdrawals]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredItems(orderItems);
    } else {
      const lower = searchTerm.toLowerCase();
      const filtered = orderItems.filter(item =>
        item.products?.name_la?.toLowerCase().includes(lower)
      );
      setFilteredItems(filtered);
    }
    setCurrentPage(1);
  }, [searchTerm, orderItems]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => setCurrentPage(page);

  const exportOrdersToExcel = () => {
    const headers = [
      'ສິນຄ້າ', 'ຈຳນວນ', 'ລາຄາຕໍ່ຊິ້ນ', 'ລາຄາລວມ',
      'ສ່ວນແບ່ງຜູ້ຂາຍ', 'ຄ່າຄອມມິດຊັ່ນ', 'ວັນທີ'
    ];
    const rows = filteredItems.map(item => [
      item.products?.name_la || '',
      item.quantity,
      item.price_at_purchase,
      item.price_at_purchase * item.quantity,
      item.seller_share,
      item.commission_charged,
      new Date(item.created_at).toLocaleDateString('lo-LA')
    ]);
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ປະຫວັດການຂາຍ');
    XLSX.writeFile(wb, `orders_${new Date().toISOString().slice(0,19)}.xlsx`);
  };

  const exportWithdrawalsToExcel = () => {
    const headers = [
      'ຈຳນວນ (ກີບ)', 'ບັນຊີທະນາຄານ', 'ສະຖານະ', 'ວັນທີຂໍ', 'ວັນທີດຳເນີນການ'
    ];
    const rows = withdrawalHistory.map(req => [
      req.amount,
      req.bank_account_details,
      getStatusText(req.status),
      new Date(req.requested_at).toLocaleDateString('lo-LA'),
      req.processed_at ? new Date(req.processed_at).toLocaleDateString('lo-LA') : '-'
    ]);
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ປະຫວັດການຖອນເງິນ');
    XLSX.writeFile(wb, `withdrawals_${new Date().toISOString().slice(0,19)}.xlsx`);
  };

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (/^\d*$/.test(raw)) {
      setWithdrawAmount(raw ? Number(raw).toLocaleString('en-US') : '');
    }
  };

  const getRawAmount = () => parseFloat(withdrawAmount.replace(/,/g, '')) || 0;

  const requestWithdrawal = async () => {
    const amountNum = getRawAmount();
    if (!amountNum || !bankDetails) {
      alert('ກະລຸນາປ້ອນຈຳນວນເງິນ ແລະ ລາຍລະອຽດທະນາຄານ');
      return;
    }
    if (amountNum > availableBalance) {
      alert(`ຈຳນວນເງິນທີ່ຂໍຖອນຫຼາຍກວ່າຍອດເງິນທີ່ສາມາດຖອນໄດ້ (${formatNumber(availableBalance)} ກີບ)`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('withdrawal_requests').insert({
      shop_id: shopId,
      amount: amountNum,
      bank_account_details: bankDetails,
      status: 'pending',
    });
    if (error) alert(error.message);
    else {
      alert('ສົ່ງຄຳຮ້ອງຂໍຖອນເງິນຮຽບຮ້ອຍ, ລໍຖ້າການອະນຸມັດ');
      setWithdrawAmount('');
      setBankDetails('');
      setShowWithdrawForm(false);
      // Refresh withdrawal history
      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('shop_id', shopId)
        .order('requested_at', { ascending: false });
      setWithdrawalHistory(withdrawals || []);
      const approvedSum = withdrawals
        ?.filter(w => w.status === 'approved')
        .reduce((sum, w) => sum + w.amount, 0) || 0;
      setTotalApprovedWithdrawals(approvedSum);
    }
    setLoading(false);
  };

  const getStatusText = (status: string) => {
    if (status === 'pending') return 'ລໍຖ້າການອະນຸມັດ';
    if (status === 'approved') return 'ອະນຸມັດແລ້ວ';
    return 'ປະຕິເສດ';
  };

  const getStatusClass = (status: string) => {
    if (status === 'pending') return 'text-yellow-600';
    if (status === 'approved') return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ລາຍຮັບ</h1>

      <div className="bg-green-100 p-4 rounded mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p>ຍອດຂາຍທັງໝົດ: <strong>{formatNumber(totalSales)} ກີບ</strong></p>
            <p>ຍອດລາຍຮັບສຸດທິ (ຫຼັງຫັກຄ່າຄອມ): <strong>{formatNumber(totalEarned)} ກີບ</strong></p>
            <p>ຄ່າຄອມມິດຊັ່ນທັງໝົດ: <strong>{formatNumber(totalCommission)} ກີບ</strong></p>
          </div>
          <div>
            <p className="font-bold text-blue-700">
              ເງິນທີ່ສາມາດຖອນໄດ້ (ຍອດລາຍຮັບສຸດທິ ຫັກ ຍອດທີ່ຖອນແລ້ວ):{' '}
              <strong>{formatNumber(availableBalance)} ກີບ</strong>
            </p>
            <p className="text-sm text-gray-600">ຍອດທີ່ຖອນແລ້ວ: {formatNumber(totalApprovedWithdrawals)} ກີບ</p>
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <div className="mb-6">
        <button
          onClick={() => setShowWithdrawForm(!showWithdrawForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showWithdrawForm ? 'ປິດ' : 'ຂໍຖອນເງິນ'}
        </button>
      </div>

      {/* Collapsible withdrawal form */}
      {showWithdrawForm && (
        <div className="border rounded p-4 mb-6">
          <h2 className="text-xl mb-4">ຂໍຖອນເງິນ</h2>
          <input
            type="text"
            placeholder="ຈຳນວນເງິນ (ກີບ)"
            value={withdrawAmount}
            onChange={handleWithdrawAmountChange}
            className="w-full border rounded px-3 py-2 mb-2"
          />
          <textarea
            placeholder="ລາຍລະອຽດບັນຊີທະນາຄານ (ຊື່, ເລກບັນຊີ, ທະນາຄານ)"
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-2"
            rows={2}
          />
          <button
            onClick={requestWithdrawal}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງຄຳຮ້ອງຂໍ'}
          </button>
        </div>
      )}

      {/* Withdrawal History */}
      <h2 className="text-xl font-semibold mb-4">ປະຫວັດການຖອນເງິນ</h2>
      <div className="overflow-x-auto mb-8">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ຈຳນວນ (ກີບ)</th>
              <th className="px-4 py-2 border">ບັນຊີທະນາຄານ</th>
              <th className="px-4 py-2 border">ສະຖານະ</th>
              <th className="px-4 py-2 border">ວັນທີຂໍ</th>
              <th className="px-4 py-2 border">ວັນທີດຳເນີນການ</th>
            </tr>
          </thead>
          <tbody>
            {withdrawalHistory.map(req => (
              <tr key={req.id}>
                <td className="px-4 py-2 border text-right">{formatNumber(req.amount)}</td>
                <td className="px-4 py-2 border">{req.bank_account_details}</td>
                <td className={`px-4 py-2 border font-semibold ${getStatusClass(req.status)}`}>
                  {getStatusText(req.status)}
                </td>
                <td className="px-4 py-2 border">{new Date(req.requested_at).toLocaleDateString('lo-LA')}</td>
                <td className="px-4 py-2 border">
                  {req.processed_at ? new Date(req.processed_at).toLocaleDateString('lo-LA') : '-'}
                </td>
              </tr>
            ))}
            {withdrawalHistory.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4">ບໍ່ມີຂໍ້ມູນ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order History */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">ປະຫວັດການຂາຍ</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ຄົ້ນຫາຕາມຊື່ສິນຄ້າ"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-1"
          />
          <button onClick={exportOrdersToExcel} className="bg-green-600 text-white px-3 py-1 rounded">
            ສົ່ງອອກ Excel (ປະຫວັດການຂາຍ)
          </button>
          <button onClick={exportWithdrawalsToExcel} className="bg-blue-600 text-white px-3 py-1 rounded">
            ສົ່ງອອກ Excel (ປະຫວັດການຖອນເງິນ)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ສິນຄ້າ</th>
              <th className="px-4 py-2 border">ຈຳນວນ</th>
              <th className="px-4 py-2 border">ລາຄາຕໍ່ຊິ້ນ</th>
              <th className="px-4 py-2 border">ລາຄາລວມ</th>
              <th className="px-4 py-2 border">ສ່ວນແບ່ງຜູ້ຂາຍ</th>
              <th className="px-4 py-2 border">ຄ່າຄອມມິດຊັ່ນ</th>
              <th className="px-4 py-2 border">ວັນທີ</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-2 border">{item.products?.name_la || '-'}</td>
                <td className="px-4 py-2 border text-center">{item.quantity}</td>
                <td className="px-4 py-2 border text-right">{formatNumber(item.price_at_purchase)}</td>
                <td className="px-4 py-2 border text-right">{formatNumber(item.price_at_purchase * item.quantity)}</td>
                <td className="px-4 py-2 border text-right">{formatNumber(item.seller_share)}</td>
                <td className="px-4 py-2 border text-right">{formatNumber(item.commission_charged)}</td>
                <td className="px-4 py-2 border">{new Date(item.created_at).toLocaleDateString('lo-LA')}</td>
              </tr>
            ))}
            {currentItems.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-4">ບໍ່ມີຂໍ້ມູນ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            ກ່ອນໜ້າ
          </button>
          <span className="px-3 py-1">ໜ້າ {currentPage} / {totalPages}</span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
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