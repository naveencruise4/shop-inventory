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

  // Salesmen list state for inline editing
  const [salesmenList, setSalesmenList] = useState([]);
  const [editingSalesmanOrderId, setEditingSalesmanOrderId] = useState(null);
  const [selectedRepId, setSelectedRepId] = useState('');

  // Summary Totals State
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalPaid: 0,
    totalPending: 0
  });

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column Visibility Toggle State
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    orderNumber: true,
    orderId: true,
    date: true,
    customer: true,
    salesRep: true,
    type: true,
    saleStatus: true,
    paymentStatus: true,
    orderStatus: true,
    breakdown: true,
    actions: true
  });

  const columnSelectorRef = useRef(null);

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

  const [colFilters, setColFilters] = useState({
    orderNumber: '',
    orderId: '',
    customer: '',
    salesRep: '',
    type: '',
    saleStatus: '',
    paymentStatus: '',
    orderStatus: ''
  });
  const [dateRange, setDateRange] = useState(getInitialDates());

  const [appliedFilters, setAppliedFilters] = useState(colFilters);
  const [appliedDates, setAppliedDates] = useState(dateRange);

  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const filterDropdownRef = useRef(null);

  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setActiveFilterCol(null);
      }
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target)) {
        setShowColumnSelector(false);
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
      if (shop) {
        setShopInfo(shop);
        fetchSalesmen(shop.id);
      }
    }
  };

  const fetchSalesmen = async (shopId) => {
    const { data } = await supabase.from('salesman').select('id, name').eq('shop_id', shopId);
    if (data) setSalesmenList(data);
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

  const fetchOrders = useCallback(async () => {
    if (!shopInfo?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('sales')
        .select(`
          *,
          customers${appliedFilters.customer.trim() ? '!inner' : ''}(name, phone),
          salesman${appliedFilters.salesRep.trim() ? '!inner' : ''}(id, name),
          sale_items(*),
          sale_payments(payment_method)
        `, { count: 'exact' })
        .eq('shop_id', shopInfo.id);

      if (appliedFilters.orderNumber) {
        query = query.ilike('order_number', `%${appliedFilters.orderNumber.trim()}%`);
      }

      if (appliedFilters.orderId) {
        const idQuery = appliedFilters.orderId.trim().replace(/^#/, '');
        query = query.filter('id::text', 'ilike', `${idQuery}%`);
      }
      
      if (appliedFilters.customer) {
        const cVal = appliedFilters.customer.trim();
        query = query.or(`name.ilike.%${cVal}%,phone.ilike.%${cVal}%`, { foreignTable: 'customers' });
      }
      
      if (appliedFilters.salesRep) {
        const repVal = appliedFilters.salesRep.trim();
        query = query.ilike('salesman.name', `%${repVal}%`);
      }
      
      const { start, end } = getQueryDates(appliedDates);
      if (start) query = query.gte('created_at', start);
      if (end) query = query.lte('created_at', end);

      if (appliedFilters.type) {
        query = query.eq('invoice_type', appliedFilters.type);
      }

      if (appliedFilters.saleStatus) {
        query = query.eq('sale_status', appliedFilters.saleStatus);
      }

      if (appliedFilters.paymentStatus) {
        query = query.eq('payment_status', appliedFilters.paymentStatus);
      }

      if (appliedFilters.orderStatus) {
        query = query.eq('order_status', appliedFilters.orderStatus);
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
        p_status: appliedFilters.saleStatus || null,
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

  const handleUpdateSalesman = async (orderId) => {
    const newSalesmanId = selectedRepId === '' ? null : selectedRepId;
    const { error } = await supabase
      .from('sales')
      .update({ salesman_id: newSalesmanId })
      .eq('id', orderId);

    if (error) {
      alert(`Failed to update salesman: ${error.message}`);
    } else {
      setEditingSalesmanOrderId(null);
      fetchOrders();
    }
  };

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
    const empty = { orderNumber: '', orderId: '', customer: '', salesRep: '', type: '', saleStatus: '', paymentStatus: '', orderStatus: '' };
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

    const headers = ['Order Number', 'Order ID', 'Date', 'Customer', 'Sales Rep', 'Type', 'Sale Status', 'Payment Status', 'Order Status', 'Payment Method', 'Total Amount', 'Paid Amount', 'Pending Amount'];
    const escapeCSV = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = orders.map(o => {
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || total);
      const pending = Math.max(0, total - paid);
      const paymentMethod = o.sale_payments?.[0]?.payment_method || o.payment_method || 'cash';
      
      return [
        escapeCSV(o.order_number || '-'),
        escapeCSV(`#${o.id.slice(0, 8)}`),
        escapeCSV(new Date(o.created_at).toLocaleString()),
        escapeCSV(o.customers?.name || 'Walk-in Customer'),
        escapeCSV(o.salesman?.name || 'Unassigned'),
        escapeCSV(o.invoice_type === 'gst' ? 'GST' : 'Estimate'),
        escapeCSV(o.sale_status || 'completed'),
        escapeCSV(o.payment_status || 'paid'),
        escapeCSV(o.order_status || 'delivered'),
        escapeCSV(paymentMethod),
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

    const paymentMethod = order.sale_payments?.[0]?.payment_method || order.payment_method || 'cash';

    const formattedOrder = {
      saleId: order.id,
      orderNumber: order.order_number,
      shopName: shopInfo?.name || 'My Shop',
      date: new Date(order.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customer: order.customers?.name || 'Walk-in Customer',
      customerPhone: order.customers?.phone || '',
      salesmanName: order.salesman?.name || 'Unassigned',
      items: order.sale_items || [],
      totalAmount: Number(order.total_amount),
      paidAmount: Number(order.paid_amount || order.total_amount),
      paymentMethod,
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

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        
        <div className="sticky-top-container">
          <div className="top-bar">
            <div>
              <h1>Sales Orders Search & Manage</h1>
              <p className="subtext" style={{ marginTop: '2px' }}>Manage and filter orders, salesmen, payment methods, and tracking statuses</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
              
              <div ref={columnSelectorRef}>
                <button className="secondary-btn" onClick={() => setShowColumnSelector(prev => !prev)}>
                  ⚙️ Choose Columns
                </button>
                {showColumnSelector && (
                  <div className="column-selector-dropdown">
                    <h4>Toggle Visible Columns</h4>
                    <div className="col-toggles-grid">
                      {Object.keys(visibleColumns).map(col => (
                        <label key={col} className="col-toggle-label">
                          <input 
                            type="checkbox" 
                            checked={visibleColumns[col]} 
                            onChange={() => toggleColumn(col)} 
                          />
                          <span style={{ textTransform: 'capitalize' }}>{col.replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <button className="secondary-btn" onClick={resetToThisMonth}>↺ Reset Filters</button>
              )}
              <button className="export-btn" onClick={handleExportCSV}>📊 Export Page</button>
            </div>
          </div>

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
                      {visibleColumns.orderNumber && (
                        <th>
                          <div className="th-content">
                            Order Number
                            <button className={`filter-icon-btn ${appliedFilters.orderNumber ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'orderNumber' ? null : 'orderNumber')}>▼</button>
                          </div>
                          {renderFilterMenu('orderNumber', 'Search Order # & Enter...', 'text')}
                        </th>
                      )}
                      {visibleColumns.orderId && (
                        <th>
                          <div className="th-content">
                            Order ID
                            <button className={`filter-icon-btn ${appliedFilters.orderId ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'orderId' ? null : 'orderId')}>▼</button>
                          </div>
                          {renderFilterMenu('orderId', 'Search ID & Enter...', 'text')}
                        </th>
                      )}
                      {visibleColumns.date && (
                        <th>
                          <div className="th-content">
                            Date
                            <button className={`filter-icon-btn ${(appliedDates.start || appliedDates.end) ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'date' ? null : 'date')}>▼</button>
                          </div>
                          {renderFilterMenu('date')}
                        </th>
                      )}
                      {visibleColumns.customer && (
                        <th>
                          <div className="th-content">
                            Customer
                            <button className={`filter-icon-btn ${appliedFilters.customer ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'customer' ? null : 'customer')}>▼</button>
                          </div>
                          {renderFilterMenu('customer', 'Search name/phone & Enter...', 'text')}
                        </th>
                      )}
                      {visibleColumns.salesRep && (
                        <th>
                          <div className="th-content">
                            Sales Rep
                            <button className={`filter-icon-btn ${appliedFilters.salesRep ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'salesRep' ? null : 'salesRep')}>▼</button>
                          </div>
                          {renderFilterMenu('salesRep', 'Search rep name & Enter...', 'text')}
                        </th>
                      )}
                      {visibleColumns.type && (
                        <th>
                          <div className="th-content">
                            Type
                            <button className={`filter-icon-btn ${appliedFilters.type ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'type' ? null : 'type')}>▼</button>
                          </div>
                          {renderFilterMenu('type', '', 'select', [{label: 'GST', value: 'gst'}, {label: 'Estimate', value: 'estimate'}])}
                        </th>
                      )}
                      {visibleColumns.saleStatus && (
                        <th>
                          <div className="th-content">
                            Sale Status
                            <button className={`filter-icon-btn ${appliedFilters.saleStatus ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'saleStatus' ? null : 'saleStatus')}>▼</button>
                          </div>
                          {renderFilterMenu('saleStatus', '', 'select', [
                            {label: 'Completed', value: 'completed'},
                            {label: 'Pre Order', value: 'pre_order'}
                          ])}
                        </th>
                      )}
                      {visibleColumns.paymentStatus && (
                        <th>
                          <div className="th-content">
                            Payment Status
                            <button className={`filter-icon-btn ${appliedFilters.paymentStatus ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'paymentStatus' ? null : 'paymentStatus')}>▼</button>
                          </div>
                          {renderFilterMenu('paymentStatus', '', 'select', [
                            {label: 'Paid', value: 'paid'},
                            {label: 'Partial', value: 'partial'},
                            {label: 'Pending', value: 'pending'}
                          ])}
                        </th>
                      )}
                      {visibleColumns.orderStatus && (
                        <th>
                          <div className="th-content">
                            Order Status
                            <button className={`filter-icon-btn ${appliedFilters.orderStatus ? 'active' : ''}`} onClick={() => setActiveFilterCol(activeFilterCol === 'orderStatus' ? null : 'orderStatus')}>▼</button>
                          </div>
                          {renderFilterMenu('orderStatus', '', 'select', [
                            {label: 'Delivered', value: 'delivered'},
                            {label: 'Confirmed', value: 'confirmed'},
                            {label: 'Processing', value: 'processing'}
                          ])}
                        </th>
                      )}
                   
                      {visibleColumns.breakdown && <th>Payment Breakdown</th>}
                      {visibleColumns.actions && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const total = Number(order.total_amount || 0);
                      const paid = Number(order.paid_amount || total);
                      const pending = Math.max(0, total - paid);
                      const repName = order.salesman?.name || 'Unassigned';
                      const sStatus = order.sale_status || 'completed';
                      const pStatus = order.payment_status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending');
                      const oStatus = order.order_status || (sStatus === 'pre_order' ? 'processing' : 'delivered');
                      const isEditingRep = editingSalesmanOrderId === order.id;

                      return (
                        <tr key={order.id}>
                          {visibleColumns.orderNumber && <td><strong>{order.order_number || '-'}</strong></td>}
                          {visibleColumns.orderId && <td><span className="subtext">#{order.id.slice(0, 8)}</span></td>}
                          {visibleColumns.date && (
                            <td className="date-cell">
                              {new Date(order.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')}
                            </td>
                          )}
                          {visibleColumns.customer && <td><strong>{order.customers?.name || 'Walk-in Customer'}</strong></td>}
                          
                          {visibleColumns.salesRep && (
                            <td>
                              {isEditingRep ? (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <select 
                                    value={selectedRepId} 
                                    onChange={(e) => setSelectedRepId(e.target.value)}
                                    className="page-size-select"
                                  >
                                    <option value="">-- Unassigned --</option>
                                    {salesmenList.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                  <button className="apply-filter-btn" style={{ padding: '4px 8px', fontSize: '11px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => handleUpdateSalesman(order.id)}>Save</button>
                                  <button style={{ padding: '4px 6px', fontSize: '11px', background: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setEditingSalesmanOrderId(null)}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="salesman-tag">👤 {repName}</span>
                                  <button 
                                    className="filter-icon-btn" 
                                    title="Edit Sales Rep"
                                    onClick={() => {
                                      setEditingSalesmanOrderId(order.id);
                                      setSelectedRepId(order.salesman_id || '');
                                    }}
                                  >
                                    ✏️
                                  </button>
                                </div>
                              )}
                            </td>
                          )}

                          {visibleColumns.type && <td><span className={`invoice-badge ${order.invoice_type === 'gst' ? 'gst' : 'estimate'}`}>{order.invoice_type === 'gst' ? 'GST' : 'Estimate'}</span></td>}
                          
                          {visibleColumns.saleStatus && (
                            <td>
                              <span className={`status-badge sale-${sStatus}`}>{sStatus.replace('_', ' ')}</span>
                            </td>
                          )}
                          {visibleColumns.paymentStatus && (
                            <td>
                              <span className={`status-badge payment-${pStatus}`}>{pStatus}</span>
                            </td>
                          )}
                          {visibleColumns.orderStatus && (
                            <td>
                              <span className={`status-badge order-${oStatus}`}>{oStatus}</span>
                            </td>
                          )}

                          {visibleColumns.breakdown && (
                            <td className="breakdown-cell">
                              <div><span>Total: </span><strong>₹{total.toFixed(2)}</strong></div>
                              <div className="paid-line"><span>Paid: </span><strong>₹{paid.toFixed(2)}</strong></div>
                              {pending > 0 && <div className="pending-line"><span>Pending: </span><strong>₹{pending.toFixed(2)}</strong></div>}
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td>
                              <button className="reprint-btn" onClick={() => handleReprint(order)}>🖨️ Reprint</button>
                            </td>
                          )}
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

        .column-selector-dropdown { position: absolute; right: 0; top: 100%; background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 100; width: 240px; }
        .column-selector-dropdown h4 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        .col-toggles-grid { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
        .col-toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer; }

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
        .orders-table th {
          background: #f1f5f9;
          color: #475569;
          padding: 12px 14px;
          font-weight: 600;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid #e2e8f0;
        }
        .orders-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .orders-table tbody tr:hover { background: #f8fafc; }
        
        .date-cell { color: #334155; white-space: nowrap; }
        .salesman-tag { background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
        .invoice-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }
        .invoice-badge.gst { background: #e0f2fe; color: #0369a1; }
        .invoice-badge.estimate { background: #fef3c7; color: #92400e; }
        
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: capitalize; display: inline-block; }
        .status-badge.payment-paid { background: #dcfce7; color: #15803d; }
        .status-badge.payment-partial { background: #fef9c3; color: #a16207; }
        .status-badge.payment-pending { background: #fee2e2; color: #b91c1c; }
        .status-badge.sale-completed { background: #f1f5f9; color: #334155; }
        .status-badge.sale-pre_order { background: #fef3c7; color: #92400e; }
        .status-badge.order-delivered { background: #e0f2fe; color: #0369a1; }
        .status-badge.order-confirmed { background: #f3e8ff; color: #6b21a8; }
        .status-badge.order-processing { background: #ffedd5; color: #c2410c; }

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