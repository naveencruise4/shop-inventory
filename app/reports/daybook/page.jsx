'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function DayBookPage() {
  const [shopInfo, setShopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [inflows, setInflows] = useState([]);
  const [outflows, setOutflows] = useState([]);

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
        fetchDayBookData(shop.id, selectedDate);
      }
    }
  };

  const fetchDayBookData = useCallback(async (shopId, dateStr) => {
    setLoading(true);
    const sid = shopId || shopInfo?.id;
    if (!sid) return;

    try {
      const { data: inData } = await supabase
        .from('vw_day_book_inflows')
        .select('*')
        .eq('shop_id', sid)
        .eq('tx_date', dateStr);

      const { data: outData } = await supabase
        .from('vw_day_book_outflows')
        .select('*')
        .eq('shop_id', sid)
        .eq('tx_date', dateStr);

      setInflows(inData || []);
      setOutflows(outData || []);
    } catch (err) {
      console.error('Error fetching day book:', err);
    } finally {
      setLoading(false);
    }
  }, [shopInfo?.id]);

  useEffect(() => {
    if (shopInfo?.id) {
      fetchDayBookData(shopInfo.id, selectedDate);
    }
  }, [selectedDate, shopInfo?.id, fetchDayBookData]);

  const totalIn = inflows.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const totalOut = outflows.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const netMovement = totalIn - totalOut;

  // Breakdown by method
  const groupByMethod = (list) => {
    return list.reduce((acc, curr) => {
      const method = (curr.payment_method || 'cash').toUpperCase();
      acc[method] = (acc[method] || 0) + Number(curr.amount || 0);
      return acc;
    }, {});
  };

  const inByMethod = groupByMethod(inflows);
  const outByMethod = groupByMethod(outflows);

  // Combine chronological
  const combinedTxs = [
    ...inflows.map(i => ({ ...i, type: 'in', displayAmount: i.amount })),
    ...outflows.map(o => ({ ...o, type: 'out', displayAmount: o.amount }))
  ].sort((a, b) => new Date(b.tx_timestamp) - new Date(a.tx_timestamp));

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <div>
            <h1>Day Book (Cash Flow Reconciliation)</h1>
            <p className="subtext">Track daily money in and money out movements[cite: 6]</p>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }}>Select Date:</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card success">
            <span className="summary-label">Total Money In</span>
            <span className="summary-value">₹{totalIn.toFixed(2)}</span>
          </div>
          <div className="summary-card danger">
            <span className="summary-label">Total Money Out</span>
            <span className="summary-value">₹{totalOut.toFixed(2)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Net Movement</span>
            <span className="summary-value" style={{ color: netMovement >= 0 ? '#16a34a' : '#dc2626' }}>
              {netMovement >= 0 ? `+₹${netMovement.toFixed(2)}` : `-₹${Math.abs(netMovement).toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Method Breakdowns */}
        <div className="breakdown-grid">
          <div className="card">
            <h4>Inflows by Method</h4>
            <ul>
              {Object.keys(inByMethod).length === 0 ? <p className="subtext">No inflows recorded.</p> :
                Object.entries(inByMethod).map(([m, amt]) => (
                  <li key={m}><span>{m}:</span> <strong>₹{amt.toFixed(2)}</strong></li>
                ))
              }
            </ul>
          </div>
          <div className="card">
            <h4>Outflows by Method</h4>
            <ul>
              {Object.keys(outByMethod).length === 0 ? <p className="subtext">No outflows recorded.</p> :
                Object.entries(outByMethod).map(([m, amt]) => (
                  <li key={m}><span>{m}:</span> <strong>₹{amt.toFixed(2)}</strong></li>
                ))
              }
            </ul>
          </div>
        </div>

        {/* Chronological Transaction Ledger */}
        <div className="table-wrapper card" style={{ marginTop: '16px' }}>
          <h3>Chronological Transactions</h3>
          {loading ? <p className="loading-text">Loading day book...</p> : (
            <div className="table-scroll-area">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Category</th>
                    <th>Particulars</th>
                    <th>Mode</th>
                    <th>Money In (₹)</th>
                    <th>Money Out (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedTxs.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No transactions on this date.</td></tr>
                  ) : (
                    combinedTxs.map((tx, idx) => (
                      <tr key={idx}>
                        <td>{new Date(tx.tx_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td><span className={`invoice-badge ${tx.type === 'in' ? 'gst' : 'estimate'}`}>{tx.category}</span></td>
                        <td><strong>{tx.particulars}</strong></td>
                        <td style={{ textTransform: 'uppercase' }}>{tx.payment_method}</td>
                        <td style={{ color: tx.type === 'in' ? '#16a34a' : 'inherit', fontWeight: tx.type === 'in' ? 'bold' : 'normal' }}>
                          {tx.type === 'in' ? `₹${Number(tx.amount).toFixed(2)}` : '—'}
                        </td>
                        <td style={{ color: tx.type === 'out' ? '#dc2626' : 'inherit', fontWeight: tx.type === 'out' ? 'bold' : 'normal' }}>
                          {tx.type === 'out' ? `₹${Number(tx.amount).toFixed(2)}` : '—'}
                        </td>
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
        .summary-card.danger { border-left-color: #dc2626; }
        .summary-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
        .summary-value { font-size: 20px; font-weight: 700; color: #0f172a; }
        .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
        .breakdown-grid ul { list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
        .breakdown-grid li { display: flex; justify-content: space-between; text-transform: capitalize; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; padding: 16px; }
        .table-scroll-area { flex: 1; overflow: auto; margin-top: 8px; }
        .orders-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
        .orders-table th { background: #f1f5f9; color: #475569; padding: 10px 12px; font-weight: 600; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; }
        .orders-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        .invoice-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .invoice-badge.gst { background: #e0f2fe; color: #0369a1; }
        .invoice-badge.estimate { background: #fef3c7; color: #92400e; }
        .card { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
      `}</style>
    </div>
  );
}