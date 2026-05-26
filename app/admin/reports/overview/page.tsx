'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function AdminOverviewReport() {
  const [loading, setLoading] = useState(true);
  const [gmv, setGmv] = useState(0);
  const [platformRevenue, setPlatformRevenue] = useState(0);
  const [escrowBalance, setEscrowBalance] = useState(0);
  const [topShop, setTopShop] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reportedShops, setReportedShops] = useState<any[]>([]);
  const [reportedProducts, setReportedProducts] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      if (profile?.role !== 'admin') router.push('/');

      // 1. GMV
      const { data: orders } = await supabase.from('orders').select('total_amount');
      const totalGMV = orders?.reduce((s, o) => s + o.total_amount, 0) || 0;
      setGmv(totalGMV);

      // 2. Platform Revenue
      const { data: commItems } = await supabase.from('order_items').select('commission_charged');
      const totalCommission = commItems?.reduce((s, i) => s + (i.commission_charged || 0), 0) || 0;
      setPlatformRevenue(totalCommission);

      // 3. Escrow Balance
      const { data: paidOrderItems } = await supabase
        .from('order_items')
        .select('seller_share')
        .eq('orders.payment_status', 'paid');
      let sellerSharePaid = paidOrderItems?.reduce((s, i) => s + (i.seller_share || 0), 0) || 0;
      const { data: approvedWithdrawals } = await supabase
        .from('withdrawal_requests')
        .select('amount')
        .eq('status', 'approved');
      const totalWithdrawn = approvedWithdrawals?.reduce((s, w) => s + w.amount, 0) || 0;
      setEscrowBalance(sellerSharePaid - totalWithdrawn);

      // 4. Top selling shop
      const { data: shops } = await supabase.from('shops').select('id, name_la');
      let shopSales: any[] = [];
      for (const shop of shops || []) {
        const { data: items } = await supabase
          .from('order_items')
          .select('price_at_purchase, quantity')
          .eq('shop_id', shop.id);
        const sales = items?.reduce((s, i) => s + i.price_at_purchase * i.quantity, 0) || 0;
        shopSales.push({ name: shop.name_la, sales });
      }
      shopSales.sort((a,b) => b.sales - a.sales);
      if (shopSales.length) setTopShop(shopSales[0]);

      // 5. Top selling products
      const { data: allProducts } = await supabase.from('products').select('id, name_la');
      let productQuantities: any[] = [];
      for (const prod of allProducts || []) {
        const { data: items } = await supabase
          .from('order_items')
          .select('quantity')
          .eq('product_id', prod.id);
        const qty = items?.reduce((s, i) => s + i.quantity, 0) || 0;
        productQuantities.push({ id: prod.id, name: prod.name_la, qty });
      }
      productQuantities.sort((a,b) => b.qty - a.qty);
      setTopProducts(productQuantities.slice(0, 5));

      // 6. Low stock
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, name_la, stock')
        .lte('stock', 5);
      setLowStockProducts(lowStock || []);

      // 7. Disputes
      const { data: refundOrders } = await supabase
        .from('orders')
        .select('id, created_at, total_amount, status, payment_status')
        .or('status.eq.refunded,payment_status.eq.refunded');
      setDisputes(refundOrders || []);

      // 8. Reported shops and products
      const { data: shopReports } = await supabase
        .from('shop_reports')
        .select('*, shops(name_la)')
        .order('created_at', { ascending: false });
      const { data: productReports } = await supabase
        .from('product_reports')
        .select('*, products(name_la)')
        .order('created_at', { ascending: false });
      setReportedShops(shopReports || []);
      setReportedProducts(productReports || []);

      setLoading(false);
    };
    fetchData();
  }, []);

  const exportDisputesToExcel = () => {
    const headers = ['Order ID', 'Date', 'Total Amount', 'Status', 'Payment Status'];
    const rows = disputes.map(d => [d.id, new Date(d.created_at).toLocaleDateString(), d.total_amount, d.status, d.payment_status]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Disputes');
    XLSX.writeFile(wb, `disputes_${new Date().toISOString().slice(0,19)}.xlsx`);
  };

  const exportLowStockToExcel = () => {
    const headers = ['Product Name', 'Stock'];
    const rows = lowStockProducts.map(p => [p.name_la, p.stock]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LowStock');
    XLSX.writeFile(wb, `lowstock_${new Date().toISOString().slice(0,19)}.xlsx`);
  };

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  if (loading) return <div className="p-8 text-center">ກຳລັງໂຫຼດລາຍງານ...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ລາຍງານພາບລວມທຸລະກິດ</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-100 p-4 rounded">
          <h3 className="text-lg font-semibold">Gross Merchandise Volume (GMV)</h3>
          <p className="text-2xl font-bold">{formatNumber(gmv)} ກີບ</p>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <h3 className="text-lg font-semibold">Platform Revenue (Commission)</h3>
          <p className="text-2xl font-bold">{formatNumber(platformRevenue)} ກີບ</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <h3 className="text-lg font-semibold">Escrow Balance (ຍອດຄ້າງຈ່າຍຜູ້ຂາຍ)</h3>
          <p className="text-2xl font-bold">{formatNumber(escrowBalance)} ກີບ</p>
        </div>
      </div>

      {/* Top Selling Shop */}
      {topShop && (
        <div className="bg-gray-50 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold">ຮ້ານທີ່ຂາຍດີທີ່ສຸດ</h2>
          <p>{topShop.name} - ຍອດຂາຍ {formatNumber(topShop.sales)} ກີບ</p>
        </div>
      )}

      {/* Top Selling Products */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">ສິນຄ້າຂາຍດີທີ່ສຸດ (ຕາມຈຳນວນຊິ້ນ)</h2>
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ສິນຄ້າ</th>
              <th className="px-4 py-2 border">ຈຳນວນທີ່ຂາຍໄດ້</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, idx) => (
              <tr key={p.id || idx}>
                <td className="px-4 py-2 border">{p.name}</td>
                <td className="px-4 py-2 border">{p.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Low Stock Alert */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold mb-2">ສິນຄ້າຄົງເຫຼືອໜ້ອຍ (≤5) ແລະ ໝົດ</h2>
          <button onClick={exportLowStockToExcel} className="bg-green-600 text-white px-3 py-1 rounded text-sm">ສົ່ງອອກ Excel</button>
        </div>
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ສິນຄ້າ</th>
              <th className="px-4 py-2 border">ຄົງເຫຼືອ</th>
            </tr>
          </thead>
          <tbody>
            {lowStockProducts.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2 border">{p.name_la}</td>
                <td className="px-4 py-2 border">{p.stock}</td>
              </tr>
            ))}
            {lowStockProducts.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center py-2">ບໍ່ມີ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dispute & Refund Report */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold mb-2">ລາຍງານການຂັດແຍ່ງ / ເງິນຄືນ</h2>
          <button onClick={exportDisputesToExcel} className="bg-green-600 text-white px-3 py-1 rounded text-sm">ສົ່ງອອກ Excel</button>
        </div>
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">ລະຫັດຄຳສັ່ງ</th>
              <th className="px-4 py-2 border">ວັນທີ</th>
              <th className="px-4 py-2 border">ຍອດ</th>
              <th className="px-4 py-2 border">ສະຖານະ</th>
              <th className="px-4 py-2 border">ສະຖານະຊຳລະ</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map(d => (
              <tr key={d.id}>
                <td className="px-4 py-2 border">{d.id.slice(0,8)}</td>
                <td className="px-4 py-2 border">{new Date(d.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 border">{formatNumber(d.total_amount)}</td>
                <td className="px-4 py-2 border">{d.status}</td>
                <td className="px-4 py-2 border">{d.payment_status}</td>
              </tr>
            ))}
            {disputes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-2">ບໍ່ມີ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reported Shops & Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">ຮ້ານທີ່ຖືກລາຍງານ</h2>
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">ຊື່ຮ້ານ</th>
                <th className="px-4 py-2 border">ເຫດຜົນ</th>
              </tr>
            </thead>
            <tbody>
              {reportedShops.length > 0 ? (
                reportedShops.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 border">{r.shops?.name_la}</td>
                    <td className="px-4 py-2 border">{r.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-2">ບໍ່ມີຂໍ້ມູນ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">ສິນຄ້າທີ່ຖືກລາຍງານ</h2>
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">ສິນຄ້າ</th>
                <th className="px-4 py-2 border">ເຫດຜົນ</th>
              </tr>
            </thead>
            <tbody>
              {reportedProducts.length > 0 ? (
                reportedProducts.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 border">{r.products?.name_la}</td>
                    <td className="px-4 py-2 border">{r.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-2">ບໍ່ມີຂໍ້ມູນ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}