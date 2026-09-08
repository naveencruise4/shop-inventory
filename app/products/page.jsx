'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchases, setPurchases] = useState({});
  
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category_id: '',
    selling_price: '',
    purchase_price: '',
    quantity: '',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load Categories
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) setCategories(catData);

    // Load Products with category details
    const { data: prodData } = await supabase
      .from('productsinfo')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
    
    if (prodData) setProducts(prodData);

    // Load Purchase Batch History
    const { data: purchaseData } = await supabase
      .from('product_purchases')
      .select('*')
      .order('purchase_date', { ascending: false });

    if (purchaseData) {
      // Group purchases by product_id
      const grouped = purchaseData.reduce((acc, p) => {
        acc[p.product_id] = acc[p.product_id] || [];
        acc[p.product_id].push(p);
        return acc;
      }, {});
      setPurchases(grouped);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const { data: userData } = await supabase.from('users').select('shop_id').single();
    const shopId = userData?.shop_id;

    // 1. Insert or find product
    const { data: product, error: prodErr } = await supabase
      .from('productsinfo')
      .insert([{
        shop_id: shopId,
        name: form.name,
        sku: form.sku,
        category_id: form.category_id || null,
        selling_price: Number(form.selling_price),
        stock_quantity: Number(form.quantity)
      }])
      .select()
      .single();

    if (prodErr) return alert(`Error creating product: ${prodErr.message}`);

    // 2. Insert initial purchase batch record
    const { error: batchErr } = await supabase
      .from('product_purchases')
      .insert([{
        shop_id: shopId,
        product_id: product.id,
        purchase_price: Number(form.purchase_price),
        quantity: Number(form.quantity),
        purchase_date: form.purchase_date
      }]);

    if (batchErr) alert(`Error saving purchase log: ${batchErr.message}`);

    setForm({
      name: '',
      sku: '',
      category_id: '',
      selling_price: '',
      purchase_price: '',
      quantity: '',
      purchase_date: new Date().toISOString().split('T')[0]
    });

    loadData();
  };

  // Calculate Weighted Average Cost (WAC)
  const calculateAvgPrice = (prodId) => {
    const list = purchases[prodId] || [];
    if (list.length === 0) return 0;

    const totalCost = list.reduce((sum, item) => sum + (Number(item.purchase_price) * Number(item.quantity)), 0);
    const totalQty = list.reduce((sum, item) => sum + Number(item.quantity), 0);

    return totalQty > 0 ? (totalCost / totalQty).toFixed(2) : 0;
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <h1>Catalog & Inventory Purchases</h1>

        <form onSubmit={handleAddProduct} className="form-grid">
          <input placeholder="Item Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="SKU Code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input type="number" step="0.01" placeholder="Selling Price (₹)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required />
          <input type="number" step="0.01" placeholder="Purchase Cost (₹)" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} required />
          <input type="number" placeholder="Quantity Purchased" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} required />

          <button type="submit" className="submit-btn">Add Product & Log Purchase</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Selling Price</th>
                <th>Avg. Cost (WAC)</th>
                <th>Purchase History (Variation)</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const prodPurchases = purchases[p.id] || [];
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <div className="subtext">SKU: {p.sku}</div>
                    </td>
                    <td>{p.categories?.name || 'Uncategorized'}</td>
                    <td>{p.stock_quantity}</td>
                    <td>₹{p.selling_price}</td>
                    <td><strong>₹{calculateAvgPrice(p.id)}</strong></td>
                    <td>
                      <div className="batch-list">
                        {prodPurchases.map((batch) => (
                          <span key={batch.id} className="batch-tag">
                            {batch.purchase_date}: ₹{batch.purchase_price} (x{batch.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .form-grid {
          background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 24px;
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; border: 1px solid #e2e8f0;
        }
        input, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px; width: 100%; box-sizing: border-box; }
        :global(.submit-btn) { grid-column: 1 / -1; padding: 12px; background: #16a34a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .table-wrapper { overflow-x: auto; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; min-width: 700px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f8fafc; }
        .subtext { font-size: 12px; color: #64748b; }
        .batch-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .batch-tag { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
        @media (max-width: 768px) { .layout { flex-direction: column; } .content { padding: 16px; } }
      `}</style>
    </div>
  );
}