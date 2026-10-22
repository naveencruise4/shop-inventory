'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function OrdersPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState({ id: null, name: 'My Shop' });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesmanFilter, setSalesmanFilter] = useState('all');

  // Print Receipt Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  // Collect Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    const { data: shops } = await supabase.from('shops').select('id, name').limit(1);
    if (shops?.[0]) {
      setShopInfo({ id: shops[0].id, name: shops[0].name });
    }

    // SAFE RELATIONAL FETCH WITH FALLBACKS
    const { data: salesData, error } = await supabase
      .from('sales')
      .select(`
        *,
        customers (
          name,
          phone
        ),
        salesman (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error.message);
    } else if (salesData) {
      setSales(salesData);
    }
    setLoading(false);
  };

  // Extract Salesmen Names dynamically for filter dropdown
  const uniqueSalesman = useMemo(() => {
    const list = sales.map(s => s.salesman?.name || s.salesman_name || 'Unassigned').filter(Boolean);
    return Array.from(new Set(list));
  }, [sales]);

  // Robust Filter Pipeline
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const createdAt = new Date(sale.created_at);
      const now = new Date();

      // 1. Search Query Filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesId = sale.id.toLowerCase().includes(q);
        const matchesCustomer = sale.customers?.name?.toLowerCase().includes(q);
        const matchesPhone = sale.customers?.phone?.includes(q);
        if (!matchesId && !matchesCustomer && !matchesPhone) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && sale.payment_status !== statusFilter) {
        return false;
      }

      // 3. Salesman Filter
      if (salesmanFilter !== 'all') {
        const rep = sale.salesman?.name || sale.salesman_name || 'Unassigned';
        if (rep !== salesmanFilter) return false;
      }

      // 4. Date Range Preset Filter
      if (dateRangePreset === 'today') {
        const isToday = createdAt.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (dateRangePreset === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        if (createdAt < sevenDaysAgo) return false;
      } else if (dateRangePreset === 'month') {
        const isSameMonth = createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
        if (!isSameMonth) return false;
      } else if (dateRangePreset === 'year') {
        const isSameYear = createdAt.getFullYear() === now.getFullYear();
        if (!isSameYear) return false;
      } else if (dateRangePreset === 'custom') {
        if (startDate && new Date(createdAt) < new Date(startDate)) return false;
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          if (createdAt > endDateTime) return false;
        }
      }

      return true;
    });
  }, [sales, searchQuery, dateRangePreset, startDate, endDate, statusFilter, salesmanFilter]);

  // Export Filtered Dataset to CSV
  const exportToExcel = () => {
    if (filteredSales.length === 0) {
      alert('No sales orders available to export.');
      return;
    }

    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Payment Status', 'Total Amount (INR)', 'Paid Amount (INR)', 'Pending Amount (INR)', 'Sales Rep'];

    const rows = filteredSales.map(s => {
      const total = Number(s.total_amount || 0);
      const paid = Number(s.paid_amount || 0);
      const pending = Math.max(0, total - paid);
      const dateStr = new Date(s.created_at).toLocaleString();
      const rep = s.salesman?.name || s.salesman_name || 'Unassigned';

      return [
        `"#${s.id.slice(0, 8)}"`,
        `"${dateStr}"`,
        `"${s.customers?.name || 'Walk-in Customer'}"`,
        `"${s.customers?.phone || ''}"`,
        `"${s.payment_status.toUpperCase()}"`,
        total.toFixed(2),
        paid.toFixed(2),
        pending.toFixed(2),
        `"${rep}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPaymentModal = (sale) => {
    const total = Number(sale.total_amount || 0);
    const paid = Number(sale.paid_amount || 0);
    const pending = Math.max(0, total - paid);

    setPaymentTarget({ ...sale, pending });
    setCollectAmount(pending.toString());
    setCollectMethod('cash');
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentTarget || !collectAmount) return;

    const amountToAdd = Number(collectAmount);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    if (amountToAdd > paymentTarget.pending) {
      alert(`Entered amount (₹${amountToAdd}) exceeds the pending balance (₹${paymentTarget.pending}).`);
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const newPaidTotal = Number(paymentTarget.paid_amount || 0) + amountToAdd;
      const totalAmount = Number(paymentTarget.total_amount || 0);
      const newStatus = newPaidTotal >= totalAmount ? 'paid' : 'partial';

      const { error: payErr } = await supabase.from('sale_payments').insert([{
        shop_id: shopInfo.id,
        sale_id: paymentTarget.id,
        amount: amountToAdd,
        payment_method: collectMethod
      }]);

      if (payErr) throw payErr;

      const { error: saleErr } = await supabase
        .from('sales')
        .update({
          paid_amount: newPaidTotal,
          payment_status: newStatus
        })
        .eq('id', paymentTarget.id);

      if (saleErr) throw saleErr;

      alert('Payment collected successfully!');
      setShowPaymentModal(false);
      setPaymentTarget(null);
      fetchInitialData();
    } catch (err) {
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const fetchOrderDetails = async (sale) => {
    setLoadingOrderDetails(true);

    try {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('sale_items')
        .select(`
          *,
          productsinfo (
            name,
            sku
          )
        `)
        .eq('sale_id', sale.id);

      if (itemsErr) throw itemsErr;

      const { data: paymentData } = await supabase
        .from('sale_payments')
        .select('payment_method')
        .eq('sale_id', sale.id)
        .limit(1);

      const paymentMethod = paymentData?.[0]?.payment_method || 'cash';

      let totalBase = 0;
      let totalGst = 0;

      const formattedItems = (itemsData || []).map(item => {
        const lineTotal = Number(item.unit_price || item.price || 0) * Number(item.quantity || 1);
        const pct = Number(item.gst_percentage || 0);
        const isTaxed = item.has_gst && pct > 0;

        const itemBase = item.base_price 
          ? Number(item.base_price) * item.quantity 
          : (isTaxed ? lineTotal / (1 + pct / 100) : lineTotal);

        const itemGst = item.gst_amount 
          ? Number(item.gst_amount) 
          : (isTaxed ? lineTotal - itemBase : 0);

        totalBase += itemBase;
        totalGst += itemGst;

        return {
          name: item.productsinfo?.name || item.sku || 'Item',
          sku: item.sku || item.productsinfo?.sku || '',
          quantity: item.quantity,
          price: item.unit_price || item.price,
          has_gst: item.has_gst,
          gst_percentage: pct
        };
      });

      const totalAmt = Number(sale.total_amount || 0);
      const paidAmt = Number(sale.paid_amount || sale.total_amount || 0);
      const pendingAmt = Math.max(0, totalAmt - paidAmt);

      setSelectedOrder({
        saleId: sale.id,
        shopName: shopInfo.name,
        date: new Date(sale.created_at).toLocaleString(),
        customer: sale.customers?.name || 'Walk-in Customer',
        customerPhone: sale.customers?.phone || '',
        items: formattedItems,
        totalAmount: totalAmt,
        paidAmount: paidAmt,
        pendingAmount: pendingAmt,
        paymentMethod,
        salesman: sale.salesman?.name || sale.salesman_name || 'Unassigned',
        totalBase,
        totalGst
      });

      setShowReceiptModal(true);
    } catch (err) {
      alert(`Error fetching order details: ${err.message}`);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const handlePrint = () => {
    const receiptElement = document.getElementById('printable-receipt');
    if (!receiptElement) return;

    document.getElementById('print-mount-root')?.remove();

    const printContainer = document.createElement('div');
    printContainer.id = 'print-mount-root';

    const receiptClone = receiptElement.cloneNode(true);
    receiptClone.removeAttribute('id');

    printContainer.appendChild(receiptClone);
    document.body.appendChild(printContainer);

    const cleanup = () => {
      printContainer.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    try {
      window.print();
    } catch (error) {
      cleanup();
      console.error('Unable to print receipt:', error);
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <h1>Sales Orders</h1>
          <button className="export-btn" onClick={exportToExcel}>
            📊 Export to Excel (.CSV)
          </button>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="card filter-card">
          <div className="filter-grid">
            <div className="filter-item">
              <label>Search Order / Customer</label>
              <input 
                type="text" 
                placeholder="Order ID, Name or Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-item">
              <label>Time Period</label>
              <select value={dateRangePreset} onChange={(e) => setDateRangePreset(e.target.value)}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week (Last 7 Days)</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {dateRangePreset === 'custom' && (
              <>
                <div className="filter-item">
                  <label>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="filter-item">
                  <label>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            <div className="filter-item">
              <label>Payment Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="paid">Fully Paid</option>
                <option value="partial">Partial Payment</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Sales Rep / Lead</label>
              <select value={salesmanFilter} onChange={(e) => setSalesmanFilter(e.target.value)}>
                <option value="all">All Staff</option>
                {uniqueSalesman.map((salesman, idx) => (
                  <option key={idx} value={salesman}>{salesman}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ORDERS TABLE */}
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Recent Orders ({filteredSales.length})</h3>
          </div>

          {loading ? (
            <p className="loading-text">Loading orders...</p>
          ) : filteredSales.length === 0 ? (
            <p className="empty-text">No orders match the selected filters.</p>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Sales Rep</th>
                  <th>Status</th>
                  <th>Payment Breakdown</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const total = Number(s.total_amount || 0);
                  const paid = Number(s.paid_amount || 0);
                  const pending = Math.max(0, total - paid);
                  const rep = s.salesman?.name || s.salesman_name || 'Unassigned';

                  return (
                    <tr key={s.id}>
                      <td><strong>#{s.id.slice(0, 8)}</strong></td>
                      <td>
                        {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>{s.customers ? `${s.customers.name}` : 'Walk-in Customer'}</td>
                      <td>
                        <span className="salesman-badge">
                          👤 {rep}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${s.payment_status}`}>
                          {s.payment_status}
                        </span>
                      </td>
                      <td>
                        <div className="payment-breakdown-cell">
                          <div><strong>Total:</strong> ₹{total.toFixed(2)}</div>
                          <div className="text-muted"><strong>Paid:</strong> ₹{paid.toFixed(2)}</div>
                          {pending > 0 && (
                            <div className="text-danger"><strong>Pending:</strong> ₹{pending.toFixed(2)}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {pending > 0 && (
                            <button 
                              className="collect-btn"
                              onClick={() => handleOpenPaymentModal(s)}
                            >
                              💳 Pay / Settle
                            </button>
                          )}
                          <button 
                            className="print-btn" 
                            onClick={() => fetchOrderDetails(s)}
                            disabled={loadingOrderDetails}
                          >
                            🖨️ Reprint Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal: Collect Pending Payment */}
        {showPaymentModal && paymentTarget && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add Payment for #{paymentTarget.id.slice(0, 8)}</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>
                Total: <strong>₹{paymentTarget.total_amount}</strong> | Paid: <strong>₹{paymentTarget.paid_amount}</strong>
              </p>
              
              <form onSubmit={handleRecordPayment}>
                <label>Amount to Collect (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  max={paymentTarget.pending} 
                  value={collectAmount} 
                  onChange={(e) => setCollectAmount(e.target.value)} 
                  required 
                />

                <label>Payment Method</label>
                <select value={collectMethod} onChange={(e) => setCollectMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>

                <div className="modal-actions">
                  <button type="submit" className="action-btn" disabled={isSubmittingPayment}>
                    {isSubmittingPayment ? 'Saving...' : 'Record Payment'}
                  </button>
                  <button type="button" className="cancel-btn" onClick={() => setShowPaymentModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal & Printable Receipt */}
        {showReceiptModal && selectedOrder && (
          <div className="modal-overlay receipt-modal-overlay">
            <div className="modal receipt-modal-container">
              <div className="receipt-actions no-print">
                <h3>Order Receipt Preview</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="primary-btn" onClick={handlePrint}>🖨️ Print Receipt (A5 Half Sheet)</button>
                  <button className="cancel-btn" onClick={() => setShowReceiptModal(false)}>Close</button>
                </div>
              </div>

              <div id="printable-receipt" className="receipt-box">
                <div className="receipt-header">
                  <h2>{selectedOrder.shopName}</h2>
                  <p className="receipt-subtitle">Estimate</p>
                  <div className="receipt-meta">
                    <div><strong>Date:</strong> {selectedOrder.date}</div>
                    <div><strong>Order ID:</strong> {selectedOrder.saleId?.slice(0, 8)}</div>
                  </div>
                  <div className="receipt-meta">
                    <div><strong>Customer:</strong> {selectedOrder.customer} {selectedOrder.customerPhone ? `(${selectedOrder.customerPhone})` : ''}</div>
                    <div><strong>Payment:</strong> {selectedOrder.paymentMethod.toUpperCase()}</div>
                  </div>
                  <div className="receipt-meta" style={{ marginTop: '2px', fontSize: '11px', color: '#64748b' }}>
                    <div><strong>Sales Lead:</strong> {selectedOrder.salesman}</div>
                  </div>
                </div>

                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Description</th>
                      <th>Qty</th>
                      <th>Rate (₹)</th>
                      <th>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          {it.name}
                          {it.has_gst && it.gst_percentage > 0 && (
                            <span className="receipt-subtext"> (Incl. {it.gst_percentage}% GST)</span>
                          )}
                        </td>
                        <td>{it.quantity}</td>
                        <td>₹{Number(it.price).toFixed(2)}</td>
                        <td>₹{(it.quantity * it.price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="receipt-summary-block">
                  {selectedOrder.totalGst > 0 && (
                    <div className="receipt-row">
                      <span>Taxable Amount (Base):</span>
                      <span>₹{selectedOrder.totalBase.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.totalGst > 0 && (
                    <div className="receipt-row">
                      <span>Total GST Extracted:</span>
                      <span>₹{selectedOrder.totalGst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="receipt-row grand-total-row">
                    <span>Grand Total:</span>
                    <span>₹{selectedOrder.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Amount Paid:</span>
                    <span>₹{selectedOrder.paidAmount.toFixed(2)}</span>
                  </div>
                  {selectedOrder.pendingAmount > 0 && (
                    <div className="receipt-row pending-row" style={{ color: '#b91c1c', fontWeight: 'bold' }}>
                      <span>Balance Due / Pending:</span>
                      <span>₹{selectedOrder.pendingAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="receipt-footer">
                  <p>Thank you for shopping with us!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        
        .export-btn { background: #0284c7; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.15s; }
        .export-btn:hover { background: #0369a1; }

        .filter-card { background: #ffffff; margin-bottom: 16px; }
        .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .filter-item { display: flex; flex-direction: column; gap: 4px; }
        .filter-item label { font-size: 12px; font-weight: 600; color: #475569; }
        .filter-item input, .filter-item select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }

        .loading-text, .empty-text { text-align: center; color: #64748b; padding: 40px 0; }
        .orders-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
        .orders-table th { background: #f1f5f9; padding: 10px 12px; text-align: left; color: #475569; font-weight: 600; }
        .orders-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        
        .status-badge { text-transform: capitalize; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        .status-badge.paid { background: #dcfce7; color: #15803d; }
        .status-badge.partial { background: #fef9c3; color: #a16207; }
        .status-badge.pending { background: #fee2e2; color: #b91c1c; }

        .salesman-badge { font-size: 12px; color: #334155; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 500; }

        .payment-breakdown-cell { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
        .text-muted { color: #16a34a; }
        .text-danger { color: #dc2626; font-weight: 600; }

        .collect-btn { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.15s; }
        .collect-btn:hover { background: #15803d; }
        .print-btn { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.15s; }
        .print-btn:hover { background: #e2e8f0; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .modal { background: white; padding: 24px; border-radius: 8px; width: 380px; display: flex; flex-direction: column; gap: 10px; }
        .modal input, .modal select { padding: 10px; margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
        .modal label { font-size: 12px; color: #475569; font-weight: 500; }
        .modal-actions { display: flex; gap: 10px; margin-top: 10px; }
        .action-btn { flex: 1; padding: 10px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .primary-btn { padding: 10px 16px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .cancel-btn { padding: 10px 16px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; }

        .receipt-modal-container { width: 550px; max-height: 90vh; overflow-y: auto; }
        .receipt-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
        .receipt-box { background: #fff; padding: 20px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: sans-serif; }
        .receipt-header { text-align: center; border-bottom: 1px dashed #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
        .receipt-header h2 { margin: 0 0 4px 0; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        .receipt-subtitle { margin: 0 0 10px 0; font-size: 12px; color: #64748b; }
        .receipt-meta { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; color: #334155; }
        .receipt-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        .receipt-table th { border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 6px 4px; text-align: left; }
        .receipt-table td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; }
        .receipt-subtext { font-size: 10px; color: #64748b; }
        .receipt-summary-block { border-top: 1px dashed #0f172a; padding-top: 8px; margin-top: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
        .receipt-row { display: flex; justify-content: space-between; }
        .grand-total-row { font-size: 14px; font-weight: bold; border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 4px 0; margin: 4px 0; }
        .receipt-footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
      `}</style>

      <style jsx global>{`
        #print-mount-root {
          display: none !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0; /* Remove browser default headers/footers */
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          /* Hide background Web App UI */
          body > *:not(#print-mount-root) {
            display: none !important;
          }

          /* Mount root container constrained to top-half A5 dimensions */
          body > #print-mount-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 148mm !important; /* Exactly half of A4 portrait height */
            margin: 0 !important;
            padding: 8mm !important; /* Inner receipt padding */
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #fff !important;
            color: #000 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          #print-mount-root,
          #print-mount-root * {
            box-sizing: border-box !important;
          }

          #print-mount-root .receipt-box {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 132mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            font-family: Arial, sans-serif !important;
            color: #000 !important;
            background: #fff !important;
          }

          #print-mount-root .no-print {
            display: none !important;
          }

          #print-mount-root .receipt-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          #print-mount-root .receipt-table thead {
            display: table-header-group;
          }

          #print-mount-root .receipt-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #print-mount-root .receipt-header,
          #print-mount-root .receipt-summary-block,
          #print-mount-root .receipt-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}