'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function RegisterShopPage() {
  const [nameLa, setNameLa] = useState('');
  const [descriptionLa, setDescriptionLa] = useState('');
  const [slug, setSlug] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
      else setUserId(user.id);
    });
  }, []);

  const uploadDocument = async (): Promise<string | null> => {
    if (!documentFile || !userId) return null;
    setUploading(true);
    const fileExt = documentFile.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('seller-documents')
      .upload(fileName, documentFile);
    if (uploadError) {
      setError('ອັບໂຫຼດເອກະສານບໍ່ສຳເລັດ');
      setUploading(false);
      return null;
    }
    const { data: publicUrlData } = supabase.storage
      .from('seller-documents')
      .getPublicUrl(fileName);
    setUploading(false);
    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentFile) {
      setError('ກະລຸນາເລືອກເອກະສານຢັ້ງຢືນ (ບັດປະຈຳຕົວ / ທະບຽນຮ້ານ)');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const docUrl = await uploadDocument();
      if (!docUrl) { setLoading(false); return; }

      const { error: insertError } = await supabase
        .from('shops')
        .insert({
          owner_id: userId,
          name_la: nameLa,
          description_la: descriptionLa,
          slug: slug.toLowerCase().replace(/\s/g, '-'),
          is_active: false,
          verification_doc: docUrl,
        });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      // Update role to seller so they can't create another shop
      await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('id', userId);

      // Show pending screen instead of redirecting to dashboard
      setSubmitted(true);

    } catch (err: any) {
      setError('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // ── Pending approval screen ──────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold mb-3 text-gray-800">
            ສ້າງຮ້ານສຳເລັດ!
          </h2>
          <p className="text-gray-600 mb-2">
            ຮ້ານ <strong>{nameLa}</strong> ຂອງທ່ານຖືກສ້າງແລ້ວ.
          </p>
          <p className="text-gray-600 mb-6">
            ເອກະສານຂອງທ່ານກຳລັງຖືກກວດສອບໂດຍ Admin.
            ກະລຸນາລໍຖ້າການອະນຸມັດ — ປົກກະຕິໃຊ້ເວລາ 1-2 ວັນທຳການ.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6 text-left">
            <p className="text-yellow-800 text-sm font-semibold mb-1">⚠️ ກະລຸນາຮັບຊາບ</p>
            <ul className="text-yellow-700 text-sm space-y-1 list-disc list-inside">
              <li>ທ່ານຈະບໍ່ສາມາດເຂົ້າໃຊ້ຮ້ານໄດ້ຈົນກວ່າ Admin ຈະອະນຸມັດ</li>
              <li>ເມື່ອໄດ້ຮັບການອະນຸມັດ ທ່ານສາມາດ Login ກັບຄືນໄດ້</li>
              <li>ຖ້າໃຊ້ເວລາເກີນ 2 ວັນ ກະລຸນາຕິດຕໍ່ Admin</li>
            </ul>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
          >
            ອອກຈາກລະບົບ
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ສ້າງຮ້ານຄ້າ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">ຊື່ຮ້ານ (ພາສາລາວ)</label>
          <input
            type="text"
            required
            value={nameLa}
            onChange={(e) => setNameLa(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium">ລາຍລະອຽດຮ້ານ</label>
          <textarea
            value={descriptionLa}
            onChange={(e) => setDescriptionLa(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>
        <div>
          <label className="block font-medium">ຊື່ຮ້ານ (ພາສາອັງກິດເທົ່ານັ້ນ)</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s/g, '-'))}
            className="w-full border rounded px-3 py-2"
            placeholder="my-shop"
          />
          <p className="text-sm text-gray-500">ຕົວຢ່າງ: TT-Mobile → ຈະເປັນ /shop/tt-mobile</p>
        </div>
        <div>
          <label className="block font-medium">ເອກະສານຢັ້ງຢືນ (ບັດປະຈຳຕົວ / ທະບຽນຮ້ານ)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-sm text-gray-500">ອັບໂຫຼດຮູບຖ່າຍ ຫຼື PDF (ສູງສຸດບໍ່ເກີນ 3MB)</p>
        </div>
        {error && <div className="text-red-500">{error}</div>}
        <button
          type="submit"
          disabled={loading || uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading || uploading ? 'ກຳລັງສ້າງ...' : 'ສ້າງຮ້ານ'}
        </button>
      </form>
    </div>
  );
}