'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';

export default function EditProduct() {
  const { id } = useParams();
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    name_la: '',
    description_la: '',
    price: '',
    stock: '',
    category_id: '',
  });
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name_la')
        .order('name_la');
      setCategories(cats || []);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        alert(error.message);
        router.push('/seller/products');
      } else if (data) {
        setForm({
          name_la: data.name_la,
          description_la: data.description_la || '',
          price: data.price.toString(),
          stock: data.stock.toString(),
          category_id: data.category_id || '',
        });
        setExistingImages(data.images || []);
      }
    };
    fetchData();
  }, [id, router]);

  const handleNewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length + newImageFiles.length + files.length;
    if (totalImages > 5) {
      alert('ສາມາດມີຮູບໄດ້ສູງສຸດ 5 ຮູບເທົ່ານັ້ນ');
      return;
    }
    setNewImageFiles(prev => [...prev, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setNewImagePreviews(prev => [...prev, ...previews]);
  };

  const removeExistingImage = (index: number) => {
    const newList = [...existingImages];
    newList.splice(index, 1);
    setExistingImages(newList);
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(newImagePreviews[index]);
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadNewImages = async (shopId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const file of newImageFiles) {
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

  const deleteRemovedImages = async (removedImageUrls: string[]) => {
    for (const url of removedImageUrls) {
      const path = url.split('/product-images/')[1];
      if (path) {
        await supabase.storage.from('product-images').remove([path]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploading(true);

    try {
      const { data: productData } = await supabase
        .from('products')
        .select('shop_id')
        .eq('id', id)
        .single();
      const shopId = productData?.shop_id;
      if (!shopId) throw new Error('Shop not found');

      let newImageUrls: string[] = [];
      if (newImageFiles.length > 0) {
        newImageUrls = await uploadNewImages(shopId);
      }

      const finalImages = [...existingImages, ...newImageUrls];

      const originalImages = (await supabase.from('products').select('images').eq('id', id).single()).data?.images || [];
      const removedImages = originalImages.filter((url: string) => !finalImages.includes(url));
      if (removedImages.length > 0) {
        await deleteRemovedImages(removedImages);
      }

      const { error } = await supabase
        .from('products')
        .update({
          name_la: form.name_la,
          description_la: form.description_la,
          price: parseFloat(form.price),
          stock: parseInt(form.stock),
          category_id: form.category_id || null,
          images: finalImages,
        })
        .eq('id', id);

      if (error) throw error;
      router.push('/seller/products');
    } catch (err: any) {
      alert('ບໍ່ສາມາດບັນທຶກການແກ້ໄຂ: ' + err.message);
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ແກ້ໄຂສິນຄ້າ</h1>
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

        {/* Existing images */}
        <div>
          <label>ຮູບທີ່ມີຢູ່ແລ້ວ (ສາມາດກົດ × ເພື່ອລຶບ)</label>
          <div className="flex gap-2 flex-wrap mt-2">
            {existingImages.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt="product" className="w-20 h-20 object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            {existingImages.length === 0 && <span className="text-gray-500 text-sm">ບໍ່ມີຮູບ</span>}
          </div>
        </div>

        {/* Add new images */}
        <div>
          <label>ເພີ່ມຮູບໃໝ່ (ເລືອກໄດ້ຫຼາຍຮູບ, ລວມແລ້ວບໍ່ເກີນ 5 ຮູບ)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleNewImages}
            className="w-full border rounded px-3 py-2 mt-1"
          />
          <div className="flex gap-2 flex-wrap mt-2">
            {newImagePreviews.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt="new preview" className="w-20 h-20 object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => removeNewImage(idx)}
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
          {uploading ? 'ກຳລັງອັບໂຫຼດຮູບ...' : loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການແກ້ໄຂ'}
        </button>
      </form>
    </div>
  );
}