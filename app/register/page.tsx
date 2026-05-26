'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Send verification code
  const sendVerification = async () => {
  if (!phone || phone.length < 9) {
    setError('ກະລຸນາປ້ອນເບີໂທລະສັບ 9 ຕົວເລກ (20xxxxxxx)');
    return;
  }
  setLoading(true);
  const fullPhone = `+856${phone}`;
  const functionUrl = 'https://wridxxzzulcfneofcazz.supabase.co/functions/v1/send-verification';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ phone: fullPhone }),
    });
    const result = await response.json();
    if (result.error) {
      setError(result.error);
    } else {
      alert(`ລະຫັດຢັ້ງຢືນ: ${result.code} (ພຽງແຕ່ທົດສອບ)`);
      setCodeSent(true);
      setError('');
    }
  } catch (err) {
    console.error(err);
    setError('ບໍ່ສາມາດສົ່ງລະຫັດໄດ້, ກະລຸນາລອງໃໝ່');
  }
  setLoading(false);
};
  const verifyCode = () => {
    // For demo, we accept any 6-digit code (since we showed it in alert)
    if (verificationCode.length === 6) {
      setIsVerified(true);
      alert('ຢັ້ງຢືນເບີໂທສຳເລັດ');
    } else {
      setError('ລະຫັດຢັ້ງຢືນບໍ່ຖືກຕ້ອງ');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      setError('ກະລຸນາຢັ້ງຢືນເບີໂທກ່ອນ');
      return;
    }
    setLoading(true);
    setError('');

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'buyer',
          phone: `+856${phone}`,
          address,
          phone_verified: true,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Auto‑login after registration (if email confirmation is disabled)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
      localStorage.removeItem('redirectAfterLogin');
      router.push(redirectTo);
    } else {
      alert('ກວດສອບອີເມວຂອງທ່ານເພື່ອຢືນຢັນບັນຊີ');
      router.push('/login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">ລົງທະບຽນ</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">ຊື່ເຕັມ</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
            />
          </div>
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
          <div>
            <label className="block text-sm font-medium">ເບີໂທ (ລາວ) +856</label>
            <div className="flex gap-2">
              <span className="bg-gray-100 px-3 py-2 border rounded-l-md">+856</span>
              <input
                type="tel"
                required
                placeholder="20XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className="flex-1 px-3 py-2 border rounded-r-md"
              />
            </div>
            {!codeSent ? (
              <button
                type="button"
                onClick={sendVerification}
                disabled={loading || !phone}
                className="mt-2 text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
              >
                ສົ່ງລະຫັດຢັ້ງຢືນ
              </button>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="ລະຫັດ 6 ຕົວເລກ"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 px-3 py-1 border rounded"
                />
                <button
                  type="button"
                  onClick={verifyCode}
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  ຢັ້ງຢືນ
                </button>
              </div>
            )}
            {isVerified && <p className="text-green-600 text-sm mt-1">✓ ຢັ້ງຢືນເບີໂທແລ້ວ</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">ທີ່ຢູ່ (ບ້ານ, ເມືອງ, ແຂວງ)</label>
            <textarea
              required
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder="ບ້ານຫ້ວຍຫົງ, ເມືອງຈັນທະບູລີ, ນະຄອນຫຼວງວຽງຈັນ"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !isVerified}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'ກຳລັງລົງທະບຽນ...' : 'ລົງທະບຽນ'}
          </button>
        </form>
        <p className="text-center text-sm">
          ມີບັນຊີຢູ່ແລ້ວ?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            ເຂົ້າສູ່ລະບົບ
          </Link>
        </p>
      </div>
    </div>
  );
}