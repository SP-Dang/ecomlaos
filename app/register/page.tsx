'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function RegisterPage() {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setError(t('register_error_phone_format'));
      return;
    }
    setLoading(true);
    setError('');
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
        alert(`${t('verification_code_alert_prefix')}${result.code}${t('verification_code_alert_suffix')}`);
        setCodeSent(true);
        setError('');
      }
    } catch (err) {
      setError(t('register_error_verification_failed'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = () => {
    if (verificationCode.length === 6) {
      setIsVerified(true);
      setError('');
      alert(t('register_phone_verified_alert'));
    } else {
      setError(t('register_error_code_digits'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isVerified) {
      setError(t('register_error_verify_first'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('register_error_password_mismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('register_error_password_length'));
      return;
    }

    setLoading(true);

    try {
      // Auto-generate dummy email from phone number
      const dummyEmail = `phone_856${phone}@ecomlao.com`;
      const fullPhone = `+856${phone}`;

      const { error: signUpError } = await supabase.auth.signUp({
        email: dummyEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'buyer',
            phone: fullPhone,
            address,
            phone_verified: true,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError(t('register_error_already_registered'));
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Auto-login after registration
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
        localStorage.removeItem('redirectAfterLogin');
        router.push(redirectTo);
      } else {
        alert(t('register_success_alert'));
        router.push('/login');
      }
    } catch (err: any) {
      setError(t('login_error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">{t('register_title')}</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium">{t('full_name_label')}</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder={t('full_name_placeholder')}
            />
          </div>

          {/* Phone number + verification */}
          <div>
            <label className="block text-sm font-medium">{t('phone_label_with_prefix')}</label>
            <div className="flex gap-2 mt-1">
              <span className="bg-gray-100 px-3 py-2 border rounded-l-md text-gray-600">+856</span>
              <input
                type="tel"
                required
                placeholder="20XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 px-3 py-2 border rounded-r-md"
                disabled={isVerified}
              />
            </div>

            {!codeSent && !isVerified && (
              <button
                type="button"
                onClick={sendVerification}
                disabled={loading || phone.length < 9}
                className="mt-2 text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                {t('send_verification_code_btn')}
              </button>
            )}

            {codeSent && !isVerified && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder={t('verification_code_placeholder')}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 px-3 py-1 border rounded"
                />
                <button
                  type="button"
                  onClick={verifyCode}
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  {t('verify_btn')}
                </button>
              </div>
            )}

            {isVerified && (
              <p className="text-green-600 text-sm mt-1">{t('verified_phone_label')}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium">{t('password_label')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder={t('password_placeholder')}
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium">{t('confirm_password_label')}</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder={t('confirm_password_placeholder')}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium">{t('address_label_full')}</label>
            <textarea
              required
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md"
              placeholder={t('address_placeholder_register')}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isVerified}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? t('registering_btn') : t('register_btn')}
          </button>
        </form>

        <p className="text-center text-sm">
          {t('already_has_account')}{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            {t('login_btn')}
          </Link>
        </p>
      </div>
    </div>
  );
}