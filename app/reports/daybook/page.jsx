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
  const [openingBalance, setOpeningBalance] = useState(0);

  // Cash Remittance Modal State
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);
  const [remitAmount, setRemitAmount] = useState('');
  const [remitDestination, setRemitDestination] = useState('Bank Deposit');
  const [remitRef, setRemitRef] = useState('');
  const [remitNotes, setRemitNotes] = useState('');

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

  // Opening Balance Modal State
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [newOpeningAmt, setNewOpeningAmt] = useState('');

  const handleSaveOpeningBalance = async (e) => {
    e.preventDefault();
    if (!shopInfo?.id || newOpeningAmt === '') return;

    try {
      const { error } = await supabase
        .from('shop_daily_cash_states')
        .upsert({
          shop_id: shopInfo.id,
          business_date: selectedDate,
          opening_balance: Number(newOpeningAmt),
          status: 'open'
        }, { onConflict: 'shop_id, business_date' });

      if (error) throw error;

      alert('✅ Opening balance updated successfully!');
      setShowOpeningModal(false);
      setNewOpeningAmt('');
      fetchDayBookData(shopInfo.id, selectedDate);
    } catch (err) {
      alert(`Failed to save opening balance: ${err.message}`);
    }
  };

  const fetchDayBookData = useCallback(async (shopId, dateStr) => {
    setLoading(true);
    const sid = shopId || shopInfo?.id;
    if (!sid) return;

    try {
      // 1. Fetch Inflows
      const { data: inData } = await supabase
        .from('vw_day_book_inflows')
        .select('*')
        .eq('shop_id', sid)
        .eq('tx_date', dateStr);

      // 2. Fetch Outflows (includes purchase payments, expenses, and cash remittances)
      const { data: outData } = await supabase
        .from('vw_day_book_outflows')
        .select('*')
        .eq('shop_id', sid)
        .eq('tx_date', dateStr);

      // 3. Fetch Opening Balance for this date
      const { data: cashState } = await supabase
        .from('shop_daily_cash_states')
        .select('opening_balance')
        .eq('shop_id', sid)
        .eq('business_date', dateStr)
        .single();

      setInflows(inData || []);
      setOutflows(outData || []);
      setOpeningBalance(cashState ? Number(cashState.opening_balance || 0) : 0);
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

  const handleRecordRemittance = async (e) => {
    e.preventDefault();
    if (!shopInfo?.id || !remitAmount) return;

    try {
      const { error } = await supabase.from('cash_remittances').insert([{
        shop_id: shopInfo.id,
        amount: Number(remitAmount),
        destination_type: remitDestination,
        reference_number: remitRef.trim() || null,
        notes: remitNotes.trim() || null,
        remittance_date: new Date().toISOString()
      }]);

      if (error) throw error;

      alert('✅ Cash remittance / bank deposit recorded successfully!');
      setShowRemittanceModal(false);
      setRemitAmount('');
      setRemitRef('');
      setRemitNotes('');
      fetchDayBookData(shopInfo.id, selectedDate);
    } catch (err) {
      alert(`Failed to record remittance: ${err.message}`);
    }
  };

  const totalIn = inflows.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const totalOut = outflows.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const netMovement = totalIn - totalOut;
  const expectedClosingCash = openingBalance + netMovement;

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

  // Combine chronological including Opening Balance as the first reference row if needed
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
            <p className="subtext">Track daily money in, money out, and cash drawer reconciliations[cite: 6]</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="primary-btn" onClick={() => setShowRemittanceModal(true)}>+ Record Cash Drop / Deposit</button>
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
        </div>

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="summary-label">Opening Balance</span>
              <button 
                onClick={() => { setNewOpeningAmt(openingBalance); setShowOpeningModal(true); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                title="Edit Opening Balance"
              >
                ✏️ Edit
              </button>
            </div>
            <span className="summary-value">₹{openingBalance.toFixed(2)}</span>
          </div>
          <div className="summary-card success">
            <span className="summary-label">Total Money In</span>
            <span className="summary-value">+₹{totalIn.toFixed(2)}</span>
          </div>
          <div className="summary-card danger">
            <span className="summary-label">Total Money Out</span>
            <span className="summary-value">-₹{totalOut.toFixed(2)}</span>
          </div>
          <div className="summary-card" style={{ borderLeftColor: '#0f172a' }}>
            <span className="summary-label">Expected Closing Cash</span>
            <span className="summary-value" style={{ color: expectedClosingCash >= 0 ? '#0f172a' : '#dc2626' }}>
              ₹{expectedClosingCash.toFixed(2)}
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
                  {/* Static Opening Balance Reference Row */}
                  <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                    <td>00:00</td>
                    <td><span className="invoice-badge gst" style={{ background: '#e2e8f0', color: '#334155' }}>Opening Balance</span></td>
                    <td>Carried forward from previous shift/day</td>
                    <td>CASH</td>
                    <td colSpan={2} style={{ color: '#0f172a' }}>₹{openingBalance.toFixed(2)} (Baseline)</td>
                  </tr>

                  {combinedTxs.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No live transactions recorded on this date.</td></tr>
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
        {/* Modal: Edit Opening Balance */}
        {showOpeningModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Set Opening Balance for {selectedDate}</h3>
              <p className="subtext">Enter the physical cash drawer balance carried forward.</p>
              <form onSubmit={handleSaveOpeningBalance}>
                <label>Opening Balance Amount (₹) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={newOpeningAmt} 
                  onChange={(e) => setNewOpeningAmt(e.target.value)} 
                  required 
                  autoFocus 
                />
                <div className="modal-actions" style={{ marginTop: '14px' }}>
                  <button type="submit" className="primary-btn">Save Opening Balance</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowOpeningModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Record Cash Remittance / Bank Deposit */}
        {showRemittanceModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Record Cash Remittance / Bank Deposit</h3>
              <p className="subtext">Transfer physical drawer cash to bank or owner holding.</p>
              <form onSubmit={handleRecordRemittance}>
                <label>Amount (₹) *</label>
                <input type="number" step="0.01" placeholder="0.00" value={remitAmount} onChange={(e) => setRemitAmount(e.target.value)} required autoFocus />
                
                <label>Destination Type *</label>
                <select value={remitDestination} onChange={(e) => setRemitDestination(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', marginBottom: '10px' }}>
                  <option value="Bank Deposit">Bank Deposit</option>
                  <option value="Owner Withdrawal">Owner Withdrawal</option>
                  <option value="Safe Transfer">Safe Transfer</option>
                </select>

                <label>Reference / Slip Number</label>
                <input placeholder="Optional bank deposit slip or UTR..." value={remitRef} onChange={(e) => setRemitRef(e.target.value)} />

                <label>Notes</label>
                <input placeholder="Optional notes..." value={remitNotes} onChange={(e) => setRemitNotes(e.target.value)} />

                <div className="modal-actions" style={{ marginTop: '14px' }}>
                  <button type="submit" className="primary-btn">Save Remittance</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowRemittanceModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .top-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; flex-shrink: 0; }
        .top-bar h1 { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
        .subtext { font-size: 13px; color: #64748b; }
        .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
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
        .primary-btn { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .modal { background: white; padding: 24px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; width: 400px; }
        .modal input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; font-size: 13px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .cancel-btn { padding: 8px 14px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
      `}</style>
    </div>
  );
}