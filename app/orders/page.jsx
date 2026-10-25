'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import PrintableReceiptModal from '@/components/PrintableReceiptModal';
import { supabase } from '@/lib/supabaseClient';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [shopInfo, setShopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Summary Totals State
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalPaid: 0,
    totalPending: 0
  });

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Default Date Range: Start of current month to Today
  const getInitialDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatDate = (date) => {
      const d = new Date(date);
      let month = '' + (d.getMonth() + 1);
      let day = '' + d.getDate();
      const year = d.getFullYear();
      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;
      return [year, month, day].join('-');
    };

    return { start: formatDate(firstDay), end: formatDate(today) };
  };

  // UI Input State (Typing values)
  const [colFilters, setColFilters] = useState({
    orderId: '',
    customer: '',
    salesRep: '',
    type: '',
    status: ''
  });
  const [dateRange, setDateRange] = useState(getInitialDates());

  // Applied Query State (Updated ONLY on Enter key or dropdown selection)
  const [appliedFilters, setAppliedFilters] = useState(colFilters);
  const [appliedDates, setAppliedDates] = useState(dateRange);

  // Active open filter dropdown state
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const filterDropdownRef = useRef(null);

  // Print Receipt Modal State
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setActiveFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    initOrdersPage();
  }, []);

  const initOrdersPage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
    
    if (appUser?.shop_id) {
      const { data: shop } = await supabase.from('shops').select('id, name').eq('id', appUser.shop_id).single();
      if (shop) setShopInfo(shop);
    }
  };

  const getQueryDates = (range) => {
    let startQ = null;
    let endQ = null;
    if (range.start) {
      const start = new Date(range.start);
      start.setHours(0, 0, 0, 0);
      startQ = start.toISOString();
    }
    if (range.end) {
      const end = new Date(range.end);
      end.setHours(23, 59, 59, 999);
      endQ = end.toISOString();
    }
    return { start: startQ, end: endQ };
  };

  // 1. Fetch Main Orders Data with Robust Filtering
  const fetchOrders = useCallback(async () => {
    if (!shopInfo?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales')
        .select(`
          *,
          customers(name, phone),
          salesman(id, name),
          sale_items(*)
        `, { count: 'exact' })
        .eq('shop_id', shopInfo.id);

      // Safe Order ID filter using id::text casting
      if (appliedFilters.orderId) {
        const idQuery = appliedFilters.orderId.trim().replace(/^#/, '');
        query = query.filter('id::text', 'ilike', `${idQuery}%`);
      }
      
      // Customer search (name or phone)
      if (appliedFilters.customer) {
        const cVal = appliedFilters.customer.trim();
        query = query.or(`name.ilike.%${cVal}%,phone.ilike.%${cVal}%`, { foreignTable: 'customers' });
      }
      
      // Sales Rep filter
      if (appliedFilters.salesRep) {
        query = query.ilike('salesman.name', `%${appliedFilters.salesRep.trim()}%`);
      }
      
      const { start, end } = getQueryDates(appliedDates);
      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      if (appliedFilters.type) {
        query = query.eq('invoice_type', appliedFilters.type);
      }
      
      if (appliedFilters.status) {
        const s = appliedFilters.status.toLowerCase();
        if (s === 'pre_order') query = query.eq('sale_status', 'pre_order');
        else if (s === 'paid') query = query.eq('payment_status', 'paid').neq('sale_status', 'pre_order');
        else if (s === 'partial') query = query.eq('payment_status', 'partial');
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('Query Error:', error);
        setOrders([]);
        setTotalCount(0);
        return;
      }
      
      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching orders:', err.message);
    } finally {
      setLoading(false);
    }
  }, [shopInfo?.id, appliedFilters, appliedDates, currentPage, pageSize]);

  // 2. Fetch Dynamic Totals via RPC
  const fetchSummary = useCallback(async () => {
    if (!shopInfo?.id) return;

    try {
      const { start, end } = getQueryDates(appliedDates);
      const cleanOrderId = appliedFilters.orderId ? appliedFilters.orderId.trim().replace(/^#/, '') : null;

      const { data, error } = await supabase.rpc('get_orders_summary', {
        p_shop_id: shopInfo.id,
        p_order_id: cleanOrderId,
        p_customer: appliedFilters.customer || null,
        p_salesman: appliedFilters.salesRep || null,
        p_type: appliedFilters.type || null,
        p_status: appliedFilters.status || null,
        p_start_date: start,
        p_end_date: end
      });

      if (error) throw error;
      if (data) {
        setSummary({
          totalAmount: Number(data.total_amount || 0),
          totalPaid: Number(data.total_paid || 0),
          totalPending: Number(data.total_pending || 0)
        });
      }
    } catch (err) {
      console.error('Error fetching summary:', err.message);
    }
  }, [shopInfo?.id, appliedFilters, appliedDates]);

  useEffect(() => {
    fetchOrders();
    fetchSummary();
  }, [fetchOrders, fetchSummary]);

  const handleFilterChange = (col, value) => {
    setColFilters(prev => ({ ...prev, [col]: value }));
  };

  const handleKeyDown = (e, colKey) => {
    if (e.key === 'Enter') {
      setAppliedFilters({ ...colFilters });
      setCurrentPage(1);
      setActiveFilterCol(null);
    }
  };

  const handleSelectChange = (col, value) => {
    const updated = { ...colFilters, [col]: value };
    setColFilters(updated);
    setAppliedFilters(updated);
    setCurrentPage(1);
    setActiveFilterCol(null);
  };

  const handleDateApply = () => {
    setAppliedDates({ ...dateRange });
    setCurrentPage(1);
    setActiveFilterCol(null);
  };

  const resetToThisMonth = () => {
    const empty = { orderId: '', customer: '', salesRep: '', type: '', status: '' };
    setColFilters(empty);
    setDateRange(getInitialDates());
    setAppliedFilters(empty);
    setAppliedDates(getInitialDates());
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    Object.values(appliedFilters).some(val => val !== '') || 
    appliedDates.start !== getInitialDates().start || 
    appliedDates.end !== getInitialDates().end;

  const handleExportCSV = () => {
    if (orders.length === 0) return alert('No data to export.');

    const headers = ['Order ID', 'Date', 'Customer', 'Sales Rep', 'Type', 'Status', 'Total Amount', 'Paid Amount', 'Pending Amount'];
    const escapeCSV = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = orders.map(o => {
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || total);
      const pending = Math.max(0, total - paid);
      
      return [
        escapeCSV(`#${o.id.slice(0, 8)}`),
        escapeCSV(new Date(o.created_at).toLocaleString()),
        escapeCSV(o.customers?.name || 'Walk-in Customer'),
        escapeCSV(o.salesman?.name || 'Unassigned'),
        escapeCSV(o.invoice_type === 'gst' ? 'GST' : 'Estimate'),
        escapeCSV(o.sale_status === 'pre_order' ? 'Pre-Order' : (o.payment_status || 'paid')),
        escapeCSV(total.toFixed(2)),
        escapeCSV(paid.toFixed(2)),
        escapeCSV(pending.toFixed(2))
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Orders_Page${currentPage}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReprint = (order) => {
    const isGst = order.invoice_type === 'gst';
    let totalBase = 0; let totalGst = 0;

    order.sale_items?.forEach(item => {
      const lineTotal = item.unit_price * item.quantity;
      const pct = Number(item.gst_percentage || 0);
      if (item.has_gst && pct > 0) {
        const base = lineTotal / (1 + pct / 100);
        totalBase += base;
        totalGst += lineTotal - base;
      } else {
        totalBase += lineTotal;
      }
    });

    const formattedOrder = {
      saleId: order.id,
      shopName: shopInfo?.name || 'My Shop',
      date: new Date(order.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customer: order.customers?.name || 'Walk-in Customer',
      customerPhone: order.customers?.phone || '',
      salesmanName: order.salesman?.name || 'Unassigned',
      items: order.sale_items || [],
      totalAmount: Number(order.total_amount),
      paidAmount: Number(order.paid_amount || order.total_amount),
      paymentMethod: order.payment_method || 'cash',
      totalBase, totalGst, isGstInvoice: isGst, saleStatus: order.sale_status
    };

    if (isGst) setSelectedOrderForPrint({ gst: formattedOrder, estimate: null });
    else setSelectedOrderForPrint({ gst: null, estimate: formattedOrder });
    
    setShowReceiptModal(true);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const renderFilterMenu = (colKey, placeholder, type = 'text', options = []) => {
    if (activeFilterCol !== colKey) return null;
    
    if (colKey === 'date') {
      return (
        <div className="filter-dropdown" ref={filterDropdownRef} onClick={(e) => e.stopPropagation()}>
          <div className="date-range-inputs">
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>From</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="filter-input" />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>To</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="filter-input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <button className="apply-filter-btn" onClick={handleDateApply} style={{ flex: 1, background: '#0f172a', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Apply</button>
            <button className="clear-filter-btn" onClick={() => { setDateRange({ start: '', end: '' }); setAppliedDates({ start: '', end: '' }); setActiveFilterCol(null); }} style={{ flex: 1 }}>Clear Dates</button>
          </div>
        </div>
      );
    }

    const currentVal = colFilters[colKey];
    return (
      <div className="filter-dropdown" ref={filterDropdownRef} onClick={(e) => e.stopPropagation()}>
        {type === 'text' ? (
          <div>
            <input 
              type="text" 
              placeholder={placeholder} 
              value={currentVal} 
              onChange={(e) => handleFilterChange(colKey, e.target.value)} 
              onKeyDown={(e) => handleKeyDown(e, colKey)}
              autoFocus 
              className="filter-input" 
            />
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Press Enter to search</div>
          </div>
        ) : (
          <select value={currentVal} onChange={(e) => handleSelectChange(colKey, e.target.value)} className="filter-input">
            <option value="">All</option>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
        {currentVal && <button className="clear-filter-btn" onClick={() => handleSelectChange(colKey, '')} style={{ marginTop: '6px' }}>Clear Filter</button>}
      </div>
    );
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        
        <div className="sticky-top-container">
          <div className="top-bar">
            <div>
              <h1>Sales Orders Search & Manage</h1>
              <p className="subtext" style={{ marginTop: '2px' }}>Showing records matching your filters (Press Enter in boxes to filter)</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {hasActiveFilters && (
                <button className="secondary-btn" onClick={resetToThisMonth}>↺ Reset to This Month</button>
              )}
              <button className="export-btn" onClick={handleExportCSV}>📊 Export Page</button>
            </div>
          </div>

          {/* DYNAMIC SUMMARY CARDS */}
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Total Orders</span>
              <span className="summary-value">{totalCount}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Gross Amount</span>
              <span className="summary-value">₹{summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="summary-card success">
              <span className="summary-label">Total Collected</span>
              <span className="summary-value">₹{summary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="summary-card danger">
              <span className="summary-label">Total Pending Dues</span>
              <span className="summary-value">₹{summary.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="table-wrapper card">
          {loading && orders.length === 0 ? (
            <p className="loading-text">Loading order records...</p>
          ) : orders.length === 0 ? (
            <p className="empty-text">No orders match the selected criteria.</p>
          ) : (
            <>
              <div className="table-scroll-area">
                <table className="orders-table">
                  <thead>
                    <tr className="header-titles-row">
                      <th>
                        <div className="th-content">
                          Order ID
                          <button className={`filter-icon-btn ${appliedFilters.orderId ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'orderId' ? null : 'orderId')}>▼</button>
                        </div>
                        {renderFilterMenu('orderId', 'Search ID & Enter...', 'text')}
                      </th>
                      <th>
                        <div className="th-content">
                          Date
                          <button className={`filter-icon-btn ${(appliedDates.start || appliedDates.end) ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'date' ? null : 'date')}>▼</button>
                        </div>
                        {renderFilterMenu('date')}
                      </th>
                      <th>
                        <div className="th-content">
                          Customer
                          <button className={`filter-icon-btn ${appliedFilters.customer ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'customer' ? null : 'customer')}>▼</button>
                        </div>
                        {renderFilterMenu('customer', 'Search name/phone & Enter...', 'text')}
                      </th>
                      <th>
                        <div className="th-content">
                          Sales Rep
                          <button className={`filter-icon-btn ${appliedFilters.salesRep ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'salesRep' ? null : 'salesRep')}>▼</button>
                        </div>
                        {renderFilterMenu('salesRep', 'Search rep name & Enter...', 'text')}
                      </th>
                      <th>
                        <div className="th-content">
                          Type
                          <button className={`filter-icon-btn ${appliedFilters.type ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'type' ? null : 'type')}>▼</button>
                        </div>
                        {renderFilterMenu('type', '', 'select', [{label: 'GST', value: 'gst'}, {label: 'Estimate', value: 'estimate'}])}
                      </th>
                      <th>
                        <div className="th-content">
                          Status
                          <button className={`filter-icon-btn ${appliedFilters.status ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'status' ? null : 'status')}>▼</button>
                        </div>
                        {renderFilterMenu('status', '', 'select', [{label: 'Pre-Order', value: 'pre_order'}, {label: 'Paid', value: 'paid'}, {label: 'Partial', value: 'partial'}])}
                      </th>
                      <th>Payment Breakdown</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const total = Number(order.total_amount || 0);
                      const paid = Number(order.paid_amount || total);
                      const pending = Math.max(0, total - paid);
                      const repName = order.salesman?.name || 'Unassigned';
                      const isPreOrder = order.sale_status === 'pre_order';
                      const pStatus = order.payment_status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending');

                      return (
                        <tr key={order.id}>
                          <td><strong>#{order.id.slice(0, 8)}</strong></td>
                          <td className="date-cell">
                            {new Date(order.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')}
                          </td>
                          <td><strong>{order.customers?.name || 'Walk-in Customer'}</strong></td>
                          <td><span className="salesman-tag">👤 {repName}</span></td>
                          <td><span className={`invoice-badge ${order.invoice_type === 'gst' ? 'gst' : 'estimate'}`}>{order.invoice_type === 'gst' ? 'GST' : 'Estimate'}</span></td>
                          <td>
                            <div className="status-container">
                              {isPreOrder && <span className="pre-order-tag">⏳ Pre-Order</span>}
                              <span className={`status-badge ${pStatus}`}>{pStatus.charAt(0).toUpperCase() + pStatus.slice(1)}</span>
                            </div>
                          </td>
                          <td className="breakdown-cell">
                            <div><span>Total: </span><strong>₹{total.toFixed(2)}</strong></div>
                            <div className="paid-line"><span>Paid: </span><strong>₹{paid.toFixed(2)}</strong></div>
                            {pending > 0 && <div className="pending-line"><span>Pending: </span><strong>₹{pending.toFixed(2)}</strong></div>}
                          </td>
                          <td>
                            <button className="reprint-btn" onClick={() => handleReprint(order)}>🖨️ Reprint</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <div className="pagination-info">
                  <span>Show:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="page-size-select">
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  <span>Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> - <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong></span>
                </div>
                <div className="pagination-controls">
                  <button disabled={currentPage === 1 || loading} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} className="page-btn">◀ Previous</button>
                  <span className="page-indicator">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
                  <button disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} className="page-btn">Next ▶</button>
                </div>
              </div>
            </>
          )}
        </div>

        <PrintableReceiptModal
          show={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          completedGstOrder={selectedOrderForPrint?.gst}
          completedEstimateOrder={selectedOrderForPrint?.estimate}
        />
      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        @media (max-width: 768px) { .content { padding: 16px; padding-bottom: 90px; } }

        .sticky-top-container { flex-shrink: 0; margin-bottom: 16px; }
        .top-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
        .top-bar h1 { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
        .subtext { font-size: 13px; color: #64748b; }
        
        .export-btn { background: #0284c7; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .export-btn:hover { background: #0369a1; }
        .secondary-btn { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; }
        .secondary-btn:hover { background: #f1f5f9; }

        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .summary-card { background: white; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; }
        .summary-card.success { border-left: 4px solid #16a34a; }
        .summary-card.danger { border-left: 4px solid #dc2626; }
        .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #64748b; }
        .summary-value { font-size: 20px; font-weight: 700; color: #0f172a; }
        .summary-card.success .summary-value { color: #16a34a; }
        .summary-card.danger .summary-value { color: #dc2626; }

        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
        .table-scroll-area { flex: 1; overflow: auto; }
        .loading-text, .empty-text { text-align: center; color: #64748b; padding: 40px 0; flex: 1; display: flex; align-items: center; justify-content: center; }

        .orders-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
        .orders-table th { background: #f1f5f9; color: #475569; padding: 12px 14px; font-weight: 600; white-space: nowrap; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; position: relative; }
        .orders-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .orders-table tbody tr:hover { background: #f8fafc; }
        
        .date-cell { color: #334155; white-space: nowrap; }
        .salesman-tag { background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
        .invoice-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }
        .invoice-badge.gst { background: #e0f2fe; color: #0369a1; }
        .invoice-badge.estimate { background: #fef3c7; color: #92400e; }
        .status-container { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
        .pre-order-tag { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid #fde68a; }
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: capitalize; display: inline-block; }
        .status-badge.paid { background: #dcfce7; color: #15803d; }
        .status-badge.partial { background: #fef9c3; color: #a16207; }
        .status-badge.pending { background: #fee2e2; color: #b91c1c; }
        .breakdown-cell { font-size: 12px; color: #334155; }
        .paid-line { color: #16a34a; margin-top: 2px; }
        .pending-line { color: #b91c1c; margin-top: 2px; }
        .reprint-btn { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s ease; }
        .reprint-btn:hover { background: #e2e8f0; border-color: #94a3b8; }

        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-top: 1px solid #e2e8f0; background: #fff; font-size: 13px; flex-wrap: wrap; gap: 10px; flex-shrink: 0; }
        .pagination-info { display: flex; align-items: center; gap: 10px; color: #475569; }
        .page-size-select { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; }
        .pagination-controls { display: flex; align-items: center; gap: 12px; }
        .page-btn { padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 12px; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-indicator { color: #475569; }

        .th-content { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .filter-icon-btn { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 10px; padding: 4px; border-radius: 4px; transition: all 0.2s; }
        .filter-icon-btn:hover { background: #e2e8f0; color: #0f172a; }
        .filter-icon-btn.active { color: #0284c7; background: #e0f2fe; }
        .filter-dropdown { position: absolute; top: 100%; left: 0; background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 50; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
        .filter-input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
        .filter-input:focus { outline: none; border-color: #0f172a; }
        .date-range-inputs { display: flex; flex-direction: column; gap: 8px; }
        .clear-filter-btn { background: #fee2e2; color: #b91c1c; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; width: 100%; }
        .clear-filter-btn:hover { background: #fecaca; }
      `}</style>
    </div>
  );
}