'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function LedgerPage() {
  const [loading, setLoading] = useState(true);
  const [debtors, setDebtors] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOutstandingBalances();
  }, []);

  const fetchOutstandingBalances = async () => {
    try {
      setLoading(true);

      // Fetch sales with pending/partial balances grouped by customer
      const { data, error } = await supabase
        .from('sales')
        .select(`
          total_amount,
          paid_amount,
          customer_id,
          customers ( id, name, phone )
        `)
        .in('payment_status', ['pending', 'partial']);

      if (error) throw error;

      // Group and sum dues by customer
      const balanceMap = {};
      data.forEach((sale) => {
        const custId = sale.customer_id || 'guest';
        const custName = sale.customers?.name || 'Walk-in Customer';
        const custPhone = sale.customers?.phone || 'N/A';
        const due = Number(sale.total_amount || 0) - Number(sale.paid_amount || 0);

        if (due > 0) {
          if (!balanceMap[custId]) {
            balanceMap[custId] = {
              id: custId,
              name: custName,
              phone: custPhone,
              totalDue: 0,
            };
          }
          balanceMap[custId].totalDue += due;
        }
      });

      setDebtors(Object.values(balanceMap));
    } catch (err) {
      console.error('Failed to load outstanding balances:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !repaymentAmount || Number(repaymentAmount) <= 0) return;

    try {
      setSubmitting(true);

      const { data: unusedAmount, error } = await supabase.rpc('record_customer_repayment', {
        p_customer_id: selectedCustomer.id,
        p_amount: Number(repaymentAmount),
        p_payment_method: paymentMethod,
      });

      if (error) throw error;

      alert(`Payment of ₹${repaymentAmount} recorded successfully!`);
      setSelectedCustomer(null);
      setRepaymentAmount('');
      fetchOutstandingBalances();
    } catch (err) {
      alert(`Repayment failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <h1>Customer Outstanding Balances</h1>
          <button className="refresh-btn" onClick={fetchOutstandingBalances}>
            🔄 Refresh Ledger
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading outstanding accounts...</p>
        ) : debtors.length === 0 ? (
          <div className="empty-state">
            <p>🎉 All customer balances are fully settled! No pending dues found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Total Outstanding Dues</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {debtors.map((debtor) => (
                  <tr key={debtor.id}>
                    <td className="font-semibold">{debtor.name}</td>
                    <td>{debtor.phone}</td>
                    <td className="due-amount">
                      ₹{debtor.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <button
                        className="collect-btn"
                        onClick={() => {
                          setSelectedCustomer(debtor);
                          setRepaymentAmount(debtor.totalDue);
                        }}
                      >
                        💵 Collect Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPAYMENT MODAL */}
        {selectedCustomer && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3>Record Repayment: {selectedCustomer.name}</h3>
              <p className="subtext">
                Current Total Due: <strong>₹{selectedCustomer.totalDue.toFixed(2)}</strong>
              </p>

              <form onSubmit={handleCollectPayment}>
                <div className="form-group">
                  <label>Amount Received (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={repaymentAmount}
                    onChange={(e) => setRepaymentAmount(e.target.value)}
                    placeholder="Enter collected amount"
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setSelectedCustomer(null)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={submitting}>
                    {submitting ? 'Recording...' : 'Confirm Repayment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .refresh-btn { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        
        .table-container { background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .ledger-table { width: 100%; border-collapse: collapse; text-align: left; }
        .ledger-table th { background: #f1f5f9; padding: 14px 16px; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        .ledger-table td { padding: 14px 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; }
        .font-semibold { font-weight: 600; }
        .due-amount { color: #dc2626; font-weight: 700; }
        
        .collect-btn { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
        .collect-btn:hover { background: #15803d; }
        
        .empty-state { background: white; padding: 40px; text-align: center; border-radius: 8px; border: 1px solid #e2e8f0; color: #16a34a; font-weight: 600; }
        
        /* Modal Overlay */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal-card { background: white; padding: 24px; border-radius: 10px; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
        .modal-card h3 { margin-top: 0; margin-bottom: 6px; color: #0f172a; }
        .subtext { margin-top: 0; margin-bottom: 20px; font-size: 14px; color: #64748b; }
        .form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 13px; font-weight: 600; color: #334155; }
        .form-group input, .form-group select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .cancel-btn { background: #e2e8f0; color: #475569; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; }
        .submit-btn { background: #2563eb; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
      `}</style>
    </div>
  );
}