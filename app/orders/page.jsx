'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function SalesOrdersPage() {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activePaymentModal, setActivePaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', method: 'Cash' });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, sale_items(*), customers(name)')
      .order('created_at', { ascending: false });
    if (data) setSales(data);
  };

  const handleStatusChange = async (saleId, newStatus) => {
    await supabase.from('sales').update({ sale_status: newStatus }).eq('id', saleId);
    fetchSales();
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentModal) return;

    const addAmt = Number(paymentInput.amount);
    const newTotalPaid = Number(activePaymentModal.advance_paid || 0) + addAmt;
    const totalAmount = Number(activePaymentModal.total_amount);

    let newPayStatus = 'Partially Paid';
    if (newTotalPaid >= totalAmount) {
      newPayStatus = 'Paid';
    }

    const { data: userData } = await supabase.from('users').select('shop_id').single();

    // 1. Log Payment
    await supabase.from('sale_payments').insert([{
      shop_id: userData?.shop_id,
      sale_id: activePaymentModal.id,
      amount: addAmt,
      payment_method: paymentInput.method
    }]);

    // 2. Update Sale
    await supabase.from('sales').update({
      advance_paid: newTotalPaid,
      payment_status: newPayStatus,
      payment_method: paymentInput.method
    }).eq('id', activePaymentModal.id);

    setActivePaymentModal(null);
    setPaymentInput({ amount: '', method: 'Cash' });
    fetchSales();
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.sale_items?.some(item => item.sku?.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || (s.sale_status || 'Pending') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <h1>Sales & Fulfillments</h1>

        <div className="filter-bar">
          <input placeholder="Search by Order ID, Customer, or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
          <div className="status-buttons">
            {['All', 'Pending', 'Confirmed', 'Delivered', 'Cancelled'].map(st => (
              <button key={st} className={`filter-btn ${statusFilter === st ? 'active' : ''}`} onClick={() => setStatusFilter(st)}>
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Sale ID / Date</th>
                <th>Customer / Items</th>
                <th>Total / Paid</th>
                <th>Payment Status</th>
                <th>Order Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(s => (
                <tr key={s.id}>
                  <td>
                    <strong>#{s.id.slice(0, 8)}</strong>
                    <div className="subtext">{new Date(s.created_at).toLocaleDateString()}</div>
                  </td>
                  <td>
                    <div><strong>{s.customers?.name || 'Walk-in Customer'}</strong></div>
                    {s.sale_items?.map(i => (
                      <div key={i.id} className="subtext">• SKU: {i.sku || 'N/A'} (x{i.quantity})</div>
                    ))}
                  </td>
                  <td>
                    <div><strong>₹{s.total_amount}</strong></div>
                    <div className="subtext" style={{ color: '#16a34a' }}>Paid: ₹{s.advance_paid || 0}</div>
                  </td>
                  <td>
                    <span className={`tag ${s.payment_status?.toLowerCase().replace(' ', '-')}`}>
                      {s.payment_status || 'Partially Paid'}
                    </span>
                  </td>
                  <td>
                    <select value={s.sale_status || 'Pending'} onChange={(e) => handleStatusChange(s.id, e.target.value)} className="status-select">
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    {s.payment_status !== 'Paid' && (
                      <button className="pay-btn" onClick={() => { setActivePaymentModal(s); setPaymentInput({ amount: (s.total_amount - (s.advance_paid || 0)).toFixed(2), method: 'Cash' }); }}>
                        + Add Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activePaymentModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Record Payment for Sale #{activePaymentModal.id.slice(0, 8)}</h3>
              <p>Total: ₹{activePaymentModal.total_amount} | Already Paid: ₹{activePaymentModal.advance_paid || 0}</p>
              <form onSubmit={handleAddPayment}>
                <input type="number" step="0.01" placeholder="Amount Received" value={paymentInput.amount} onChange={(e) => setPaymentInput({ ...paymentInput, amount: e.target.value })} required />
                <select value={paymentInput.method} onChange={(e) => setPaymentInput({ ...paymentInput, method: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
                <div className="modal-actions">
                  <button type="submit" className="submit-btn">Save Payment</button>
                  <button type="button" className="cancel-btn" onClick={() => setActivePaymentModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .filter-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; justify-content: space-between; }
        .search-input { flex: 1; min-width: 240px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
        .status-buttons { display: flex; gap: 6px; }
        .filter-btn { padding: 8px 12px; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; cursor: pointer; }
        .filter-btn.active { background: #0f172a; color: white; border-color: #0f172a; }
        .table-wrapper { overflow-x: auto; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; min-width: 700px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f8fafc; }
        .subtext { font-size: 12px; color: #64748b; }
        .status-select { padding: 6px; border-radius: 4px; border: 1px solid #cbd5e1; }
        .pay-btn { background: #16a34a; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .tag { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        .tag.paid { background: #dcfce7; color: #15803d; }
        .tag.partially-paid { background: #fef9c3; color: #a16207; }
        .tag.unpaid { background: #fee2e2; color: #b91c1c; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; }
        .modal { background: white; padding: 24px; border-radius: 8px; width: 360px; display: flex; flex-direction: column; gap: 12px; }
        .modal input, .modal select { width: 100%; padding: 10px; margin-bottom: 10px; box-sizing: border-box; }
        .modal-actions { display: flex; gap: 10px; }
        :global(.submit-btn) { flex: 1; padding: 10px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .cancel-btn { flex: 1; padding: 10px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; }
      `}</style>
    </div>
  );
}