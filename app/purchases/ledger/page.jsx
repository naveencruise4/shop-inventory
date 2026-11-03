'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function SupplierLedgerPage() {
  const [shopInfo, setShopInfo] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierBills, setSupplierBills] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [loading, setLoading] = useState(false);

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
        fetchSuppliers(shop.id);
      }
    }
  };

  const fetchSuppliers = async (shopId) => {
    const { data } = await supabase.from('suppliers').select('*').eq('shop_id', shopId).order('name');
    if (data && data.length > 0) {
      setSuppliers(data);
      setSelectedSupplier(data[0]);
      fetchSupplierDetails(data[0].id, shopId);
    }
  };

  const fetchSupplierDetails = async (supplierId, shopId) => {
    setLoading(true);
    const sid = shopId || shopInfo?.id;

    const { data: bills } = await supabase
      .from('purchase_bills')
      .select('*')
      .eq('shop_id', sid)
      .eq('supplier_id', supplierId)
      .order('purchase_date', { ascending: false });

    const { data: payments } = await supabase
      .from('purchase_payments')
      .select('*')
      .eq('shop_id', sid)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    setSupplierBills(bills || []);
    setSupplierPayments(payments || []);
    setLoading(false);
  };

  const totalPurchases = supplierBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const totalPaid = supplierBills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
  const totalDue = Math.max(0, totalPurchases - totalPaid);

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <div>
            <h1>Supplier Accounts & Ledger</h1>
            <p className="subtext">Track vendor payables, bill-wise dues, and payment audit logs</p>
          </div>
        </div>

        <div className="ledger-layout">
          {/* Left: Supplier Directory */}
          <div className="card supplier-list-card">
            <h3>Suppliers Directory</h3>
            <div className="supplier-scroll">
              {suppliers.map(s => (
                <div
                  key={s.id}
                  className={`supplier-item ${selectedSupplier?.id === s.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSupplier(s);
                    fetchSupplierDetails(s.id);
                  }}
                >
                  <strong>{s.name}</strong>
                  <span className="subtext">{s.phone || s.gstin || 'No contact'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Supplier Details & Bills */}
          <div className="card ledger-details-card">
            {selectedSupplier ? (
              <>
                <div className="supplier-header-info">
                  <div>
                    <h2>{selectedSupplier.name}</h2>
                    <p className="subtext">GSTIN: {selectedSupplier.gstin || 'N/A'} | Phone: {selectedSupplier.phone || 'N/A'}</p>
                  </div>
                  <div className="supplier-metrics-mini">
                    <div><span>Total Purchases:</span> <strong>₹{totalPurchases.toFixed(2)}</strong></div>
                    <div><span>Total Paid:</span> <strong className="text-green">₹{totalPaid.toFixed(2)}</strong></div>
                    <div><span>Outstanding Due:</span> <strong className="text-red">₹{totalDue.toFixed(2)}</strong></div>
                  </div>
                </div>

                <h3>Pending & Posted Bills</h3>
                <div className="table-scroll-area">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Total (₹)</th>
                        <th>Paid (₹)</th>
                        <th>Balance Due (₹)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierBills.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No bills found for this supplier.</td></tr>
                      ) : (
                        supplierBills.map(b => {
                          const due = Math.max(0, Number(b.total_amount) - Number(b.paid_amount));
                          return (
                            <tr key={b.id}>
                              <td><strong>{b.invoice_number}</strong></td>
                              <td>{b.purchase_date}</td>
                              <td><span className={`invoice-badge ${b.invoice_type}`}>{b.invoice_type.toUpperCase()}</span></td>
                              <td>₹{Number(b.total_amount).toFixed(2)}</td>
                              <td style={{ color: '#16a34a' }}>₹{Number(b.paid_amount).toFixed(2)}</td>
                              <td style={{ color: due > 0 ? '#dc2626' : '#15803d', fontWeight: 'bold' }}>₹{due.toFixed(2)}</td>
                              <td><span className={`status-badge payment-${b.payment_status}`}>{b.payment_status}</span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 style={{ marginTop: '20px' }}>Payment & Transaction History</h3>
                <div className="table-scroll-area">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Type</th>
                        <th>Amount (₹)</th>
                        <th>Reference #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierPayments.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No payments recorded for this supplier.</td></tr>
                      ) : (
                        supplierPayments.map(p => (
                          <tr key={p.id}>
                            <td>{new Date(p.created_at).toLocaleDateString()}</td>
                            <td style={{ textTransform: 'uppercase' }}>{p.payment_method}</td>
                            <td><span className="invoice-badge gst">{p.transaction_type}</span></td>
                            <td style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{Number(p.amount).toFixed(2)}</td>
                            <td>{p.reference_number || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="loading-text">Select a supplier from the list.</p>
            )}
          </div>
        </div>

      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .top-bar { margin-bottom: 16px; flex-shrink: 0; }
        .top-bar h1 { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
        .subtext { font-size: 13px; color: #64748b; }
        .ledger-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; flex: 1; overflow: hidden; min-height: 0; }
        .supplier-list-card { display: flex; flex-direction: column; overflow: hidden; }
        .supplier-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
        .supplier-item { padding: 10px 12px; border-radius: 6px; cursor: pointer; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 2px; }
        .supplier-item:hover { background: #f1f5f9; }
        .supplier-item.active { background: #0f172a; color: white; border-color: #0f172a; }
        .supplier-item.active .subtext { color: #cbd5e1; }
        .ledger-details-card { display: flex; flex-direction: column; overflow-y: auto; }
        .supplier-header-info { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
        .supplier-metrics-mini { display: flex; gap: 16px; font-size: 13px; }
        .text-green { color: #16a34a; }
        .text-red { color: #dc2626; }
        .orders-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
        .orders-table th { background: #f1f5f9; color: #475569; padding: 10px 12px; font-weight: 600; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; }
        .orders-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        .invoice-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .invoice-badge.gst { background: #e0f2fe; color: #0369a1; }
        .invoice-badge.estimate { background: #fef3c7; color: #92400e; }
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: capitalize; }
        .status-badge.payment-paid { background: #dcfce7; color: #15803d; }
        .status-badge.payment-partial { background: #fef9c3; color: #a16207; }
        .status-badge.payment-pending { background: #fee2e2; color: #b91c1c; }
        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
      `}</style>
    </div>
  );
}