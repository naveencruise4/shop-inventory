'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState([]);
  const [shopInfo, setShopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filters including Date Range (startDate & endDate)
  const [colFilters, setColFilters] = useState({ 
    invoiceNumber: '', 
    supplier: '', 
    startDate: todayStr, 
    endDate: todayStr, 
    type: '', 
    status: '' 
  });
  const [appliedFilters, setAppliedFilters] = useState(colFilters);
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const filterDropdownRef = useRef(null);

  const [totalCountMetric, setTotalCountMetric] = useState(0);

  // New Purchase Bill Modal State
  const [showNewBillModal, setShowNewBillModal] = useState(false);
  const [suppliersList, setSuppliersList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [newSup, setNewSup] = useState({ name: '', phone: '', email: '', gstin: '', address: '' });

  // Bill Form State (Including invoice_date)
  const [invoiceType, setInvoiceType] = useState('gst');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayStr);
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [cart, setCart] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [refNumber, setRefNumber] = useState('');

  const [settlingBill, setSettlingBill] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('cash');
  const [settleRef, setSettleRef] = useState('');

  const [viewingBillItems, setViewingBillItems] = useState(null);
  const [billLineItems, setBillLineItems] = useState([]);

  useEffect(() => {
    initPage();
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setActiveFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    if (data) setSuppliersList(data);
  };

  const fetchBills = useCallback(async () => {
    if (!shopInfo?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('purchase_bills')
        .select('*, suppliers(name, phone, gstin, address)', { count: 'exact' })
        .eq('shop_id', shopInfo.id);

      if (appliedFilters.invoiceNumber) {
        query = query.ilike('invoice_number', `%${appliedFilters.invoiceNumber.trim()}%`);
      }
      if (appliedFilters.supplier) {
        query = query.ilike('supplier_name', `%${appliedFilters.supplier.trim()}%`);
      }
      if (appliedFilters.startDate) {
        query = query.gte('purchase_date', appliedFilters.startDate);
      }
      if (appliedFilters.endDate) {
        query = query.lte('purchase_date', appliedFilters.endDate);
      }
      if (appliedFilters.type) {
        query = query.eq('invoice_type', appliedFilters.type);
      }
      if (appliedFilters.status) {
        query = query.eq('payment_status', appliedFilters.status);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setBills(data || []);
      setTotalCount(count || 0);
      setTotalCountMetric(count || 0);

    } catch (err) {
      console.error('Error fetching purchase bills:', err.message);
    } finally {
      setLoading(false);
    }
  }, [shopInfo?.id, appliedFilters, currentPage, pageSize]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleApplyFilter = (col) => {
    setAppliedFilters({ ...colFilters });
    setCurrentPage(1);
    setActiveFilterCol(null);
  };

  const handleClearFilter = (col) => {
    const updated = { ...colFilters, [col]: '' };
    setColFilters(updated);
    setAppliedFilters(updated);
    setCurrentPage(1);
    setActiveFilterCol(null);
  };

  const handleOpenViewItems = async (bill) => {
    setViewingBillItems(bill);
    const { data, error } = await supabase
      .from('product_purchases')
      .select('*')
      .eq('purchase_bill_id', bill.id);

    if (error) {
      console.error('Error fetching bill items:', error);
      setBillLineItems([]);
    } else {
      setBillLineItems(data || []);
    }
  };

  useEffect(() => {
    const term = productSearch.trim();
    if (!shopInfo?.id || term.length < 2) {
      setProductSearchResults([]);
      setShowProductDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('vw_product_stock')
        .select('*')
        .eq('shop_id', shopInfo.id)
        .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
        .limit(10);
      if (data) {
        setProductSearchResults(data);
        setShowProductDropdown(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch, shopInfo?.id]);

  const addProductToBillCart = (prod) => {
    const exists = cart.find(item => item.id === prod.id);
    if (exists) {
      setCart(cart.map(item => item.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        id: prod.id,
        sku: prod.sku,
        name: prod.name,
        quantity: 1,
        purchase_price: prod.cost_price || 0,// prod.selling_price || 0,
        has_gst: prod.has_gst || false,
        gst_percentage: Number(prod.gst_percentage || 18)
      }]);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + (Number(item.purchase_price) * Number(item.quantity)), 0);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!shopInfo?.id) return;

    const { data, error } = await supabase.from('suppliers').insert([{
      shop_id: shopInfo.id,
      name: newSup.name,
      phone: newSup.phone,
      email: newSup.email,
      gstin: newSup.gstin,
      address: newSup.address
    }]).select().single();

    if (error) {
      alert(`Error creating supplier: ${error.message}`);
      return;
    }

    fetchSuppliers(shopInfo.id);
    setSelectedSupplier(data);
    setSupplierSearch(data.name);
    setShowNewSupplierModal(false);
    setNewSup({ name: '', phone: '', email: '', gstin: '', address: '' });
  };

  const handleSavePurchaseBill = async () => {
    if (!selectedSupplier) {
      alert('⚠️ Please select a supplier for the purchase bill.');
      return;
    }
    if (!invoiceNumber.trim()) {
      alert('⚠️ Please enter the vendor invoice number.');
      return;
    }
    if (cart.length === 0) {
      alert('⚠️ Please add at least one product to the purchase bill.');
      return;
    }

    const subtotal = calculateSubtotal();
    const enteredPaid = amountPaid !== '' ? Number(amountPaid) : 0;

    const itemsPayload = cart.map(item => {
      const pct = invoiceType === 'gst' ? Number(item.gst_percentage || 0) : 0;
      const basePrice = pct > 0 ? Number((item.purchase_price / (1 + pct / 100)).toFixed(2)) : item.purchase_price;
      const gstAmt = pct > 0 ? Number((item.purchase_price - basePrice).toFixed(2)) * item.quantity : 0;

      return {
        product_id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        purchase_price: Number(item.purchase_price),
        has_gst: pct > 0,
        gst_percentage: pct,
        base_price: basePrice,
        gst_amount: gstAmt
      };
    });

    const paymentsPayload = enteredPaid > 0 ? [{
      amount: enteredPaid,
      payment_method: paymentMethod,
      reference_number: refNumber.trim() || null,
      notes: 'Initial payment upon bill entry'
    }] : [];

    try {
      const { error } = await supabase.rpc('create_purchase_bill', {
        p_shop_id: shopInfo.id,
        p_supplier_id: selectedSupplier.id,
        p_supplier_name: selectedSupplier.name,
        p_supplier_gstin: selectedSupplier.gstin,
        p_supplier_address: selectedSupplier.address,
        p_invoice_number: invoiceNumber.trim(),
        p_invoice_type: invoiceType,
        p_purchase_date: purchaseDate,
        p_invoice_date: invoiceDate,
        p_total_amount: subtotal,
        p_items: itemsPayload,
        p_payments: paymentsPayload
      });

      if (error) throw error;

      alert('✅ Purchase bill saved and inventory stock updated successfully!');
      setShowNewBillModal(false);
      setCart([]);
      setInvoiceNumber('');
      setAmountPaid('');
      setSelectedSupplier(null);
      setSupplierSearch('');
      fetchBills();
    } catch (err) {
      alert(`Failed to save purchase bill: ${err.message}`);
    }
  };

  const handleSettleBill = async () => {
    if (!settlingBill || !settleAmount) return;
    const payAmt = Number(settleAmount);
    if (payAmt <= 0) return;

    try {
      const { data: payData, error: payErr } = await supabase.from('purchase_payments').insert({
        shop_id: shopInfo.id,
        supplier_id: settlingBill.supplier_id,
        purchase_bill_id: settlingBill.id,
        amount: payAmt,
        payment_method: settleMethod,
        transaction_type: 'payment',
        reference_number: settleRef.trim() || null,
        notes: 'Bill settlement payment'
      }).select().single();

      if (payErr) throw payErr;

      const { error: allocErr } = await supabase.from('purchase_payment_allocations').insert({
        shop_id: shopInfo.id,
        payment_id: payData.id,
        purchase_bill_id: settlingBill.id,
        allocated_amount: payAmt
      });
      if (allocErr) throw allocErr;

      const newPaid = Number(settlingBill.paid_amount || 0) + payAmt;
      const newStatus = newPaid >= Number(settlingBill.total_amount) ? 'paid' : 'partial';

      const { error: updateErr } = await supabase.from('purchase_bills').update({
        paid_amount: newPaid,
        payment_status: newStatus
      }).eq('id', settlingBill.id);

      if (updateErr) throw updateErr;

      alert('✅ Payment settlement recorded successfully!');
      setSettlingBill(null);
      setSettleAmount('');
      setSettleRef('');
      fetchBills();
    } catch (err) {
      alert(`Settlement failed: ${err.message}`);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        
        <div className="top-bar">
          <div>
            <h1>Purchase Bills & Inventory Receiving</h1>
            <p className="subtext">Manage supplier invoices, purchase batches, and accounts payable</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="primary-btn" onClick={() => setShowNewBillModal(true)}>+ New Purchase Bill</button>
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Total Purchases Count</span>
            <span className="summary-value">{totalCountMetric}</span>
          </div>
        </div>

        <div className="table-wrapper card">
          {loading ? (
            <p className="loading-text">Loading purchase bills...</p>
          ) : (
            <div className="table-scroll-area">
              <table className="orders-table">
                <thead>
                  <tr>
                    {/* Invoice No Filter */}
                    <th style={{ position: 'relative' }}>
                      <div className="th-content" onClick={() => setActiveFilterCol(activeFilterCol === 'invoiceNumber' ? null : 'invoiceNumber')}>
                        <span>Invoice No</span>
                        <span className={`filter-icon ${appliedFilters.invoiceNumber ? 'active' : ''}`}>🔍</span>
                      </div>
                      {activeFilterCol === 'invoiceNumber' && (
                        <div className="filter-dropdown" ref={filterDropdownRef}>
                          <input
                            placeholder="Filter invoice..."
                            value={colFilters.invoiceNumber}
                            onChange={(e) => setColFilters({ ...colFilters, invoiceNumber: e.target.value })}
                            autoFocus
                          />
                          <div className="filter-dropdown-actions">
                            <button onClick={() => handleApplyFilter('invoiceNumber')} className="apply-btn">Filter</button>
                            <button onClick={() => handleClearFilter('invoiceNumber')} className="clear-btn">Reset</button>
                          </div>
                        </div>
                      )}
                    </th>

                    {/* Supplier Name Filter */}
                    <th style={{ position: 'relative' }}>
                      <div className="th-content" onClick={() => setActiveFilterCol(activeFilterCol === 'supplier' ? null : 'supplier')}>
                        <span>Supplier Name</span>
                        <span className={`filter-icon ${appliedFilters.supplier ? 'active' : ''}`}>🔍</span>
                      </div>
                      {activeFilterCol === 'supplier' && (
                        <div className="filter-dropdown" ref={filterDropdownRef}>
                          <input
                            placeholder="Filter supplier..."
                            value={colFilters.supplier}
                            onChange={(e) => setColFilters({ ...colFilters, supplier: e.target.value })}
                            autoFocus
                          />
                          <div className="filter-dropdown-actions">
                            <button onClick={() => handleApplyFilter('supplier')} className="apply-btn">Filter</button>
                            <button onClick={() => handleClearFilter('supplier')} className="clear-btn">Reset</button>
                          </div>
                        </div>
                      )}
                    </th>

                    {/* Purchase Date Range Filter */}
                    <th style={{ position: 'relative' }}>
                      <div className="th-content" onClick={() => setActiveFilterCol(activeFilterCol === 'dateRange' ? null : 'dateRange')}>
                        <span>Purchase Date</span>
                        <span className={`filter-icon ${appliedFilters.startDate || appliedFilters.endDate ? 'active' : ''}`}>📅</span>
                      </div>
                      {activeFilterCol === 'dateRange' && (
                        <div className="filter-dropdown" ref={filterDropdownRef} style={{ width: '220px' }}>
                          <label style={{ fontSize: '11px', color: '#64748b' }}>From Date:</label>
                          <input
                            type="date"
                            value={colFilters.startDate}
                            onChange={(e) => setColFilters({ ...colFilters, startDate: e.target.value })}
                          />
                          <label style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>To Date:</label>
                          <input
                            type="date"
                            value={colFilters.endDate}
                            onChange={(e) => setColFilters({ ...colFilters, endDate: e.target.value })}
                          />
                          <div className="filter-dropdown-actions" style={{ marginTop: '8px' }}>
                            <button onClick={() => handleApplyFilter('dateRange')} className="apply-btn">Filter</button>
                            <button onClick={() => {
                              const today = new Date().toISOString().split('T')[0];
                              setColFilters({ ...colFilters, startDate: today, endDate: today });
                              setAppliedFilters({ ...colFilters, startDate: today, endDate: today });
                              setActiveFilterCol(null);
                            }} className="clear-btn">Today</button>
                          </div>
                        </div>
                      )}
                    </th>

                    {/* Type Filter */}
                    <th style={{ position: 'relative' }}>
                      <div className="th-content" onClick={() => setActiveFilterCol(activeFilterCol === 'type' ? null : 'type')}>
                        <span>Type</span>
                        <span className={`filter-icon ${appliedFilters.type ? 'active' : ''}`}>🔽</span>
                      </div>
                      {activeFilterCol === 'type' && (
                        <div className="filter-dropdown" ref={filterDropdownRef}>
                          <select
                            value={colFilters.type}
                            onChange={(e) => setColFilters({ ...colFilters, type: e.target.value })}
                            autoFocus
                          >
                            <option value="">All Types</option>
                            <option value="gst">GST</option>
                            <option value="estimate">Estimate</option>
                          </select>
                          <div className="filter-dropdown-actions">
                            <button onClick={() => handleApplyFilter('type')} className="apply-btn">Filter</button>
                            <button onClick={() => handleClearFilter('type')} className="clear-btn">Reset</button>
                          </div>
                        </div>
                      )}
                    </th>

                    <th>Total Amount</th>
                    <th>Paid Amount</th>
                    <th>Balance Due</th>

                    {/* Payment Status Filter */}
                    <th style={{ position: 'relative' }}>
                      <div className="th-content" onClick={() => setActiveFilterCol(activeFilterCol === 'status' ? null : 'status')}>
                        <span>Payment Status</span>
                        <span className={`filter-icon ${appliedFilters.status ? 'active' : ''}`}>🔽</span>
                      </div>
                      {activeFilterCol === 'status' && (
                        <div className="filter-dropdown" ref={filterDropdownRef}>
                          <select
                            value={colFilters.status}
                            onChange={(e) => setColFilters({ ...colFilters, status: e.target.value })}
                            autoFocus
                          >
                            <option value="">All Statuses</option>
                            <option value="paid">Paid</option>
                            <option value="partial">Partial</option>
                            <option value="pending">Pending</option>
                          </select>
                          <div className="filter-dropdown-actions">
                            <button onClick={() => handleApplyFilter('status')} className="apply-btn">Filter</button>
                            <button onClick={() => handleClearFilter('status')} className="clear-btn">Reset</button>
                          </div>
                        </div>
                      )}
                    </th>

                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No purchase bills found for this date range or filter.</td>
                    </tr>
                  ) : (
                    bills.map(b => {
                      const total = Number(b.total_amount || 0);
                      const paid = Number(b.paid_amount || 0);
                      const due = Math.max(0, total - paid);

                      return (
                        <tr key={b.id}>
                          <td><strong>{b.invoice_number}</strong></td>
                          <td>{b.supplier_name || 'Walk-in Vendor'}</td>
                          <td>{b.purchase_date}</td>
                          <td><span className={`invoice-badge ${b.invoice_type}`}>{b.invoice_type.toUpperCase()}</span></td>
                          <td>₹{total.toFixed(2)}</td>
                          <td style={{ color: '#16a34a' }}>₹{paid.toFixed(2)}</td>
                          <td style={{ color: due > 0 ? '#dc2626' : '#15803d', fontWeight: 'bold' }}>₹{due.toFixed(2)}</td>
                          <td><span className={`status-badge payment-${b.payment_status}`}>{b.payment_status}</span></td>
                          <td style={{ display: 'flex', gap: '6px' }}>
                            <button className="reprint-btn" onClick={() => handleOpenViewItems(b)}>👁️ Items</button>
                            {due > 0 && (
                              <button className="reprint-btn settle" onClick={() => { setSettlingBill(b); setSettleAmount(due.toString()); }}>💳 Settle</button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          <div className="pagination-bar">
            <div className="pagination-info">
              Showing {bills.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
            </div>
            <div className="pagination-controls">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(currentPage - 1)}
                className="page-btn"
              >
                Previous
              </button>
              <span className="page-indicator">Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage >= totalPages} 
                onClick={() => setCurrentPage(currentPage + 1)}
                className="page-btn"
              >
                Next
              </button>
              <select 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="page-size-select"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal: New Purchase Bill Entry */}
        {showNewBillModal && (
          <div className="modal-overlay">
            <div className="modal" style={{ width: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3>New Purchase Bill Entry</h3>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Select Bill / Invoice Type *</label>
                <div className="segmented-control" style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`type-select-btn ${invoiceType === 'gst' ? 'active-gst' : ''}`}
                    onClick={() => setInvoiceType('gst')}
                  >
                    Tax Invoice (GST)
                  </button>
                  <button
                    type="button"
                    className={`type-select-btn ${invoiceType === 'estimate' ? 'active-estimate' : ''}`}
                    onClick={() => setInvoiceType('estimate')}
                  >
                    Estimate / Non-GST Bill
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Supplier *</label>
                  <input
                    placeholder="Search supplier name..."
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setShowSupplierDropdown(true);
                      if (!e.target.value) setSelectedSupplier(null);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                  />
                  {showSupplierDropdown && supplierSearch.trim() && (
                    <div className="dropdown-list">
                      {suppliersList.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                        <div key={s.id} className="dropdown-item" onClick={() => {
                          setSelectedSupplier(s);
                          setSupplierSearch(s.name);
                          setShowSupplierDropdown(false);
                        }}>
                          <strong>{s.name}</strong> <span className="subtext">{s.gstin}</span>
                        </div>
                      ))}
                      <div className="dropdown-item create-new-prompt" onClick={() => {
                        setShowSupplierDropdown(false);
                        setNewSup({ name: supplierSearch, phone: '', email: '', gstin: '', address: '' });
                        setShowNewSupplierModal(true);
                      }}>
                        + Create Supplier "{supplierSearch}"
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Vendor Invoice Number *</label>
                  <input placeholder="e.g. INV-9823" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vendor Invoice Date *</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Goods Receipt / Purchase Date *</label>
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
                </div>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Add Products</h4>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  placeholder="🔍 Search product by name or SKU to add..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {showProductDropdown && productSearchResults.length > 0 && (
                  <div className="dropdown-list">
                    {productSearchResults.map(p => (
                      <div key={p.id} className="dropdown-item" onClick={() => addProductToBillCart(p)}>
                        <div><strong>{p.name}</strong> <span className="subtext">({p.sku})</span></div>
                        <span className="price">₹{p.cost_price || p.selling_price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <table className="cart-table" style={{ marginBottom: '16px' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Cost (₹)</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong><br/><span className="subtext">{item.sku}</span></td>
                        <td><input type="number" value={item.quantity} onChange={(e) => {
                          const q = Number(e.target.value);
                          setCart(cart.map(c => c.id === item.id ? { ...c, quantity: q } : c));
                        }} style={{ width: '60px', padding: '4px' }} /></td>
                        <td><input type="number" value={item.purchase_price} onChange={(e) => {
                          const p = Number(e.target.value);
                          setCart(cart.map(c => c.id === item.id ? { ...c, purchase_price: p } : c));
                        }} style={{ width: '80px', padding: '4px' }} /></td>
                        <td>₹{(item.purchase_price * item.quantity).toFixed(2)}</td>
                        <td><button onClick={() => setCart(cart.filter(c => c.id !== item.id))} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="cart-summary" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <div className="summary-row">
                  <span>Grand Total:</span>
                  <strong>₹{calculateSubtotal().toFixed(2)}</strong>
                </div>
                <div className="summary-row">
                  <span>Initial Payment Made (₹):</span>
                  <input type="number" placeholder="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="custom-total-input" />
                </div>
                <div className="summary-row">
                  <span>Payment Method:</span>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="custom-total-input" style={{ width: '130px' }}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button className="primary-btn" onClick={handleSavePurchaseBill}>Save & Receive Stock</button>
                <button className="cancel-btn" onClick={() => setShowNewBillModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Enriched View Purchased Bill Items */}
        {viewingBillItems && (
          <div className="modal-overlay">
            <div className="modal" style={{ width: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
              <h3>Purchase Bill Details: {viewingBillItems.invoice_number}</h3>
              
              <div className="bill-audit-grid" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div><strong>Supplier:</strong> {viewingBillItems.supplier_name || 'Walk-in'}</div>
                <div><strong>Supplier GSTIN:</strong> {viewingBillItems.supplier_gstin || 'N/A'}</div>
                <div><strong>Vendor Invoice Date:</strong> {viewingBillItems.invoice_date || viewingBillItems.purchase_date}</div>
                <div><strong>Goods Received Date:</strong> {viewingBillItems.purchase_date}</div>
                <div><strong>Invoice Type:</strong> <span className={`invoice-badge ${viewingBillItems.invoice_type}`}>{viewingBillItems.invoice_type.toUpperCase()}</span></div>
                <div><strong>Payment Status:</strong> <span className={`status-badge payment-${viewingBillItems.payment_status}`}>{viewingBillItems.payment_status}</span></div>
              </div>

              <h4>Received Line Items & Batches</h4>
              <table className="cart-table" style={{ marginTop: '8px' }}>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Unit Cost (₹)</th>
                    {viewingBillItems.invoice_type === 'gst' && <th>GST %</th>}
                    <th>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {billLineItems.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No items found for this bill.</td></tr>
                  ) : (
                    billLineItems.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.sku || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>₹{Number(item.purchase_price).toFixed(2)}</td>
                        {viewingBillItems.invoice_type === 'gst' && <td>{item.gst_percentage}%</td>}
                        <td>₹{(Number(item.quantity) * Number(item.purchase_price)).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="cart-summary" style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <div className="summary-row">
                  <span>Total Bill Amount:</span>
                  <strong>₹{Number(viewingBillItems.total_amount).toFixed(2)}</strong>
                </div>
                <div className="summary-row">
                  <span>Paid Amount:</span>
                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>₹{Number(viewingBillItems.paid_amount || 0).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Balance Due:</span>
                  <span style={{ color: '#dc2626', fontWeight: 'bold' }}>₹{Math.max(0, Number(viewingBillItems.total_amount) - Number(viewingBillItems.paid_amount || 0)).toFixed(2)}</span>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button className="cancel-btn" onClick={() => setViewingBillItems(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: New Supplier Quick Create */}
        {showNewSupplierModal && (
          <div className="modal-overlay" style={{ zIndex: 110 }}>
            <div className="modal">
              <h3>Create New Supplier</h3>
              <form onSubmit={handleCreateSupplier}>
                <label>Supplier Name *</label>
                <input placeholder="Company name" value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} required />
                <label>Phone</label>
                <input placeholder="Phone number" value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} />
                <label>GSTIN</label>
                <input placeholder="GSTIN number" value={newSup.gstin} onChange={(e) => setNewSup({ ...newSup, gstin: e.target.value })} />
                <label>Address</label>
                <input placeholder="Business address" value={newSup.address} onChange={(e) => setNewSup({ ...newSup, address: e.target.value })} />
                <div className="modal-actions" style={{ marginTop: '10px' }}>
                  <button type="submit" className="primary-btn">Save Supplier</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowNewSupplierModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Settle Bill */}
        {settlingBill && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Settle Bill: {settlingBill.invoice_number}</h3>
              <p className="subtext">Supplier: {settlingBill.supplier_name}</p>
              <label>Payment Amount (₹)</label>
              <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} />
              <label>Payment Method</label>
              <select value={settleMethod} onChange={(e) => setSettleMethod(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%', marginBottom: '10px' }}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
              <label>Reference / UTR Number</label>
              <input placeholder="Optional transaction ref..." value={settleRef} onChange={(e) => setSettleRef(e.target.value)} />
              <div className="modal-actions" style={{ marginTop: '14px' }}>
                <button className="primary-btn" onClick={handleSettleBill}>Record Payment</button>
                <button className="cancel-btn" onClick={() => setSettlingBill(null)}>Cancel</button>
              </div>
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
        .primary-btn { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .summary-cards { display: flex; margin-bottom: 16px; flex-shrink: 0; }
        .summary-card { background: white; padding: 12px 20px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; border-left: 4px solid #0284c7; min-width: 220px; }
        .summary-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
        .summary-value { font-size: 22px; font-weight: 700; color: #0f172a; }
        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
        .table-scroll-area { flex: 1; overflow: auto; }
        .orders-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
        .orders-table th { background: #f1f5f9; color: #475569; padding: 12px 14px; font-weight: 600; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; }
        .orders-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
        .th-content { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; gap: 6px; }
        .filter-icon { font-size: 11px; opacity: 0.5; }
        .filter-icon.active { opacity: 1; color: #0284c7; }
        .filter-dropdown { position: absolute; top: 100%; left: 0; background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 30; min-width: 180px; display: flex; flex-direction: column; gap: 8px; }
        .filter-dropdown input, .filter-dropdown select { width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; box-sizing: border-box; }
        .filter-dropdown-actions { display: flex; justify-content: space-between; gap: 6px; }
        .apply-btn { background: #0284c7; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; flex: 1; }
        .clear-btn { background: #64748b; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; flex: 1; }
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #fff; flex-shrink: 0; font-size: 13px; color: #475569; }
        .pagination-controls { display: flex; align-items: center; gap: 10px; }
        .page-btn { padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; cursor: pointer; color: #1e293b; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-size-select { padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; }
        .invoice-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .invoice-badge.gst { background: #e0f2fe; color: #0369a1; }
        .invoice-badge.estimate { background: #fef3c7; color: #92400e; }
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: capitalize; }
        .status-badge.payment-paid { background: #dcfce7; color: #15803d; }
        .status-badge.payment-partial { background: #fef9c3; color: #a16207; }
        .status-badge.payment-pending { background: #fee2e2; color: #b91c1c; }
        .reprint-btn { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .reprint-btn.settle { background: #0f172a; color: white; border-color: #0f172a; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .modal { background: white; padding: 24px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; width: 450px; }
        .modal input, .modal select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; font-size: 13px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .cancel-btn { padding: 8px 14px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group label { font-size: 12px; font-weight: 600; color: #475569; }
        .type-select-btn { flex: 1; padding: 10px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; color: #475569; }
        .type-select-btn.active-gst { background: #0284c7; color: white; border-color: #0284c7; }
        .type-select-btn.active-estimate { background: #d97706; color: white; border-color: #d97706; }
        .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 180px; overflow-y: auto; z-index: 60; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .dropdown-item { padding: 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .dropdown-item:hover { background: #f8fafc; }
        .create-new-prompt { color: #0284c7; background: #f0f9ff; font-weight: 600; }
        .cart-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cart-table th { background: #f1f5f9; padding: 8px; text-align: left; }
        .cart-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
        .cart-summary { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #475569; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; }
        .custom-total-input { width: 130px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: right; }
      `}</style>
    </div>
  );
}