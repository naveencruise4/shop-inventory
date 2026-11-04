'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function GSTReportsPage() {
  const [shopInfo, setShopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [gstSales, setGstSales] = useState([]);

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
    if (appUser?.shop_id) {
      const { data: shop } = await supabase.from('shops').select('id, name').eq('id', appUser.shop_id).single();
      if (shop) {
        setShopInfo(shop);
        fetchGstSales(shop.id, selectedMonth);
      }
    }
  };

  const fetchGstSales = useCallback(async (shopId, monthStr) => {
    setLoading(true);
    const sid = shopId || shopInfo?.id;
    if (!sid) return;

    // monthStr is formatted as "YYYY-MM"
    const [year, month] = monthStr.split('-');

    // Dynamically calculate the last day of the selected month
    const lastDayDate = new Date(Number(year), Number(month), 0);

    // FIX: Format using local date methods instead of toISOString()
    const yyyy = lastDayDate.getFullYear();
    const mm = String(lastDayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDayDate.getDate()).padStart(2, '0');

    const lastDayStr = `${yyyy}-${mm}-${dd}`; // Will correctly be "2026-10-31"
    const firstDayStr = `${monthStr}-01`;


    try {
      const { data } = await supabase
        .from('vw_gst_sales_register')
        .select('*')
        .eq('shop_id', sid)
        .gte('invoice_date', firstDayStr)
        .lte('invoice_date', lastDayStr)
        .order('invoice_date', { ascending: false });

      setGstSales(data || []);
    } catch (err) {
      console.error('Error fetching GST sales:', err);
    } finally {
      setLoading(false);
    }
  }, [shopInfo?.id]);

  useEffect(() => {
    if (shopInfo?.id) {
      fetchGstSales(shopInfo.id, selectedMonth);
    }
  }, [selectedMonth, shopInfo?.id, fetchGstSales]);

  // Summaries
  const totalTaxable = gstSales.reduce((sum, item) => sum + Number(item.taxable_value || 0), 0);
  const totalGst = gstSales.reduce((sum, item) => sum + Number(item.gst_amount || 0), 0);
  const totalGross = gstSales.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0);

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <div>
            <h1>GST Reports (Outward Supplies Register)[cite: 6]</h1>
            <p className="subtext">Monthly auditor-ready GSTR export format[cite: 6]</p>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }}>Select Month:</label>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Taxable Value</span>
            <span className="summary-value">₹{totalTaxable.toFixed(2)}</span>
          </div>
          <div className="summary-card success">
            <span className="summary-label">Total GST Extracted</span>
            <span className="summary-value">₹{totalGst.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Gross Value</span>
            <span className="summary-value">₹{totalGross.toFixed(2)}</span>
          </div>
        </div>

        <div className="table-wrapper card">
          <h3>GST Sales Register ({selectedMonth})</h3>
          {loading ? <p className="loading-text">Loading GST report...</p> : (
            <div className="table-scroll-area" style={{ marginTop: '10px' }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>GSTIN</th>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>HSN</th>
                    <th>Qty</th>
                    <th>Taxable (₹)</th>
                    <th>GST %</th>
                    <th>GST Amt (₹)</th>
                    <th>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {gstSales.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No GST invoices found for this month.</td></tr>
                  ) : (
                    gstSales.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.order_number}</strong></td>
                        <td>{item.invoice_date}</td>
                        <td>{item.customer_name || 'Walk-in'}</td>
                        <td>{item.customer_gstin || '—'}</td>
                        <td>{item.sku}</td>
                        <td>{item.product_name}</td>
                        <td>{item.hsn_code || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>{Number(item.taxable_value).toFixed(2)}</td>
                        <td>{item.gst_percentage}</td>
                        <td style={{ color: '#0369a1' }}>{Number(item.gst_amount).toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold' }}>{Number(item.gross_amount).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .top-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; flex-shrink: 0; }
        .top-bar h1 { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
        .subtext { font-size: 13px; color: #64748b; }
        .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
        .summary-card { background: white; padding: 14px 18px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; border-left: 4px solid #0284c7; }
        .summary-card.success { border-left-color: #16a34a; }
        .summary-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
        .summary-value { font-size: 20px; font-weight: 700; color: #0f172a; }
        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; padding: 16px; }
        .table-scroll-area { flex: 1; overflow: auto; }
        .orders-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
        .orders-table th { background: #f1f5f9; color: #475569; padding: 10px 12px; font-weight: 600; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; }
        .orders-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        .card { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
      `}</style>
    </div>
  );
}