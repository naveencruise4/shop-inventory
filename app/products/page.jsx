'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);

  // Forms State
  const [newProd, setNewProd] = useState({
    sku: '',
    name: '',
    category_name: 'General',
    initial_quantity: '0',
    purchase_price: '',
    selling_price: '',
    margin_pct: '',
    purchase_date: new Date().toISOString().split('T')[0],
    min_stock_level: 3
  });

  const [editProd, setEditProd] = useState({ selling_price: '', margin_pct: '' });
  const [restock, setRestock] = useState({ quantity: '', purchase_price: '', supplier_name: '', purchase_date: new Date().toISOString().split('T')[0] });

  // Tab Data
  const [purchasesHistory, setPurchasesHistory] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      if (activeTab === 'purchases') fetchPurchaseHistory(selectedProduct.id);
      if (activeTab === 'sales') fetchSalesHistory(selectedProduct.sku);
    }
  }, [selectedProduct, activeTab]);

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();

    if (!appUser?.shop_id) return;

    const { data, error } = await supabase
      .from('vw_product_stock')
      .select('*')
      .eq('shop_id', appUser.shop_id);

    if (data) setProducts(data);
    if (error) console.error('Error fetching products:', error);
  };

  const fetchPurchaseHistory = async (productId) => {
    const { data } = await supabase
      .from('product_purchases')
      .select('*')
      .eq('product_id', productId)
      .order('purchase_date', { ascending: false });
    if (data) setPurchasesHistory(data);
  };

  const fetchSalesHistory = async (sku) => {
    const { data } = await supabase
      .from('sale_items')
      .select('*, sales(created_at, sale_status, customer_id, customers(name))')
      .eq('sku', sku)
      .order('created_at', { ascending: false });
    if (data) setSalesHistory(data);
  };

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

  const handleEditPriceChange = (field, val) => {
    const cost = Number(selectedProduct?.avg_cost_price || 0);
    if (field === 'selling_price') {
      const sell = Number(val);
      const margin = (sell && cost) ? (((sell - cost) / sell) * 100).toFixed(1) : '';
      setEditProd({ selling_price: val, margin_pct: margin });
    } else if (field === 'margin_pct') {
      const margin = Number(val);
      const sell = (cost && margin < 100) ? (cost / (1 - margin / 100)).toFixed(2) : editProd.selling_price;
      setEditProd({ margin_pct: val, selling_price: sell });
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      alert('You are not logged in. Please log in again.');
      return;
    }

    const { data: appUser, error: userError } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();

    if (userError || !appUser?.shop_id) {
      alert('Unable to load your assigned shop.');
      return;
    }

    const currentShopId = appUser.shop_id;
    const initQty = Number(newProd.initial_quantity || 0);
    const costPrice = Number(newProd.purchase_price || 0);

    const { data: prodData, error: prodErr } = await supabase.from('productsinfo').insert([{
      shop_id: currentShopId,
      sku: newProd.sku,
      name: newProd.name,
      category_name: newProd.category_name,
      selling_price: Number(newProd.selling_price),
      min_stock_level: Number(newProd.min_stock_level),
      stock_quantity: initQty,
      total_stock: initQty,
      avg_cost_price: costPrice
    }]).select().single();

    if (prodErr) {
      alert(`Error creating product: ${prodErr.message}`);
      return;
    }

    if (initQty > 0 && prodData) {
      await supabase.from('product_purchases').insert([{
        shop_id: currentShopId,
        product_id: prodData.id,
        quantity: initQty,
        purchase_price: costPrice,
        purchase_date: newProd.purchase_date
      }]);
    }

    setShowAddModal(false);
    setNewProd({ sku: '', name: '', category_name: 'General', initial_quantity: '0', purchase_price: '', selling_price: '', margin_pct: '', purchase_date: new Date().toISOString().split('T')[0], min_stock_level: 3 });
    fetchProducts();
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const { error } = await supabase.from('productsinfo').update({
      selling_price: Number(editProd.selling_price)
    }).eq('id', selectedProduct.id);

    if (!error) {
      setShowEditModal(false);
      const { data: updated } = await supabase.from('vw_product_stock').select('*').eq('id', selectedProduct.id).single();
      if (updated) setSelectedProduct(updated);
      fetchProducts();
    }
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
    fetchProducts();
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        {selectedProduct ? (
          <div className="details-wrapper">
            <button className="back-btn" onClick={() => setSelectedProduct(null)}>← Back to Products</button>
            
            <div className="header-card">
              <div className="header-main">
                <div>
                  <h2>{selectedProduct.name}</h2>
                  <span className="sku-badge">SKU: {selectedProduct.sku}</span>
                </div>
                <div className="btn-group">
                  <button className="secondary-btn" onClick={() => {
                    const cost = selectedProduct.avg_cost_price || 0;
                    const sell = selectedProduct.selling_price || 0;
                    const margin = (sell && cost) ? (((sell - cost) / sell) * 100).toFixed(1) : '';
                    setEditProd({ selling_price: sell, margin_pct: margin });
                    setShowEditModal(true);
                  }}>✎ Edit Price / Margin</button>
                  <button className="action-btn" onClick={() => setShowRestockModal(true)}>+ Restock Inventory</button>
                </div>
              </div>

              <div className="metrics-bar">
                <div className="metric">
                  <span className="label">Selling Price</span>
                  <span className="val">₹{Number(selectedProduct.selling_price).toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="label">Avg Cost Price</span>
                  <span className="val">₹{Number(selectedProduct.avg_cost_price).toLocaleString()}</span>
                </div>
                <div className="metric">
                  <span className="label">Total Stock</span>
                  <span className="val">{selectedProduct.total_stock}</span>
                </div>
                <div className="metric">
                  <span className="label">Delivered</span>
                  <span className="val text-green">{selectedProduct.delivered_stock}</span>
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
                    <p><strong>Category:</strong> {selectedProduct.category_name}</p>
                    <p><strong>Stock Status:</strong> <span className={`status-tag ${selectedProduct.status?.toLowerCase().replace(/\s+/g, '-')}`}>{selectedProduct.status}</span></p>
                    <p><strong>Min Reorder Level:</strong> {selectedProduct.min_stock_level || 3} units</p>
                  </div>
                  <div className="card">
                    <h4>Margin Analysis</h4>
                    {selectedProduct.selling_price > 0 && (
                      <>
                        <p><strong>Gross Profit/Unit:</strong> ₹{(selectedProduct.selling_price - selectedProduct.avg_cost_price).toFixed(2)}</p>
                        <p><strong>Margin %:</strong> {(((selectedProduct.selling_price - selectedProduct.avg_cost_price) / selectedProduct.selling_price) * 100).toFixed(1)}%</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'stock' && (
                <div className="card">
                  <h4>Stock Breakdown & Fulfillment Logic</h4>
                  <p className="subtext" style={{ marginBottom: '16px' }}>
                    Items stay in <strong>Delivered</strong> status while orders are Pending or Confirmed. Once an order is marked as <strong>Delivered/Completed</strong>, the stock is officially finalized and deducted from total physical inventory.
                  </p>
                  <div className="stock-breakdown">
                    <div className="stock-box">
                      <span className="num">{selectedProduct.total_stock}</span>
                      <span className="lbl">Physical On Hand</span>
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
                  <h4>Restock & Purchase Batches</h4>
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Supplier</th><th>Qty</th><th>Cost/Unit</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {purchasesHistory.map(p => (
                        <tr key={p.id}>
                          <td>{p.purchase_date}</td>
                          <td>{p.supplier_name || 'N/A'}</td>
                          <td>{p.quantity}</td>
                          <td>₹{p.purchase_price}</td>
                          <td>₹{(p.quantity * p.purchase_price).toFixed(2)}</td>
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
          <>
            <div className="top-bar">
              <h1>Products</h1>
              <button className="primary-btn" onClick={() => setShowAddModal(true)}>+ Add Product</button>
            </div>

            <div className="filter-bar">
              <input 
                placeholder="Search by Product Name, SKU, Category..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="search-input" 
              />
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Selling Price</th>
                    <th>Available Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="clickable-row" onClick={() => setSelectedProduct(p)}>
                      <td><strong>{p.sku}</strong></td>
                      <td>{p.name}</td>
                      <td>{p.category_name}</td>
                      <td>₹{Number(p.selling_price).toLocaleString()}</td>
                      <td><strong>{p.available_stock}</strong> <span className="subtext">({p.total_stock} total)</span></td>
                      <td>
                        <span className={`status-tag ${p.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

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

                <div className="form-group">
                  <label>Category <span className="required">*</span></label>
                  <input placeholder="e.g. Groceries" value={newProd.category_name} onChange={(e) => setNewProd({ ...newProd, category_name: e.target.value })} required />
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

                <div className="form-row">
                  <div className="form-group">
                    <label>Selling Price (₹) <span className="required">*</span></label>
                    <input type="number" step="0.01" placeholder="0.00" value={newProd.selling_price} onChange={(e) => handleNewProdPriceChange('selling_price', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Margin % <span className="required">*</span></label>
                    <input type="number" step="0.1" placeholder="0.0" value={newProd.margin_pct} onChange={(e) => handleNewProdPriceChange('margin_pct', e.target.value)} required />
                  </div>
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

        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Edit Price: {selectedProduct.name}</h3>
              <p className="subtext" style={{ marginBottom: '10px' }}>Current Base Cost Price: ₹{selectedProduct.avg_cost_price}</p>
              <form onSubmit={handleUpdateProduct}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Selling Price (₹) <span className="required">*</span></label>
                    <input type="number" step="0.01" value={editProd.selling_price} onChange={(e) => handleEditPriceChange('selling_price', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Margin % <span className="required">*</span></label>
                    <input type="number" step="0.1" value={editProd.margin_pct} onChange={(e) => handleEditPriceChange('margin_pct', e.target.value)} required />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="action-btn">Update Price</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
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
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { 
            flex: 1; 
            padding: 24px; 
            box-sizing: border-box; 
            }

            @media (max-width: 768px) {
            .content {
                padding: 16px;
                padding-bottom: 90px; /* Leaves space so bottom bar doesn't overlap tables or buttons */
            }
        }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .primary-btn, .action-btn { background: #0f172a; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .secondary-btn { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn-group { display: flex; gap: 10px; }
        .filter-bar { margin-bottom: 16px; }
        .search-input { width: 100%; max-width: 400px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
        th, td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; color: #475569; }
        .clickable-row { cursor: pointer; transition: background 0.15s; }
        .clickable-row:hover { background: #f8fafc; }
        .subtext { font-size: 12px; color: #94a3b8; }
        
        .status-tag { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .status-tag.healthy { background: #dcfce7; color: #15803d; }
        .status-tag.low { background: #fef9c3; color: #a16207; }
        .status-tag.out-of-stock { background: #fee2e2; color: #b91c1c; }

        .back-btn { background: none; border: none; color: #0284c7; cursor: pointer; margin-bottom: 12px; font-size: 14px; padding: 0; }
        .header-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
        .header-main { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .sku-badge { background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #475569; }
        .metrics-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        .metric { display: flex; flex-direction: column; }
        .metric .label { font-size: 12px; color: #64748b; }
        .metric .val { font-size: 18px; font-weight: bold; }
        .text-green { color: #16a34a; }

        .tabs { display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px; }
        .tab { background: none; border: none; padding: 10px 16px; cursor: pointer; color: #64748b; font-weight: 500; border-bottom: 2px solid transparent; }
        .tab.active { color: #0f172a; border-bottom-color: #0f172a; }

        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        .stock-breakdown { display: flex; gap: 16px; margin-top: 12px; }
        .stock-box { flex: 1; padding: 16px; background: #f8fafc; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; }
        .stock-box.green { background: #f0fdf4; border-color: #bbf7d0; }
        .stock-box .num { display: block; font-size: 24px; font-weight: bold; }
        .stock-box .lbl { font-size: 12px; color: #64748b; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal { background: white; padding: 24px; border-radius: 8px; width: 480px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        
        .form-group { display: flex; flex-direction: column; gap: 4px; flex: 1; margin-bottom: 10px; }
        .form-group label { font-size: 13px; font-weight: 600; color: #334155; }
        .required { color: #ef4444; }

        .modal input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; width: 100%; }
        .modal input:focus { outline: none; border-color: #0f172a; }
        
        .form-row { display: flex; gap: 12px; }
        .modal-actions { display: flex; gap: 10px; margin-top: 10px; }
        .cancel-btn { flex: 1; padding: 10px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
      `}</style>
    </div>
  );
}