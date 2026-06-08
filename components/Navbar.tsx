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
  const [isOpen, setIsOpen] = useState(false);
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
          {/* Cart icon with badge - always visible */}
          <Link href="/cart" className="relative text-gray-600 hover:text-blue-600 mr-2 md:mr-0">
            🛒 <span className="hidden sm:inline">ກະຕ່າ</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex gap-4 items-center">
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
                <button onClick={handleLogout} className="text-red-600 hover:underline cursor-pointer">
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

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-blue-600 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-3 shadow-inner">
          {user ? (
            <div className="flex flex-col space-y-2">
              <div className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100">
                👤 {displayName} {role && `(${role})`}
              </div>
              {role === 'buyer' && (
                <Link href="/register-shop" onClick={() => setIsOpen(false)} className="text-green-600 hover:underline py-1">
                  ຂາຍສິນຄ້າ
                </Link>
              )}
              {role === 'seller' && hasActiveShop && (
                <Link href="/seller/dashboard" onClick={() => setIsOpen(false)} className="text-blue-600 hover:underline py-1">
                  ບໍລິຫານຮ້ານຂອງຂ້ອຍ
                </Link>
              )}
              {role === 'admin' && (
                <Link href="/admin/dashboard" onClick={() => setIsOpen(false)} className="text-purple-600 hover:underline py-1">
                  Admin
                </Link>
              )}
              <Link href="/orders" onClick={() => setIsOpen(false)} className="text-gray-600 hover:text-blue-600 py-1">
                ປະຫວັດຄຳສັ່ງ
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
                className="text-left text-red-600 hover:underline py-1"
              >
                ອອກຈາກລະບົບ
              </button>
            </div>
          ) : (
            <div className="flex flex-col space-y-2 pt-1">
              <Link href="/login" onClick={() => setIsOpen(false)} className="text-blue-600 hover:underline py-2 text-center border rounded">
                ເຂົ້າສູ່ລະບົບ
              </Link>
              <Link href="/register" onClick={() => setIsOpen(false)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-center block">
                ລົງທະບຽນ
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}