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

  // Pre-Order Detail Modal
  const [viewingPreOrders, setViewingPreOrders] = useState(null);

  useEffect(() => {
    fetchOutstandingBalances();
  }, []);

  const fetchOutstandingBalances = async () => {
    try {
      setLoading(true);

      // Fixed query: removed 'name' from sale_items to prevent column not found error
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          total_amount,
          paid_amount,
          sale_status,
          payment_status,
          customer_id,
          customers ( id, name, phone ),
          sale_items ( product_id, sku, quantity, unit_price )
        `)
        .or('payment_status.in.(pending,partial),sale_status.eq.pre_order');

      if (error) throw error;

      // Group dues and pre-orders by customer
      const balanceMap = {};

      data.forEach((sale) => {
        const custId = sale.customer_id || 'guest';
        const custName = sale.customers?.name || 'Walk-in Customer';
        const custPhone = sale.customers?.phone || 'N/A';
        const total = Number(sale.total_amount || 0);
        const paid = Number(sale.paid_amount || 0);
        const due = Math.max(0, total - paid);

        if (due > 0 || sale.sale_status === 'pre_order') {
          if (!balanceMap[custId]) {
            balanceMap[custId] = {
              id: custId,
              name: custName,
              phone: custPhone,
              totalDue: 0,
              preOrderCount: 0,
              preOrders: [],
              regularDue: 0
            };
          }

          balanceMap[custId].totalDue += due;

          if (sale.sale_status === 'pre_order') {
            balanceMap[custId].preOrderCount += 1;
            balanceMap[custId].preOrders.push({
              id: sale.id,
              date: sale.created_at,
              totalAmount: total,
              paidAmount: paid,
              balanceDue: due,
              items: sale.sale_items || []
            });
          } else {
            balanceMap[custId].regularDue += due;
          }
        }
      });

      setDebtors(Object.values(balanceMap).filter(d => d.totalDue > 0));
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
          <h1>Customer Outstanding Balances & Pre-Orders</h1>
          <button className="refresh-btn" onClick={fetchOutstandingBalances}>
            🔄 Refresh Ledger
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading outstanding accounts...</p>
        ) : debtors.length === 0 ? (
          <div className="empty-state">
            <p>🎉 All customer balances and pre-orders are fully settled!</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Active Pre-Orders</th>
                  <th>Total Outstanding Dues</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {debtors.map((debtor) => (
                  <tr key={debtor.id}>
                    <td className="font-semibold">{debtor.name}</td>
                    <td>{debtor.phone}</td>
                    <td>
                      {debtor.preOrderCount > 0 ? (
                        <span className="preorder-badge">
                          ⏳ {debtor.preOrderCount} Pending Pre-Order{debtor.preOrderCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="subtext">—</span>
                      )}
                    </td>
                    <td className="due-amount">
                      ₹{debtor.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {debtor.preOrderCount > 0 && debtor.regularDue > 0 && (
                        <div className="due-breakdown">
                          (Pre-Orders: ₹{debtor.preOrders.reduce((s, p) => s + p.balanceDue, 0).toFixed(2)} | Direct Dues: ₹{debtor.regularDue.toFixed(2)})
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="action-group">
                        {debtor.preOrderCount > 0 && (
                          <button
                            className="view-po-btn"
                            onClick={() => setViewingPreOrders(debtor)}
                          >
                            📋 View Pre-Orders
                          </button>
                        )}
                        <button
                          className="collect-btn"
                          onClick={() => {
                            setSelectedCustomer(debtor);
                            setRepaymentAmount(debtor.totalDue);
                          }}
                        >
                          💵 Collect Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL: VIEW CUSTOMER PRE-ORDERS */}
        {viewingPreOrders && (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '560px' }}>
              <h3>Pre-Orders for {viewingPreOrders.name}</h3>
              <p className="subtext">
                Mobile: {viewingPreOrders.phone}
              </p>

              <div className="po-list">
                {viewingPreOrders.preOrders.map((po) => (
                  <div key={po.id} className="po-card">
                    <div className="po-header">
                      <strong>Order ID: #{po.id.slice(0, 8)}</strong>
                      <span className="po-date">{new Date(po.date).toLocaleDateString()}</span>
                    </div>
                    <div className="po-body">
                      <div>Total: <strong>₹{po.totalAmount.toFixed(2)}</strong></div>
                      <div>Advance Paid: <strong style={{ color: '#16a34a' }}>₹{po.paidAmount.toFixed(2)}</strong></div>
                      <div>Balance Due: <strong style={{ color: '#dc2626' }}>₹{po.balanceDue.toFixed(2)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button
                  className="cancel-btn"
                  onClick={() => setViewingPreOrders(null)}
                >
                  Close
                </button>
                <button
                  className="submit-btn"
                  onClick={() => {
                    setSelectedCustomer(viewingPreOrders);
                    setRepaymentAmount(viewingPreOrders.totalDue);
                    setViewingPreOrders(null);
                  }}
                >
                  💵 Settle Full Balance (₹{viewingPreOrders.totalDue.toFixed(2)})
                </button>
              </div>
            </div>
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
        .ledger-table td { padding: 14px 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; vertical-align: middle; }
        .font-semibold { font-weight: 600; }
        .due-amount { color: #dc2626; font-weight: 700; }
        .due-breakdown { font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px; }
        .subtext { font-size: 12px; color: #94a3b8; }
        
        .preorder-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid #fde68a; display: inline-block; }
        
        .action-group { display: flex; gap: 8px; align-items: center; }
        .view-po-btn { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
        .view-po-btn:hover { background: #e2e8f0; }
        .collect-btn { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; white-space: nowrap; }
        .collect-btn:hover { background: #15803d; }
        
        .empty-state { background: white; padding: 40px; text-align: center; border-radius: 8px; border: 1px solid #e2e8f0; color: #16a34a; font-weight: 600; }
        
        /* Modal Overlay */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal-card { background: white; padding: 24px; border-radius: 10px; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
        .modal-card h3 { margin-top: 0; margin-bottom: 6px; color: #0f172a; }
        .subtext { margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #64748b; }
        .form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 13px; font-weight: 600; color: #334155; }
        .form-group input, .form-group select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
        
        .po-list { display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; }
        .po-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
        .po-header { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; color: #0f172a; }
        .po-date { font-size: 11px; color: #64748b; }
        .po-body { display: flex; justify-content: space-between; font-size: 12px; color: #334155; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .cancel-btn { background: #e2e8f0; color: #475569; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; }
        .submit-btn { background: #2563eb; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
      `}</style>
    </div>
  );
}