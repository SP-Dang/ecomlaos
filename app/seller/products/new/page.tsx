'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function NewProduct() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    name_la: '',
    description_la: '',
    price: '',
    stock: '',
    category_id: '',
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');

      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user?.id)
        .single();
      if (!shop) router.push('/register-shop');
      else setShopId(shop.id);

      const { data: cats } = await supabase
        .from('categories')
        .select('id, name_la')
        .order('name_la');
      setCategories(cats || []);
    };
    fetchData();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      alert('ສາມາດອັບໂຫຼດໄດ້ສູງສຸດ 5 ຮູບ');
      return;
    }
    setImages(prev => [...prev, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const file of images) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${shopId}/${Date.now()}-${Math.random()}.${fileExt}`;
      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);
      if (error) throw error;
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      uploadedUrls.push(publicUrl.publicUrl);
    }
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setLoading(true);
    setUploading(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        imageUrls = await uploadImages();
      }
      const { error } = await supabase.from('products').insert({
        shop_id: shopId,
        name_la: form.name_la,
        description_la: form.description_la,
        price: parseFloat(form.price),
        stock: parseInt(form.stock),
        category_id: form.category_id || null,
        images: imageUrls,
      });
      if (error) alert(error.message);
      else router.push('/seller/products');
    } catch (err: any) {
      alert('ອັບໂຫຼດຮູບບໍ່ສຳເລັດ: ' + err.message);
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ເພີ່ມສິນຄ້າໃໝ່</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>ຊື່ສິນຄ້າ (ພາສາລາວ)</label>
          <input
            required
            value={form.name_la}
            onChange={(e) => setForm({ ...form, name_la: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label>ລາຍລະອຽດ</label>
          <textarea
            value={form.description_la}
            onChange={(e) => setForm({ ...form, description_la: e.target.value })}
            className="w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>
        <div>
          <label>ລາຄາ (ກີບ)</label>
          <input
            type="number"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label>ຈຳນວນເຫຼືອ (Stock)</label>
          <input
            type="number"
            required
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label>ປະເພດສິນຄ້າ</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">-- ເລືອກປະເພດ --</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name_la}</option>
            ))}
          </select>
        </div>
        <div>
          <label>ຮູບສິນຄ້າ (ສາມາດເລືອກໄດ້ຫຼາຍຮູບ, ສູງສຸດ 5 ຮູບ)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="w-full border rounded px-3 py-2"
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {imagePreviews.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt={`preview ${idx}`} className="w-20 h-20 object-cover rounded" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {uploading ? 'ກຳລັງອັບໂຫຼດຮູບ...' : loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      </form>
    </div>
  );
}