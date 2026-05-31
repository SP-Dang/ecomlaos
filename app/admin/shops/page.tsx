'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AdminShops() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin') { router.push('/'); return; }
      await fetchShops();
    };
    checkAdminAndFetch();
  }, [router]);

  const fetchShops = async () => {
    setLoading(true);
    // Fetch shops with owner profile info
    const { data: shopsData, error } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    // Fetch profiles for all shop owners
    const ownerIds = shopsData?.map(s => s.owner_id) || [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', ownerIds);

    // Merge profile data into shops
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const merged = (shopsData || []).map(shop => ({
      ...shop,
      owner: profileMap.get(shop.owner_id) || null,
    }));

    setShops(merged);
    setLoading(false);
  };

  const toggleActive = async (shopId: string, currentStatus: boolean, ownerId: string) => {
    setUpdatingId(shopId);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !currentStatus })
        .eq('id', shopId);

      if (error) {
        alert('ຂໍ້ຜິດພາດ: ' + error.message);
        return;
      }

      // If approving (turning active ON) — no role change needed (already seller)
      // If rejecting (turning active OFF) — optionally revert role to buyer
      if (currentStatus === true) {
        // Deactivating shop — revert role to buyer
        await supabase
          .from('profiles')
          .update({ role: 'buyer' })
          .eq('id', ownerId);
      }

      await fetchShops();
    } finally {
      setUpdatingId(null);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    return phone.startsWith('+856') ? `0${phone.slice(4)}` : phone;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('lo-LA');

  const pendingShops = shops.filter(s => !s.is_active);
  const activeShops = shops.filter(s => s.is_active);

  if (loading) return <div className="p-8 text-center">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ຈັດການຮ້ານຄ້າ</h1>

      {/* Pending approval section */}
      {pendingShops.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded">
              ລໍຖ້າອະນຸມັດ {pendingShops.length} ຮ້ານ
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-yellow-50">
                  <th className="px-4 py-3 border text-left">ຊື່ຮ້ານ</th>
                  <th className="px-4 py-3 border text-left">ຊື່ຜູ້ຂາຍ</th>
                  <th className="px-4 py-3 border text-left">ເບີໂທ</th>
                  <th className="px-4 py-3 border text-left">ຊື່ຮ້່ານພາສາອັງກິດ</th>
                  <th className="px-4 py-3 border text-left">ເອກະສານ</th>
                  <th className="px-4 py-3 border text-left">ວັນທີສະໝັກ</th>
                  <th className="px-4 py-3 border text-left">ການຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {pendingShops.map(shop => (
                  <tr key={shop.id} className="hover:bg-yellow-50">
                    <td className="px-4 py-3 border font-medium">{shop.name_la}</td>
                    <td className="px-4 py-3 border">{shop.owner?.full_name || '-'}</td>
                    <td className="px-4 py-3 border">{formatPhone(shop.owner?.phone)}</td>
                    <td className="px-4 py-3 border text-sm text-gray-500">{shop.slug}</td>
                    <td className="px-4 py-3 border">
                      {shop.verification_doc ? (
                        <a
                          href={shop.verification_doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          ເບິ່ງເອກະສານ 📄
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">ບໍ່ມີ</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border text-sm">{formatDate(shop.created_at)}</td>
                    <td className="px-4 py-3 border">
                      <button
                        onClick={() => toggleActive(shop.id, shop.is_active, shop.owner_id)}
                        disabled={updatingId === shop.id}
                        className="bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                      >
                        {updatingId === shop.id ? 'ກຳລັງ...' : '✅ ອະນຸມັດ'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active shops section */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
            ຮ້ານທີ່ເປີດໃຊ້ {activeShops.length} ຮ້ານ
          </span>
        </h2>
        {activeShops.length === 0 ? (
          <p className="text-gray-500 text-center py-4">ຍັງບໍ່ມີຮ້ານທີ່ໄດ້ຮັບການອະນຸມັດ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-green-50">
                  <th className="px-4 py-3 border text-left">ຊື່ຮ້ານ</th>
                  <th className="px-4 py-3 border text-left">ຊື່ຜູ້ຂາຍ</th>
                  <th className="px-4 py-3 border text-left">ເບີໂທ</th>
                  <th className="px-4 py-3 border text-left">Slug</th>
                  <th className="px-4 py-3 border text-left">ເອກະສານ</th>
                  <th className="px-4 py-3 border text-left">ວັນທີອະນຸມັດ</th>
                  <th className="px-4 py-3 border text-left">ການຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {activeShops.map(shop => (
                  <tr key={shop.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border font-medium">{shop.name_la}</td>
                    <td className="px-4 py-3 border">{shop.owner?.full_name || '-'}</td>
                    <td className="px-4 py-3 border">{formatPhone(shop.owner?.phone)}</td>
                    <td className="px-4 py-3 border text-sm text-gray-500">{shop.slug}</td>
                    <td className="px-4 py-3 border">
                      {shop.verification_doc ? (
                        <a
                          href={shop.verification_doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          ເບິ່ງເອກະສານ 📄
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">ບໍ່ມີ</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border text-sm">{formatDate(shop.created_at)}</td>
                    <td className="px-4 py-3 border">
                      <button
                        onClick={() => toggleActive(shop.id, shop.is_active, shop.owner_id)}
                        disabled={updatingId === shop.id}
                        className="bg-red-500 text-white px-4 py-1.5 rounded hover:bg-red-600 disabled:bg-gray-400 text-sm font-medium"
                      >
                        {updatingId === shop.id ? 'ກຳລັງ...' : '🚫 ປິດໃຊ້'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}