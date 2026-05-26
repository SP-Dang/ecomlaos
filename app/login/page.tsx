'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Optional: Check if there's a stored redirect when the page loads
  useEffect(() => {
    // You could show a message like "Please log in to continue checkout"
    const redirectTo = localStorage.getItem('redirectAfterLogin');
    if (redirectTo && redirectTo !== '/') {
      console.log('You will be redirected to', redirectTo, 'after login');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Get the redirect URL stored before login (e.g., from checkout)
      const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
      localStorage.removeItem('redirectAfterLogin'); // clean up
      router.push(redirectTo);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">ເຂົ້າສູ່ລະບົບ</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium">ອີເມວ</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
            />
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
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
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