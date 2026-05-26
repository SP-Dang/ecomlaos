'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hasActiveShop, setHasActiveShop] = useState(false);
  const router = useRouter();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600">
          ຮ້ານຄ້າລາວ
        </Link>
        <div className="flex gap-4 items-center">
          {/* Cart link for everyone */}
          <Link href="/cart" className="text-gray-600 hover:text-blue-600">
            🛒 ກະຕ່າ
          </Link>
          {user ? (
            <>
              <span className="text-sm text-gray-600">
                {user.email}
                {role && ` (${role})`}
              </span>
              {/* Show "Sell Products" only for buyers (role = buyer) */}
              {role === 'buyer' && (
                <Link href="/register-shop" className="text-green-600 hover:underline">
                  ຂາຍສິນຄ້າ
                </Link>
              )}
              {/* Show seller dashboard only if role is seller AND shop is active */}
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
              {/* Buyer order history link */}
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