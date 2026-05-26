'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminReturns() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchRequests = async () => {
      let query = supabase
        .from('return_requests')
        .select(`*, order_items (product_id, products (name_la))`)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (searchTerm) query = query.ilike('order_items.products.name_la', `%${searchTerm}%`);
      const { data } = await query;
      setRequests(data || []);
      setLoading(false);
    };
    fetchRequests();
  }, [searchTerm, statusFilter]);

  const updateStatus = async (id: string, status: string, refundAmount?: number) => {
    const update: any = { status };
    if (status === 'refunded') {
      update.refund_amount = refundAmount;
      update.updated_at = new Date().toISOString();
    }
    const { error } = await supabase.from('return_requests').update(update).eq('id', id);
    if (error) alert(error.message);
    else {
      if (status === 'refunded') {
        // Optionally update order_items.is_refunded = true
        const { data: req } = await supabase.from('return_requests').select('order_item_id').eq('id', id).single();
        if (req) await supabase.from('order_items').update({ is_refunded: true }).eq('id', req.order_item_id);
      }
      window.location.reload();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ຄຳຮ້ອງຂໍເງິນຄືນ</h1>
      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="ຄົ້ນຫາຕາມສິນຄ້າ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border rounded px-3 py-1" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-1">
          <option value="all">ທັງໝົດ</option>
          <option value="pending">ລໍຖ້າ</option>
          <option value="approved">ອະນຸມັດ</option>
          <option value="rejected">ປະຕິເສດ</option>
          <option value="refunded">ຄືນເງິນແລ້ວ</option>
        </select>
      </div>
      {loading ? <div>Loading...</div> : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="border p-4 rounded">
              <p><strong>ສິນຄ້າ:</strong> {req.order_items?.products?.name_la}</p>
              <p><strong>ເຫດຜົນ:</strong> {req.reason}</p>
              <p><strong>ລາຍລະອຽດ:</strong> {req.description}</p>
              <p><strong>ສະຖານະ:</strong> {req.status}</p>
              {req.status === 'pending' && (
                <div>
                  <button onClick={() => updateStatus(req.id, 'approved')} className="bg-green-500 text-white px-3 py-1 rounded mr-2">ອະນຸມັດ</button>
                  <button onClick={() => updateStatus(req.id, 'rejected')} className="bg-red-500 text-white px-3 py-1 rounded">ປະຕິເສດ</button>
                </div>
              )}
              {req.status === 'approved' && (
                <div className="mt-2">
                  <input type="number" id={`refund-${req.id}`} placeholder="ຈຳນວນທີ່ຄືນ" className="border rounded px-2 py-1 mr-2" />
                  <button onClick={() => {
                    const amount = parseFloat((document.getElementById(`refund-${req.id}`) as HTMLInputElement).value);
                    if (amount) updateStatus(req.id, 'refunded', amount);
                    else alert('ກະລຸນາປ້ອນຈຳນວນ');
                  }} className="bg-blue-500 text-white px-3 py-1 rounded">ຢືນຢັນການຄືນເງິນ</button>
                </div>
              )}
              {req.status === 'refunded' && <p>ຄືນເງິນຈຳນວນ {req.refund_amount?.toLocaleString()} ກີບ</p>}
            </div>
          ))}
          {requests.length === 0 && <p>ບໍ່ມີຄຳຮ້ອງຂໍ</p>}
        </div>
      )}
    </div>
  );
}