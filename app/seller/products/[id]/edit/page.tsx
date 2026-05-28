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
    discount_percent: '',
    discount_ends_at: '',
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
        // Format discount_ends_at date for input[type=date]
        const endsAt = data.discount_ends_at
          ? new Date(data.discount_ends_at).toISOString().split('T')[0]
          : '';
        setForm({
          name_la: data.name_la,
          description_la: data.description_la || '',
          price: data.price.toString(),
          stock: data.stock.toString(),
          category_id: data.category_id || '',
          discount_percent: data.discount_percent?.toString() || '',
          discount_ends_at: endsAt,
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
      if (path) await supabase.storage.from('product-images').remove([path]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const discountPercent = parseInt(form.discount_percent) || 0;
    if (discountPercent > 0 && !form.discount_ends_at) {
      alert('ກະລຸນາເລືອກວັນໝົດອາຍຸສ່ວນຫຼຸດ');
      return;
    }
    if (discountPercent < 0 || discountPercent > 90) {
      alert('ສ່ວນຫຼຸດຕ້ອງຢູ່ລະຫວ່າງ 0 - 90%');
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      const { data: productData } = await supabase
        .from('products')
        .select('shop_id, images')
        .eq('id', id)
        .single();
      const shopId = productData?.shop_id;
      if (!shopId) throw new Error('Shop not found');

      let newImageUrls: string[] = [];
      if (newImageFiles.length > 0) newImageUrls = await uploadNewImages(shopId);

      const finalImages = [...existingImages, ...newImageUrls];
      const originalImages = productData?.images || [];
      const removedImages = originalImages.filter((url: string) => !finalImages.includes(url));
      if (removedImages.length > 0) await deleteRemovedImages(removedImages);

      const { error } = await supabase
        .from('products')
        .update({
          name_la: form.name_la,
          description_la: form.description_la,
          price: parseFloat(form.price),
          stock: parseInt(form.stock),
          category_id: form.category_id || null,
          images: finalImages,
          discount_percent: discountPercent,
          discount_ends_at: discountPercent > 0 ? form.discount_ends_at : null,
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

  const discountPercent = parseInt(form.discount_percent) || 0;
  const previewPrice = form.price
    ? Math.round(parseFloat(form.price) - (parseFloat(form.price) * discountPercent / 100))
    : null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ແກ້ໄຂສິນຄ້າ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>ຊື່ສິນຄ້າ (ພາສາລາວ)</label>
          <input required value={form.name_la}
            onChange={(e) => setForm({ ...form, name_la: e.target.value })}
            className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label>ລາຍລະອຽດ</label>
          <textarea value={form.description_la}
            onChange={(e) => setForm({ ...form, description_la: e.target.value })}
            className="w-full border rounded px-3 py-2" rows={3} />
        </div>
        <div>
          <label>ລາຄາ (ກີບ)</label>
          <input type="number" required value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label>ຈຳນວນເຫຼືອ (Stock)</label>
          <input type="number" required value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label>ປະເພດສິນຄ້າ</label>
          <select value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full border rounded px-3 py-2">
            <option value="">-- ເລືອກປະເພດ --</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name_la}</option>
            ))}
          </select>
        </div>

        {/* DISCOUNT SECTION */}
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
          <h3 className="font-bold text-orange-700 mb-3">🔥 ຕັ້ງສ່ວນຫຼຸດ (ທາງເລືອກ)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ສ່ວນຫຼຸດ (%)</label>
              <input
                type="number"
                min="0"
                max="90"
                placeholder="0"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ໝົດອາຍຸວັນທີ</label>
              <input
                type="date"
                min={minDate}
                value={form.discount_ends_at}
                onChange={(e) => setForm({ ...form, discount_ends_at: e.target.value })}
                className="w-full border rounded px-3 py-2"
                disabled={discountPercent === 0}
              />
            </div>
          </div>
          {/* Live discount preview */}
          {discountPercent > 0 && previewPrice !== null && form.price && (
            <div className="mt-3 bg-white border border-orange-200 rounded p-3 text-sm">
              <p className="text-gray-500">ລາຄາປົກກະຕິ: <span className="line-through">{parseFloat(form.price).toLocaleString()} ກີບ</span></p>
              <p className="text-red-600 font-bold">ລາຄາຫຼັງຫຼຸດ: {previewPrice.toLocaleString()} ກີບ</p>
              <p className="text-orange-600">ລູກຄ້າປະຫຍັດ: {(parseFloat(form.price) - previewPrice).toLocaleString()} ກີບ</p>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">ຕັ້ງ 0 ຫຼື ປ່ອຍຫວ່າງ ເພື່ອລຶບສ່ວນຫຼຸດ</p>
        </div>

        {/* Existing images */}
        <div>
          <label>ຮູບທີ່ມີຢູ່ແລ້ວ (ສາມາດກົດ × ເພື່ອລຶບ)</label>
          <div className="flex gap-2 flex-wrap mt-2">
            {existingImages.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt="product" className="w-20 h-20 object-cover rounded border" />
                <button type="button" onClick={() => removeExistingImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs">×</button>
              </div>
            ))}
            {existingImages.length === 0 && <span className="text-gray-500 text-sm">ບໍ່ມີຮູບ</span>}
          </div>
        </div>

        {/* Add new images */}
        <div>
          <label>ເພີ່ມຮູບໃໝ່ (ເລືອກໄດ້ຫຼາຍຮູບ, ລວມແລ້ວບໍ່ເກີນ 5 ຮູບ)</label>
          <input type="file" accept="image/*" multiple onChange={handleNewImages}
            className="w-full border rounded px-3 py-2 mt-1" />
          <div className="flex gap-2 flex-wrap mt-2">
            {newImagePreviews.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt="new preview" className="w-20 h-20 object-cover rounded border" />
                <button type="button" onClick={() => removeNewImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs">×</button>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading || uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400">
          {uploading ? 'ກຳລັງອັບໂຫຼດຮູບ...' : loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການແກ້ໄຂ'}
        </button>
      </form>
    </div>
  );
}