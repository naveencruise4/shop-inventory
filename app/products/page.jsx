'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
//import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  
  // Purchase Edit Modal State
  const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState({ id: '', quantity: '', purchase_price: '', purchase_date: '', supplier_name: '' });

  // Forms State
  const [newProd, setNewProd] = useState({
    sku: '',
    name: '',
    brand_name: '',
    hsn_code: '',
    category_name: 'General',
    initial_quantity: '0',
    purchase_price: '',
    selling_price: '',
    margin_pct: '',
    purchase_date: new Date().toISOString().split('T')[0],
    min_stock_level: 3,
    purchase_tax_mode: 'estimate',
    purchase_gst_percentage: '18',
    selling_tax_mode: 'estimate',
    gst_percentage: '18'
  });

  // General Product Edit Form State (Excluding Total Stock)
  const [editProd, setEditProd] = useState({
    name: '',
    brand_name: '',
    category_name: '',
    hsn_code: '',
    selling_price: '',
    staff_price: '',
    final_price: ''
  });

  const [restock, setRestock] = useState({ quantity: '', purchase_price: '', supplier_name: '', purchase_date: new Date().toISOString().split('T')[0] });

  // Tab Data
  const [purchasesHistory, setPurchasesHistory] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [latestPurchaseCost, setLatestPurchaseCost] = useState(null);

  useEffect(() => {
    initShop();
  }, []);

  const initShop = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();

    if (appUser?.shop_id) {
      setShopId(appUser.shop_id);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setAppliedSearch(search.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  const fetchProducts = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('vw_product_stock')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId);

      if (appliedSearch) {
        const q = `%${appliedSearch}%`;
        query = query.or(`name.ilike.${q},sku.ilike.${q},category_name.ilike.${q},brand_name.ilike.${q},hsn_code.ilike.${q}`);
      }

      if (sortBy === 'name_asc') query = query.order('name', { ascending: true });
      if (sortBy === 'name_desc') query = query.order('name', { ascending: false });
      if (sortBy === 'price_asc') query = query.order('selling_price', { ascending: true });
      if (sortBy === 'price_desc') query = query.order('selling_price', { ascending: false });
      if (sortBy === 'stock_asc') query = query.order('available_stock', { ascending: true });
      if (sortBy === 'stock_desc') query = query.order('available_stock', { ascending: false });

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching products:', err.message);
    } finally {
      setLoading(false);
    }
  }, [shopId, appliedSearch, sortBy, currentPage, pageSize]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (selectedProduct) {
      fetchLatestPurchaseCost(selectedProduct.id);
      if (activeTab === 'purchases') fetchPurchaseHistory(selectedProduct.id);
      if (activeTab === 'sales') fetchSalesHistory(selectedProduct.sku);
    }
  }, [selectedProduct, activeTab]);

  const fetchLatestPurchaseCost = async (productId) => {
    const { data } = await supabase
      .from('product_purchases')
      .select('purchase_price')
      .eq('product_id', productId)
      .order('purchase_date', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLatestPurchaseCost(data[0].purchase_price);
    } else {
      setLatestPurchaseCost(selectedProduct?.avg_cost_price || 0);
    }
  };

  const fetchPurchaseHistory = async (productId) => {
      const { data } = await supabase
        .from('product_purchases')
        .select('*')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false }) // 👈 Ensures latest purchase dates come first
        .order('created_at', { ascending: false });   // 👈 Secondary sort by creation time if dates match
      if (data) setPurchasesHistory(data);
    };

    const fetchSalesHistory = async (sku) => {
        const { data } = await supabase
          .from('sale_items')
          .select('*, sales(created_at, sale_status, customer_id, customers(name))')
          .eq('sku', sku);
          
        // Sort sales in memory or via query by sales.created_at descending so newest are on top
        if (data) {
          const sortedSales = data.sort((a, b) => {
            const dateA = new Date(a.sales?.created_at || 0);
            const dateB = new Date(b.sales?.created_at || 0);
            return dateB - dateA; // Descending order (latest first)
          });
          setSalesHistory(sortedSales);
        }
      };

  const totalPages = useMemo(() => {
    return Math.ceil(totalCount / pageSize) || 1;
  }, [totalCount, pageSize]);

  const handleNewProdPriceChange = (field, val) => {
    const cost = Number(newProd.purchase_price || 0);
    if (field === 'selling_price') {
      const sell = Number(val);
      const margin = (sell && cost) ? (((sell - cost) / sell) * 100).toFixed(1) : '';
      setNewProd({ ...newProd, selling_price: val, margin_pct: margin });
    } else if (field === 'margin_pct') {
      const margin = Number(val);
      const sell = (cost && margin < 100) ? (cost / (1 - margin / 100)).toFixed(2) : '';
      setNewProd({ ...newProd, margin_pct: val, selling_price: sell });
    } else if (field === 'purchase_price') {
      const newCost = Number(val);
      const margin = Number(newProd.margin_pct);
      const sell = (newCost && margin) ? (newCost / (1 - margin / 100)).toFixed(2) : newProd.selling_price;
      setNewProd({ ...newProd, purchase_price: val, selling_price: sell });
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!shopId) return;

    const initQty = Number(newProd.initial_quantity || 0);
    const costPrice = Number(newProd.purchase_price || 0);

    const hasPurchaseGst = newProd.purchase_tax_mode === 'gst';
    const hasSellingGst = newProd.selling_tax_mode === 'gst';

    const { data: prodData, error: prodErr } = await supabase.from('productsinfo').insert([{
      shop_id: shopId,
      sku: newProd.sku,
      name: newProd.name,
      brand_name: newProd.brand_name?.trim() || null,
      hsn_code: hasSellingGst ? (newProd.hsn_code?.trim() || null) : null,
      category_name: newProd.category_name,
      selling_price: Number(newProd.selling_price),
      min_stock_level: Number(newProd.min_stock_level),
      stock_quantity: initQty,
      total_stock: initQty,
      avg_cost_price: costPrice,
      has_purchase_gst: hasPurchaseGst,
      purchase_gst_percentage: hasPurchaseGst ? Number(newProd.purchase_gst_percentage) : 0.00,
      has_gst: hasSellingGst,
      gst_percentage: hasSellingGst ? Number(newProd.gst_percentage) : 0.00
    }]).select().single();

    if (prodErr) {
      alert(`Error creating product: ${prodErr.message}`);
      return;
    }

    if (initQty > 0 && prodData) {
      await supabase.from('product_purchases').insert([{
        shop_id: shopId,
        product_id: prodData.id,
        quantity: initQty,
        purchase_price: costPrice,
        purchase_date: newProd.purchase_date
      }]);
    }

    setShowAddModal(false);
    setNewProd({ 
      sku: '', name: '', brand_name: '', hsn_code: '', category_name: 'General', initial_quantity: '0', 
      purchase_price: '', selling_price: '', margin_pct: '', 
      purchase_date: new Date().toISOString().split('T')[0], min_stock_level: 3, 
      purchase_tax_mode: 'estimate', purchase_gst_percentage: '18',
      selling_tax_mode: 'estimate', gst_percentage: '18' 
    });
    fetchProducts();
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const { error } = await supabase.from('productsinfo').update({
      name: editProd.name.trim(),
      brand_name: editProd.brand_name?.trim() || null,
      category_name: editProd.category_name.trim(),
      hsn_code: editProd.hsn_code?.trim() || null,
      selling_price: Number(editProd.selling_price),
      staff_price: editProd.staff_price !== '' ? Number(editProd.staff_price) : null,
      final_price: editProd.final_price !== '' ? Number(editProd.final_price) : null
    }).eq('id', selectedProduct.id);

    if (error) {
      alert(`Error updating product: ${error.message}`);
      return;
    }

    setShowEditModal(false);
    const { data: updated } = await supabase.from('vw_product_stock').select('*').eq('id', selectedProduct.id).single();
    if (updated) setSelectedProduct(updated);
    fetchProducts();
  };

  const handleUpdatePurchaseBatch = async (e) => {
    e.preventDefault();
    if (!editingPurchase.id || !selectedProduct) return;

    const newEditingQty = Number(editingPurchase.quantity);
    const deliveredStock = Number(selectedProduct.delivered_stock || 0);

    // 1. Calculate the new total stock across ALL purchase batches combined
    const projectedTotalStock = purchasesHistory.reduce((sum, p) => {
      if (p.id === editingPurchase.id) {
        return sum + newEditingQty; // use the newly proposed quantity for this batch
      }
      return sum + Number(p.quantity); // keep existing quantities for other batches
    }, 0);

    // 2. Validation: Combined total stock of all batches cannot be less than delivered stock
    if (projectedTotalStock < deliveredStock) {
      alert(`⚠️ Resulting total stock across all purchase batches (${projectedTotalStock}) cannot be less than delivered stock (${deliveredStock} units already fulfilled in orders).`);
      return;
    }

    const oldQty = Number(purchasesHistory.find(p => p.id === editingPurchase.id)?.quantity || 0);
    const diffQty = newEditingQty - oldQty;

    // 3. Update the specific product_purchase row
    const { error: purchaseErr } = await supabase.from('product_purchases').update({
      quantity: newEditingQty,
      purchase_price: Number(editingPurchase.purchase_price),
      purchase_date: editingPurchase.purchase_date,
      supplier_name: editingPurchase.supplier_name?.trim() || null
    }).eq('id', editingPurchase.id);

    if (purchaseErr) {
      alert(`Error updating purchase batch: ${purchaseErr.message}`);
      return;
    }

    // 4. Update productsinfo total stock and available stock aggregates
    const updatedAvailableStock = Number(selectedProduct.available_stock) + diffQty;

    const { error: prodErr } = await supabase.from('productsinfo').update({
      total_stock: projectedTotalStock,
      stock_quantity: Math.max(0, updatedAvailableStock)
    }).eq('id', selectedProduct.id);

    if (prodErr) {
      alert(`Error updating product stock aggregates: ${prodErr.message}`);
      return;
    }

    setShowEditPurchaseModal(false);
    fetchPurchaseHistory(selectedProduct.id);
    
    const { data: updated } = await supabase.from('vw_product_stock').select('*').eq('id', selectedProduct.id).single();
    if (updated) setSelectedProduct(updated);
    fetchProducts();
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const incomingQty = Number(restock.quantity);
    const incomingCost = Number(restock.purchase_price);
    const currentQty = selectedProduct.available_stock;
    const totalStock = incomingQty + selectedProduct.total_stock;
    const currentAvgCost = selectedProduct.avg_cost_price;

    const newTotalQty = currentQty + incomingQty;
    const newAvgCost = newTotalQty > 0 
      ? ((currentQty * currentAvgCost) + (incomingQty * incomingCost)) / newTotalQty 
      : incomingCost;

    await supabase.from('product_purchases').insert([{
      shop_id: selectedProduct.shop_id,
      product_id: selectedProduct.id,
      quantity: incomingQty,
      purchase_price: incomingCost,
      supplier_name: restock.supplier_name,
      purchase_date: restock.purchase_date
    }]);

    await supabase.from('productsinfo').update({
      stock_quantity: newTotalQty,
      total_stock: totalStock,
      avg_cost_price: newAvgCost
    }).eq('id', selectedProduct.id);

    setShowRestockModal(false);
    setRestock({ quantity: '', purchase_price: '', supplier_name: '', purchase_date: new Date().toISOString().split('T')[0] });
    
    const { data: updated } = await supabase.from('vw_product_stock').select('*').eq('id', selectedProduct.id).single();
    if (updated) setSelectedProduct(updated);
    fetchLatestPurchaseCost(selectedProduct.id);
    fetchProducts();
  };

  return (
    <div className="layout">

      <main className="content">
        {selectedProduct ? (
          <div className="details-wrapper">
            <button className="back-btn" onClick={() => setSelectedProduct(null)}>← Back to Products</button>
            
            <div className="header-card">
              <div className="header-main">
                <div>
                  <h2>{selectedProduct.name}</h2>
                  <span className="sku-badge">SKU: {selectedProduct.sku}</span>
                  {selectedProduct.brand_name && (
                    <span className="sku-badge" style={{ marginLeft: '8px', background: '#f1f5f9', color: '#334155' }}>
                      Brand: {selectedProduct.brand_name}
                    </span>
                  )}
                  {selectedProduct.hsn_code && (
                    <span className="sku-badge" style={{ marginLeft: '8px', background: '#fef3c7', color: '#92400e' }}>
                      HSN: {selectedProduct.hsn_code}
                    </span>
                  )}
                  {selectedProduct.has_gst ? (
                    <span className="sku-badge" style={{ marginLeft: '8px', background: '#e0f2fe', color: '#0369a1' }}>
                      Selling GST: {selectedProduct.gst_percentage}%
                    </span>
                  ) : (
                    <span className="sku-badge" style={{ marginLeft: '8px', background: '#f1f5f9', color: '#64748b' }}>
                      Selling: Estimate / Non-GST
                    </span>
                  )}
                </div>
                <div className="btn-group">
                  <button className="secondary-btn" onClick={() => {
                    setEditProd({
                      name: selectedProduct.name || '',
                      brand_name: selectedProduct.brand_name || '',
                      category_name: selectedProduct.category_name || '',
                      hsn_code: selectedProduct.hsn_code || '',
                      selling_price: selectedProduct.selling_price || 0,
                      staff_price: selectedProduct.staff_price ?? '',
                      final_price: selectedProduct.final_price ?? ''
                    });
                    setShowEditModal(true);
                  }}>✎ Edit Product Details</button>
                  <button className="action-btn" onClick={() => setShowRestockModal(true)}>+ Restock Inventory</button>
                </div>
              </div>

              <div className="metrics-bar">
                <div className="metric">
                  <span className="label">Selling Price (MRP)</span>
                  <span className="val">₹{Number(selectedProduct.selling_price).toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="label">Staff Price</span>
                  <span className="val">₹{selectedProduct.staff_price ? Number(selectedProduct.staff_price).toLocaleString() : '—'}</span>
                </div>
                <div className="metric">
                  <span className="label">Final Price</span>
                  <span className="val text-green">₹{selectedProduct.final_price ? Number(selectedProduct.final_price).toLocaleString() : '—'}</span>
                </div>
                <div className="metric">
                  <span className="label">Total Stock</span>
                  <span className="val">{selectedProduct.total_stock}</span>
                </div>
                <div className="metric">
                  <span className="label">Booked (Pre-Orders)</span>
                  <span className="val text-orange">{selectedProduct.booked_stock || 0}</span>
                </div>
                <div className="metric">
                  <span className="label">Available</span>
                  <span className="val text-green">{selectedProduct.available_stock}</span>
                </div>
              </div>
            </div>

            <div className="tabs">
              {['overview', 'stock', 'purchases', 'sales'].map(tab => (
                <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === 'overview' && (
                <div className="info-grid">
                  <div className="card">
                    <h4>Product Info</h4>
                    <p><strong>Brand Name:</strong> {selectedProduct.brand_name || 'N/A'}</p>
                    <p><strong>Category:</strong> {selectedProduct.category_name}</p>
                    <p><strong>HSN Code:</strong> {selectedProduct.hsn_code || 'N/A'}</p>
                    <p><strong>Stock Status:</strong> <span className={`status-tag ${(selectedProduct.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{selectedProduct.status}</span></p>
                    <p><strong>Min Reorder Level:</strong> {selectedProduct.min_stock_level || 3} units</p>
                    <p><strong>Selling Type:</strong> {selectedProduct.has_gst ? `GST Invoice (${selectedProduct.gst_percentage}%)` : 'Estimate / Non-GST'}</p>
                    <p><strong>Purchase Type:</strong> {selectedProduct.has_purchase_gst ? `GST Purchase (${selectedProduct.purchase_gst_percentage}%)` : 'Estimate / Non-GST'}</p>
                  </div>
                  <div className="card">
                    <h4>Pricing & Cost Breakdown</h4>
                    <p><strong>Selling Price (MRP):</strong> ₹{Number(selectedProduct.selling_price).toFixed(2)}</p>
                    <p><strong>Staff Price:</strong> ₹{selectedProduct.staff_price ? Number(selectedProduct.staff_price).toFixed(2) : '—'}</p>
                    <p><strong>Final Price:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>₹{selectedProduct.final_price ? Number(selectedProduct.final_price).toFixed(2) : '—'}</span></p>
                    {latestPurchaseCost > 0 && selectedProduct.selling_price > 0 && (
                      <>
                        <hr style={{ margin: '10px 0', border: '0', borderTop: '1px dashed #e2e8f0' }} />
                        <p><strong>Estimated GPU:</strong> ₹{(selectedProduct.selling_price - latestPurchaseCost).toFixed(2)}</p>
                        <p><strong>Estimated PM %:</strong> {(((selectedProduct.selling_price - latestPurchaseCost) / selectedProduct.selling_price) * 100).toFixed(1)}%</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'stock' && (
                <div className="card">
                  <h4>Stock Breakdown & Fulfillment Logic</h4>
                  <p className="subtext" style={{ marginBottom: '16px' }}>
                    Tracking physical stock, booked pre-orders, and delivered inventory.
                  </p>
                  <div className="stock-breakdown">
                    <div className="stock-box">
                      <span className="num">{selectedProduct.total_stock}</span>
                      <span className="lbl">Physical On Hand</span>
                    </div>
                    <div className="stock-box orange">
                      <span className="num">{selectedProduct.booked_stock || 0}</span>
                      <span className="lbl">Booked (Pre-Orders)</span>
                    </div>
                    <div className="stock-box green">
                      <span className="num">{selectedProduct.delivered_stock}</span>
                      <span className="lbl">Delivered in Orders</span>
                    </div>
                    <div className="stock-box green">
                      <span className="num">{selectedProduct.available_stock}</span>
                      <span className="lbl">Available for Sale</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'purchases' && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4>Restock & Purchase Batches (Editable)</h4>
                    <span className="subtext">Click Edit on any batch to correct date, quantity, or price.</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Supplier</th><th>Qty</th><th>Cost/Unit</th><th>Total</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {purchasesHistory.map(p => (
                        <tr key={p.id}>
                          <td>{p.purchase_date}</td>
                          <td>{p.supplier_name || 'N/A'}</td>
                          <td><strong>{p.quantity}</strong></td>
                          <td>₹{p.purchase_price}</td>
                          <td>₹{(p.quantity * p.purchase_price).toFixed(2)}</td>
                          <td>
                            <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                              setEditingPurchase({
                                id: p.id,
                                quantity: p.quantity,
                                purchase_price: p.purchase_price,
                                purchase_date: p.purchase_date,
                                supplier_name: p.supplier_name || ''
                              });
                              setShowEditPurchaseModal(true);
                            }}>✎ Edit Batch</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'sales' && (
                <div className="card">
                  <h4>Sales History</h4>
                  <table>
                    <thead>
                      <tr><th>Order Date</th><th>Customer</th><th>Qty Sold</th><th>Sale Price</th></tr>
                    </thead>
                    <tbody>
                      {salesHistory.map(s => (
                        <tr key={s.id}>
                          <td>{new Date(s.sales?.created_at).toLocaleDateString()}</td>
                          <td>{s.sales?.customers?.name || 'Walk-in'}</td>
                          <td>{s.quantity}</td>
                          <td>₹{s.unit_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="products-view-container">
            <div className="sticky-top-container">
              <div className="top-bar">
                <div>
                  <h1>Products Catalog</h1>
                  <p className="subtext" style={{ marginTop: '2px' }}>
                    Total Catalog Count: <strong>{totalCount}</strong> product{totalCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button className="primary-btn" onClick={() => setShowAddModal(true)}>+ Add Product</button>
              </div>

              {/* FILTER CONTROL PANEL */}
              <div className="card filter-card">
                <div className="filter-grid">
                  <div className="filter-item flex-2">
                    <label>Search Products</label>
                    <form onSubmit={handleSearchSubmit} className="search-form-group">
                      <input 
                        type="text"
                        placeholder="Type Name, SKU, Brand, HSN or Category & press Enter..." 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                        className="search-input" 
                      />
                      <button type="submit" className="search-btn">
                        🔍 Search
                      </button>
                      {appliedSearch && (
                        <button type="button" onClick={handleClearSearch} className="clear-btn">
                          ✕ Clear
                        </button>
                      )}
                    </form>
                  </div>

                  <div className="filter-item">
                    <label>Sort By</label>
                    <select value={sortBy} onChange={(e) => {setSortBy(e.target.value); setCurrentPage(1);}}>
                      <option value="name_asc">Name (A - Z)</option>
                      <option value="name_desc">Name (Z - A)</option>
                      <option value="price_asc">Price (Low to High)</option>
                      <option value="price_desc">Price (High to Low)</option>
                      <option value="stock_asc">Stock (Low to High)</option>
                      <option value="stock_desc">Stock (High to Low)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* PRODUCTS TABLE CONTAINER WITH INNER SCROLL & BOOKED COLUMN */}
            <div className="table-wrapper card">
              {loading ? (
                <p className="loading-text">Loading catalog from database...</p>
              ) : products.length === 0 ? (
                <p className="empty-text">No products match the selected criteria.</p>
              ) : (
                <>
                  <div className="table-scroll-area">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Product Name</th>
                          <th>Brand</th>
                          <th>Category</th>
                          <th>Selling Price</th>
                          <th>Tax / HSN</th>
                          <th>Booked (Pre-Orders)</th>
                          <th>Available Stock</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} className="clickable-row" onClick={() => setSelectedProduct(p)}>
                            <td><strong>{p.sku}</strong></td>
                            <td>{p.name}</td>
                            <td>{p.brand_name || '—'}</td>
                            <td>{p.category_name}</td>
                            <td>₹{Number(p.selling_price).toLocaleString()}</td>
                            <td>
                              {p.has_gst ? (
                                <span style={{ color: '#0369a1', fontWeight: '500' }}>
                                  GST ({p.gst_percentage}%) {p.hsn_code ? `| HSN: ${p.hsn_code}` : ''}
                                </span>
                              ) : (
                                <span style={{ color: '#64748b' }}>Estimate</span>
                              )}
                            </td>
                            <td>
                              <span style={{ color: p.booked_stock > 0 ? '#d97706' : '#64748b', fontWeight: p.booked_stock > 0 ? 'bold' : 'normal' }}>
                                {p.booked_stock || 0} units
                              </span>
                            </td>
                            <td><strong>{p.available_stock}</strong> <span className="subtext">({p.total_stock} total)</span></td>
                            <td>
                              <span className={`status-tag ${(p.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION BAR */}
                  <div className="pagination-bar">
                    <div className="pagination-info">
                      <span>Show:</span>
                      <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="page-size-select">
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                      </select>
                      <span>
                        Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> - <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong>
                      </span>
                    </div>

                    <div className="pagination-controls">
                      <button 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="page-btn"
                      >
                        ◀ Previous
                      </button>

                      <span className="page-indicator">
                        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                      </span>

                      <button 
                        disabled={currentPage >= totalPages} 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="page-btn"
                      >
                        Next ▶
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* MODALS */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add New Product Catalog Entry</h3>
              <form onSubmit={handleCreateProduct}>
                <div className="form-group">
                  <label>SKU Code <span className="required">*</span></label>
                  <input placeholder="e.g. SOF-001" value={newProd.sku} onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label>Product Name <span className="required">*</span></label>
                  <input placeholder="e.g. Basmati Rice 5kg" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Brand Name</label>
                    <input placeholder="e.g. Fortune / Samsung" value={newProd.brand_name} onChange={(e) => setNewProd({ ...newProd, brand_name: e.target.value })} />
                  </div>

                  <div className="form-group">
                    <label>Category <span className="required">*</span></label>
                    <input placeholder="e.g. Groceries" value={newProd.category_name} onChange={(e) => setNewProd({ ...newProd, category_name: e.target.value })} required />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Initial Qty <span className="required">*</span></label>
                    <input type="number" placeholder="0" value={newProd.initial_quantity} onChange={(e) => setNewProd({ ...newProd, initial_quantity: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Purchase Price (₹) <span className="required">*</span></label>
                    <input type="number" step="0.01" placeholder="0.00" value={newProd.purchase_price} onChange={(e) => handleNewProdPriceChange('purchase_price', e.target.value)} required />
                  </div>
                </div>

                <div className="tax-panel purchase-tax-panel">
                  <label className="panel-title">Purchase Tax Type</label>
                  <div className="segmented-control">
                    <button type="button" className={newProd.purchase_tax_mode === 'estimate' ? 'active' : ''} onClick={() => setNewProd({ ...newProd, purchase_tax_mode: 'estimate' })}>Estimate / Non-GST</button>
                    <button type="button" className={newProd.purchase_tax_mode === 'gst' ? 'active' : ''} onClick={() => setNewProd({ ...newProd, purchase_tax_mode: 'gst' })}>Tax Invoice (GST)</button>
                  </div>

                  {newProd.purchase_tax_mode === 'gst' && (
                    <div className="tax-details">
                      <label>Purchase GST Rate (%)</label>
                      <select value={newProd.purchase_gst_percentage} onChange={(e) => setNewProd({ ...newProd, purchase_gst_percentage: e.target.value })}>
                        <option value="0">0% (Zero-rated)</option>
                        <option value="5">5% GST</option>
                        <option value="12">12% GST</option>
                        <option value="18">18% GST</option>
                        <option value="28">28% GST</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Selling Price (MRP) (₹) <span className="required">*</span></label>
                    <input type="number" step="0.01" placeholder="0.00" value={newProd.selling_price} onChange={(e) => handleNewProdPriceChange('selling_price', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Margin % <span className="required">*</span></label>
                    <input type="number" step="0.1" placeholder="0.0" value={newProd.margin_pct} onChange={(e) => handleNewProdPriceChange('margin_pct', e.target.value)} required />
                  </div>
                </div>

                <div className="tax-panel selling-tax-panel">
                  <label className="panel-title">Selling Tax Type</label>
                  <div className="segmented-control">
                    <button type="button" className={newProd.selling_tax_mode === 'estimate' ? 'active' : ''} onClick={() => setNewProd({ ...newProd, selling_tax_mode: 'estimate' })}>Estimate / Non-GST</button>
                    <button type="button" className={newProd.selling_tax_mode === 'gst' ? 'active' : ''} onClick={() => setNewProd({ ...newProd, selling_tax_mode: 'gst' })}>Tax Invoice (GST)</button>
                  </div>

                  {newProd.selling_tax_mode === 'gst' && (
                    <div className="tax-details">
                      <div className="form-row" style={{ marginTop: '6px' }}>
                        <div className="form-group">
                          <label>HSN Code</label>
                          <input placeholder="e.g. 1006 / 8517" value={newProd.hsn_code} onChange={(e) => setNewProd({ ...newProd, hsn_code: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Selling GST Rate (%)</label>
                          <select value={newProd.gst_percentage} onChange={(e) => setNewProd({ ...newProd, gst_percentage: e.target.value })}>
                            <option value="0">0% (Zero-rated)</option>
                            <option value="5">5% GST</option>
                            <option value="12">12% GST</option>
                            <option value="18">18% GST</option>
                            <option value="28">28% GST</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Purchase Date <span className="required">*</span></label>
                    <input type="date" value={newProd.purchase_date} onChange={(e) => setNewProd({ ...newProd, purchase_date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Min Stock Alert Level <span className="required">*</span></label>
                    <input type="number" placeholder="3" value={newProd.min_stock_level} onChange={(e) => setNewProd({ ...newProd, min_stock_level: e.target.value })} required />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button type="submit" className="action-btn">Save Product</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Product Modal (Excluding Total Stock) */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Edit Product: {selectedProduct.name}</h3>
              <p className="subtext" style={{ marginBottom: '10px' }}>
                SKU: <strong>{selectedProduct.sku}</strong> | Total Stock: <strong>{selectedProduct.total_stock}</strong> (Manage via Purchases tab)
              </p>
              <form onSubmit={handleUpdateProduct}>
                <div className="form-group">
                  <label>Product Name <span className="required">*</span></label>
                  <input type="text" value={editProd.name} onChange={(e) => setEditProd({ ...editProd, name: e.target.value })} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Brand Name</label>
                    <input type="text" placeholder="Brand..." value={editProd.brand_name} onChange={(e) => setEditProd({ ...editProd, brand_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Category <span className="required">*</span></label>
                    <input type="text" value={editProd.category_name} onChange={(e) => setEditProd({ ...editProd, category_name: e.target.value })} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>HSN Code</label>
                  <input type="text" placeholder="HSN..." value={editProd.hsn_code} onChange={(e) => setEditProd({ ...editProd, hsn_code: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Selling Price (MRP) (₹) <span className="required">*</span></label>
                    <input type="number" step="0.01" value={editProd.selling_price} onChange={(e) => setEditProd({ ...editProd, selling_price: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Staff Price (₹)</label>
                    <input type="number" step="0.01" placeholder="Staff tier price..." value={editProd.staff_price} onChange={(e) => setEditProd({ ...editProd, staff_price: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Final Price (Lowest Floor Discount) (₹)</label>
                  <input type="number" step="0.01" placeholder="Absolute final discount price..." value={editProd.final_price} onChange={(e) => setEditProd({ ...editProd, final_price: e.target.value })} />
                </div>

                <div className="modal-actions">
                  <button type="submit" className="action-btn">Save Changes</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Purchase Batch Modal */}
        {showEditPurchaseModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Edit Purchase Batch Entry</h3>
              <form onSubmit={handleUpdatePurchaseBatch}>
                <div className="form-group">
                  <label>Purchase Date <span className="required">*</span></label>
                  <input type="date" value={editingPurchase.purchase_date} onChange={(e) => setEditingPurchase({ ...editingPurchase, purchase_date: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label>Supplier Name</label>
                  <input type="text" value={editingPurchase.supplier_name} onChange={(e) => setEditingPurchase({ ...editingPurchase, supplier_name: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity <span className="required">*</span></label>
                    <input type="number" step="0.001" value={editingPurchase.quantity} onChange={(e) => setEditingPurchase({ ...editingPurchase, quantity: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Purchase Price per Unit (₹) <span className="required">*</span></label>
                    <input type="number" step="0.01" value={editingPurchase.purchase_price} onChange={(e) => setEditingPurchase({ ...editingPurchase, purchase_price: e.target.value })} required />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="submit" className="action-btn">Update Batch & Stock</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowEditPurchaseModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showRestockModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Restock Batch: {selectedProduct.name}</h3>
              <form onSubmit={handleRestock}>
                <div className="form-group">
                  <label>Quantity Received <span className="required">*</span></label>
                  <input type="number" placeholder="Enter qty" value={restock.quantity} onChange={(e) => setRestock({ ...restock, quantity: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label>Purchase Cost Per Unit (₹) <span className="required">*</span></label>
                  <input type="number" step="0.01" placeholder="Enter unit cost" value={restock.purchase_price} onChange={(e) => setRestock({ ...restock, purchase_price: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label>Supplier Name</label>
                  <input placeholder="Optional supplier name" value={restock.supplier_name} onChange={(e) => setRestock({ ...restock, supplier_name: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Purchase Date <span className="required">*</span></label>
                  <input type="date" value={restock.purchase_date} onChange={(e) => setRestock({ ...restock, purchase_date: e.target.value })} required />
                </div>

                <div className="modal-actions">
                  <button type="submit" className="action-btn">Confirm Restock</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowRestockModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

        @media (max-width: 768px) {
          .content { padding: 16px; padding-bottom: 90px; }
        }

        .products-view-container { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
        .sticky-top-container { flex-shrink: 0; margin-bottom: 16px; }

        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .primary-btn, .action-btn { background: #0f172a; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .secondary-btn { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn-group { display: flex; gap: 10px; }

        .filter-card { background: #ffffff; margin-bottom: 0px; }
        .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
        .filter-item { display: flex; flex-direction: column; gap: 4px; }
        .filter-item.flex-2 { grid-column: span 2; }
        @media (max-width: 640px) {
          .filter-item.flex-2 { grid-column: span 1; }
        }
        .filter-item label { font-size: 12px; font-weight: 600; color: #475569; }
        .filter-item select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }

        .search-form-group { display: flex; gap: 8px; align-items: center; width: 100%; }
        .search-input { flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box; }
        .search-input:focus { outline: none; border-color: #0f172a; }
        .search-btn { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; white-space: nowrap; }
        .clear-btn { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; }
        .clear-btn:hover { background: #e2e8f0; }

        .loading-text, .empty-text { text-align: center; color: #64748b; padding: 40px 0; }
        
        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; margin-top: 0 !important; }
        .table-scroll-area { flex: 1; overflow: auto; }

        table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 14px; }
        th, td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; color: #475569; position: sticky; top: 0; z-index: 10; }
        .clickable-row { cursor: pointer; transition: background 0.15s; }
        .clickable-row:hover { background: #f8fafc; }
        .subtext { font-size: 12px; color: #94a3b8; }
        .status-tag { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
        .status-tag.healthy { background: #dcfce7; color: #15803d; }
        .status-tag.low { background: #fef9c3; color: #a16207; }
        .status-tag.out-of-stock { background: #fee2e2; color: #b91c1c; }

        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-top: 1px solid #e2e8f0; background: #fff; font-size: 13px; flex-wrap: wrap; gap: 10px; flex-shrink: 0; }
        .pagination-info { display: flex; align-items: center; gap: 10px; color: #475569; }
        .page-size-select { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; }
        .pagination-controls { display: flex; align-items: center; gap: 12px; }
        .page-btn { padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 12px; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-indicator { color: #475569; }

        .back-btn { background: none; border: none; color: #0284c7; cursor: pointer; margin-bottom: 12px; font-size: 14px; padding: 0; }
        .header-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
        .header-main { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .sku-badge { background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #475569; }
        .metrics-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        .metric { display: flex; flex-direction: column; }
        .metric .label { font-size: 12px; color: #64748b; }
        .metric .val { font-size: 18px; font-weight: bold; }
        .text-green { color: #16a34a; }
        .text-orange { color: #d97706; }

        .tabs { display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px; }
        .tab { background: none; border: none; padding: 10px 16px; cursor: pointer; color: #64748b; font-weight: 500; border-bottom: 2px solid transparent; }
        .tab.active { color: #0f172a; border-bottom-color: #0f172a; }

        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        .stock-breakdown { display: flex; gap: 16px; margin-top: 12px; }
        .stock-box { flex: 1; padding: 16px; background: #f8fafc; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; }
        .stock-box.green { background: #f0fdf4; border-color: #bbf7d0; }
        .stock-box.orange { background: #fffbeb; border-color: #fde68a; }
        .stock-box .num { display: block; font-size: 24px; font-weight: bold; }
        .stock-box .lbl { font-size: 12px; color: #64748b; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal { background: white; padding: 24px; border-radius: 8px; width: 480px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        
        .form-group { display: flex; flex-direction: column; gap: 4px; flex: 1; margin-bottom: 10px; }
        .form-group label { font-size: 13px; font-weight: 600; color: #334155; }
        .required { color: #ef4444; }

        .modal input, .tax-details select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; width: 100%; }
        .modal input:focus, .tax-details select:focus { outline: none; border-color: #0f172a; }
        
        .tax-panel { padding: 12px; border-radius: 6px; margin-bottom: 10px; }
        .purchase-tax-panel { background: #fefce8; border: 1px solid #fef08a; }
        .selling-tax-panel { background: #f0f9ff; border: 1px solid #bae6fd; }
        .panel-title { font-size: 12px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px; }
        
        .segmented-control { display: flex; background: #e2e8f0; padding: 2px; border-radius: 6px; gap: 2px; }
        .segmented-control button { flex: 1; padding: 8px; border: none; background: transparent; font-size: 12px; font-weight: 600; color: #64748b; border-radius: 4px; cursor: pointer; transition: all 0.15s ease; }
        .segmented-control button.active { background: white; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        .tax-details { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
        .tax-details label { font-size: 12px; font-weight: 600; color: #475569; }

        .form-row { display: flex; gap: 12px; }
        .modal-actions { display: flex; gap: 10px; margin-top: 10px; }
        .cancel-btn { flex: 1; padding: 10px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
      `}</style>
    </div>
  );
}