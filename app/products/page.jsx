'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchases, setPurchases] = useState({});
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null); // For Restock Modal/Form

  const [form, setForm] = useState({
    name: '',
    sku: '',
    category_id: '',
    purchase_price: '',
    delivery_margin_pct: '',
    selling_price: '',
    quantity: '',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) setCategories(catData);

    const { data: prodData } = await supabase
      .from('productsinfo')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
    if (prodData) setProducts(prodData);

    const { data: purchaseData } = await supabase
      .from('product_purchases')
      .select('*')
      .order('purchase_date', { ascending: false });

    if (purchaseData) {
      const grouped = purchaseData.reduce((acc, p) => {
        acc[p.product_id] = acc[p.product_id] || [];
        acc[p.product_id].push(p);
        return acc;
      }, {});
      setPurchases(grouped);
    }
  };

  // Bidirectional Calculation Logic
  const handlePurchasePriceChange = (val) => {
    const cost = Number(val) || 0;
    const pct = Number(form.delivery_margin_pct) || 0;
    const calcSelling = cost + (cost * (pct / 100));
    setForm({ ...form, purchase_price: val, selling_price: calcSelling ? calcSelling.toFixed(2) : '' });
  };

  const handleMarginChange = (val) => {
    const pct = Number(val) || 0;
    const cost = Number(form.purchase_price) || 0;
    const calcSelling = cost + (cost * (pct / 100));
    setForm({ ...form, delivery_margin_pct: val, selling_price: calcSelling ? calcSelling.toFixed(2) : '' });
  };

  const handleSellingPriceChange = (val) => {
    const sell = Number(val) || 0;
    const cost = Number(form.purchase_price) || 0;
    let calcPct = 0;
    if (cost > 0) {
      calcPct = ((sell - cost) / cost) * 100;
    }
    setForm({ ...form, selling_price: val, delivery_margin_pct: calcPct ? calcPct.toFixed(2) : '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: userData } = await supabase.from('users').select('shop_id').single();
    const shopId = userData?.shop_id;

    const purchaseCost = Number(form.purchase_price);
    const newQty = Number(form.quantity);

    if (selectedProduct) {
      // RESTOCK EXISTING PRODUCT
      const currentStock = Number(selectedProduct.stock_quantity) || 0;
      const currentAvgCost = Number(selectedProduct.avg_cost_price) || purchaseCost;

      // Weighted Average Cost Formula: ((Current Stock * Current Avg Cost) + (New Qty * New Purchase Cost)) / Total Stock
      const totalStock = currentStock + newQty;
      const newAvgCost = totalStock > 0 ? ((currentStock * currentAvgCost) + (newQty * purchaseCost)) / totalStock : purchaseCost;

      // 1. Update Product
      await supabase.from('productsinfo').update({
        stock_quantity: totalStock,
        avg_cost_price: Number(newAvgCost.toFixed(2)),
        selling_price: Number(form.selling_price),
        delivery_margin_pct: Number(form.delivery_margin_pct)
      }).eq('id', selectedProduct.id);

      // 2. Log Purchase Batch
      await supabase.from('product_purchases').insert([{
        shop_id: shopId,
        product_id: selectedProduct.id,
        purchase_price: purchaseCost,
        quantity: newQty,
        purchase_date: form.purchase_date
      }]);

      alert('Product restocked and Average Cost updated!');
      setSelectedProduct(null);
    } else {
      // NEW PRODUCT CREATION
      const { data: product, error: prodErr } = await supabase
        .from('productsinfo')
        .insert([{
          shop_id: shopId,
          name: form.name,
          sku: form.sku,
          category_id: form.category_id || null,
          selling_price: Number(form.selling_price),
          delivery_margin_pct: Number(form.delivery_margin_pct),
          avg_cost_price: purchaseCost,
          stock_quantity: newQty
        }])
        .select()
        .single();

      if (prodErr) return alert(`Error creating product: ${prodErr.message}`);

      await supabase.from('product_purchases').insert([{
        shop_id: shopId,
        product_id: product.id,
        purchase_price: purchaseCost,
        quantity: newQty,
        purchase_date: form.purchase_date
      }]);
    }

    setForm({
      name: '', sku: '', category_id: '', purchase_price: '',
      delivery_margin_pct: '', selling_price: '', quantity: '',
      purchase_date: new Date().toISOString().split('T')[0]
    });
    loadData();
  };

  const handleSelectRestock = (p) => {
    setSelectedProduct(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category_id: p.category_id || '',
      purchase_price: p.avg_cost_price || '',
      delivery_margin_pct: p.delivery_margin_pct || '',
      selling_price: p.selling_price || '',
      quantity: '',
      purchase_date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="header-flex">
          <h1>{selectedProduct ? `Restock: ${selectedProduct.name}` : 'Catalog & Inventory'}</h1>
          {selectedProduct && (
            <button className="cancel-btn" onClick={() => { setSelectedProduct(null); setForm({ name: '', sku: '', category_id: '', purchase_price: '', delivery_margin_pct: '', selling_price: '', quantity: '', purchase_date: new Date().toISOString().split('T')[0] }); }}>
              Cancel Restock
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <input placeholder="Item Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!!selectedProduct} required />
          <input placeholder="SKU Code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!!selectedProduct} required />
          
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} disabled={!!selectedProduct}>
            <option value="">Select Category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <input type="number" step="0.01" placeholder="Purchase Cost (₹)" value={form.purchase_price} onChange={(e) => handlePurchasePriceChange(e.target.value)} required />
          <input type="number" step="0.01" placeholder="Delivery Margin %" value={form.delivery_margin_pct} onChange={(e) => handleMarginChange(e.target.value)} />
          <input type="number" step="0.01" placeholder="Selling Price (₹)" value={form.selling_price} onChange={(e) => handleSellingPriceChange(e.target.value)} required />
          <input type="number" placeholder="Restock/Initial Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} required />

          <button type="submit" className="submit-btn">
            {selectedProduct ? 'Update Stock & Recalculate WAC' : 'Add New Product'}
          </button>
        </form>

        <div className="search-bar">
          <input placeholder="Search products by Name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Selling Price</th>
                <th>Avg Cost (WAC)</th>
                <th>Margin %</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="subtext">SKU: {p.sku}</div>
                  </td>
                  <td>{p.categories?.name || 'Uncategorized'}</td>
                  <td><strong>{p.stock_quantity}</strong></td>
                  <td>₹{p.selling_price}</td>
                  <td>₹{p.avg_cost_price || 0}</td>
                  <td>{p.delivery_margin_pct || 0}%</td>
                  <td>
                    <button className="restock-btn" onClick={() => handleSelectRestock(p)}>
                      Restock / Edit Price
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .form-grid { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; border: 1px solid #e2e8f0; }
        input, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px; width: 100%; box-sizing: border-box; }
        .search-bar { margin-bottom: 16px; }
        :global(.submit-btn) { grid-column: 1 / -1; padding: 12px; background: #16a34a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .cancel-btn { background: #64748b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
        .restock-btn { background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .table-wrapper { overflow-x: auto; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; min-width: 700px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f8fafc; }
        .subtext { font-size: 12px; color: #64748b; }
        @media (max-width: 768px) { .layout { flex-direction: column; } .content { padding: 16px; } }
      `}</style>
    </div>
  );
}