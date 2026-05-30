'use client';

import { useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convert phone to dummy email for Supabase Auth
      const dummyEmail = `phone_856${phone}@ecomlao.com`;

      const { error } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password,
      });

      if (error) {
        setError('ເບີໂທ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
      } else {
        const redirectTo = searchParams.get('redirectTo') ||
                           localStorage.getItem('redirectAfterLogin') ||
                           '/';
        localStorage.removeItem('redirectAfterLogin');
        router.push(redirectTo);
      }
    } catch (err: any) {
      setError('ເກີດຂໍ້ຜິດພາດ, ກະລຸນາລອງໃໝ່');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">ເຂົ້າສູ່ລະບົບ</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium">ເບີໂທລະສັບ</label>
            <div className="flex mt-1">
              <span className="bg-gray-100 px-3 py-2 border border-r-0 rounded-l-md text-gray-600">
                +856
              </span>
              <input
                type="tel"
                required
                placeholder="20XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 px-3 py-2 border rounded-r-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">ລະຫັດຜ່ານ</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'ກຳລັງເຂົ້າສູ່ລະບົບ...' : 'ເຂົ້າສູ່ລະບົບ'}
          </button>
        </form>
        <p className="text-center">
          ຍັງບໍ່ມີບັນຊີ?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            ລົງທະບຽນ
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">ກຳລັງໂຫຼດ...</div>}>
      <LoginForm />
    </Suspense>
  );
}