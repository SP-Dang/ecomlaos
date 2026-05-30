'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function AdminCustomers() {
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [shopNameMap, setShopNameMap] = useState<Map<string, string>>(new Map());
  const itemsPerPage = 10;
  const router = useRouter();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error(profilesError);
      setLoading(false);
      return;
    }

    const sellerIds = profiles.filter(p => p.role === 'seller').map(p => p.id);
    let shopMap = new Map<string, string>();
    if (sellerIds.length) {
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('owner_id, name_la')
        .in('owner_id', sellerIds);
      if (!shopsError && shops) {
        shopMap = new Map(shops.map(s => [s.owner_id, s.name_la]));
      }
    }
    setShopNameMap(shopMap);
    setAllCustomers(profiles);
    setFilteredCustomers(profiles);
    setTotalPages(Math.ceil(profiles.length / itemsPerPage));
    setLoading(false);
  }, [itemsPerPage]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(allCustomers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = allCustomers.filter(c =>
        c.id.toLowerCase().includes(term) ||
        (c.full_name && c.full_name.toLowerCase().includes(term)) ||
        (c.phone && c.phone.toLowerCase().includes(term)) ||
        (c.address && c.address.toLowerCase().includes(term))
      );
      setFilteredCustomers(filtered);
    }
    setCurrentPage(1);
  }, [searchTerm, allCustomers]);

  useEffect(() => {
    setTotalPages(Math.ceil(filteredCustomers.length / itemsPerPage));
  }, [filteredCustomers, itemsPerPage]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') router.push('/');
      else fetchCustomers();
    };
    checkAdmin();
  }, [fetchCustomers, router]);

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDate = (date: string) => new Date(date).toLocaleDateString('lo-LA');

  // Format phone for display — remove +856 prefix if present
  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    return phone.startsWith('+856') ? `0${phone.slice(4)}` : phone;
  };

  const exportToExcel = () => {
    const exportData = filteredCustomers.map(c => ({
      'ລະຫັດ': c.id,
      'ຊື່': c.full_name || '-',
      'ເບີໂທ': formatPhone(c.phone),
      'ທີ່ຢູ່': c.address || '-',
      'ສະຖານະບົດບາດ': c.role,
      'ຊື່ຮ້ານ (ສຳລັບຜູ້ຂາຍ)': c.role === 'seller' ? (shopNameMap.get(c.id) || '-') : '-',
      'ວັນທີສະໝັກ': formatDate(c.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0, 19)}.xlsx`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ຈັດການລູກຄ້າ</h1>
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          ສົ່ງອອກ Excel
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="ຄົ້ນຫາຕາມລະຫັດ, ຊື່, ເບີໂທ, ທີ່ຢູ່"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 border rounded px-3 py-2"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">ກຳລັງໂຫຼດ...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ບໍ່ພົບຜູ້ໃຊ້</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">ລະຫັດ</th>
                <th className="px-4 py-2 border">ຊື່</th>
                <th className="px-4 py-2 border">ເບີໂທ</th>
                <th className="px-4 py-2 border">ທີ່ຢູ່</th>
                <th className="px-4 py-2 border">ສະຖານະບົດບາດ</th>
                <th className="px-4 py-2 border">ຊື່ຮ້ານ (ສຳລັບຜູ້ຂາຍ)</th>
                <th className="px-4 py-2 border">ວັນທີສະໝັກ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border text-sm font-mono">{c.id.slice(0, 8)}...</td>
                  <td className="px-4 py-2 border">{c.full_name || '-'}</td>
                  <td className="px-4 py-2 border">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-2 border">{c.address || '-'}</td>
                  <td className="px-4 py-2 border">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      c.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      c.role === 'seller' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 border">
                    {c.role === 'seller' ? (shopNameMap.get(c.id) || '-') : '-'}
                  </td>
                  <td className="px-4 py-2 border">{formatDate(c.created_at)}</td>
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