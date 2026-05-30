'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useCart } from '@/hooks/useCart';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hasActiveShop, setHasActiveShop] = useState(false);
  const router = useRouter();
  const { items } = useCart();

  // Total quantity across all cart items
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    setRole(data?.role || null);
  };

  const checkShopStatus = async (userId: string) => {
    const { data } = await supabase
      .from('shops')
      .select('is_active')
      .eq('owner_id', userId)
      .maybeSingle();
    setHasActiveShop(data?.is_active === true);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
        checkShopStatus(session.user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
        checkShopStatus(session.user.id);
      } else {
        setRole(null);
        setHasActiveShop(false);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Format display name — convert dummy email to phone number
  const displayName = user?.email?.startsWith('phone_856')
    ? `0${user.email.slice(9).replace('@ecomlao.com', '')}`
    : user?.email;

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600">
          ຮ້ານຄ້າລາວ
        </Link>
        <div className="flex gap-4 items-center">

          {/* Cart icon with badge */}
          <Link href="/cart" className="relative text-gray-600 hover:text-blue-600">
            🛒 ກະຕ່າ
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <>
              <span className="text-sm text-gray-600">
                {displayName}
                {role && ` (${role})`}
              </span>
              {role === 'buyer' && (
                <Link href="/register-shop" className="text-green-600 hover:underline">
                  ຂາຍສິນຄ້າ
                </Link>
              )}
              {role === 'seller' && hasActiveShop && (
                <Link href="/seller/dashboard" className="text-blue-600 hover:underline">
                  ບໍລິຫານຮ້ານຂອງຂ້ອຍ
                </Link>
              )}
              {role === 'admin' && (
                <Link href="/admin/dashboard" className="text-purple-600 hover:underline">
                  Admin
                </Link>
              )}
              <Link href="/orders" className="text-gray-600 hover:text-blue-600">
                ປະຫວັດຄຳສັ່ງ
              </Link>
              <button onClick={handleLogout} className="text-red-600 hover:underline">
                ອອກຈາກລະບົບ
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-blue-600 hover:underline">
                ເຂົ້າສູ່ລະບົບ
              </Link>
              <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                ລົງທະບຽນ
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}