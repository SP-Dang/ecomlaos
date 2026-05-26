'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminShops() {
  const [shops, setShops] = useState<any[]>([]);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
    setShops(data || []);
  };

  const toggleActive = async (shopId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('shops')
      .update({ is_active: !currentStatus })
      .eq('id', shopId);
    if (error) alert(error.message);
    else fetchShops();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ຈັດການຮ້ານຄ້າ</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ຊື່ຮ້ານ</th>
              <th className="px-4 py-2 border">ເຈົ້າຂອງ</th>
              <th className="px-4 py-2 border">Slug</th>
              <th className="px-4 py-2 border">ສະຖານະ</th>
              <th className="px-4 py-2 border">ການຈັດການ</th>
            </tr>
          </thead>
          <tbody>
            {shops.map(shop => (
              <tr key={shop.id}>
                <td className="px-4 py-2 border">{shop.name_la}</td>
                <td className="px-4 py-2 border">{shop.owner_id}</td>
                <td className="px-4 py-2 border">{shop.slug}</td>
                <td className="px-4 py-2 border">{shop.is_active ? 'ເປີດໃຊ້' : 'ປິດໃຊ້'}</td>
                <td className="px-4 py-2 border">
                  <button
                    onClick={() => toggleActive(shop.id, shop.is_active)}
                    className={`px-3 py-1 rounded ${shop.is_active ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                  >
                    {shop.is_active ? 'ປິດໃຊ້' : 'ເປີດໃຊ້'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}