'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', sku: '', selling_price: '', stock_quantity: '', material: '', dimensions: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productsinfo').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const { data: userData } = await supabase.from('users').select('shop_id').single();

    const payload = {
      shop_id: userData?.shop_id,
      name: form.name,
      sku: form.sku,
      selling_price: Number(form.selling_price),
      stock_quantity: Number(form.stock_quantity),
      attributes: { material: form.material, dimensions: form.dimensions }
    };

    const { error } = await supabase.from('productsinfo').insert([payload]);
    if (error) {
      alert(`Error adding product: ${error.message}`);
    } else {
      setForm({ name: '', sku: '', selling_price: '', stock_quantity: '', material: '', dimensions: '' });
      fetchProducts();
    }
  };

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '30px' }}>
        <h1>Catalog & Inventory</h1>
        
        <form onSubmit={handleAddProduct} style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '30px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <input placeholder="Item Name (e.g. Sofa)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ padding: '8px' }} />
          <input placeholder="SKU Code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" placeholder="Selling Price (₹)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" placeholder="Initial Stock" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} required style={{ padding: '8px' }} />
          <input placeholder="Material (e.g. Fabric/Wood)" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} style={{ padding: '8px' }} />
          <input placeholder="Dimensions (e.g. 3-Seater)" value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} style={{ padding: '8px' }} />
          <button style={{ gridColumn: 'span 3', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Add Product
          </button>
        </form>

        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Name</th>
              <th style={{ padding: '12px' }}>SKU</th>
              <th style={{ padding: '12px' }}>Specs</th>
              <th style={{ padding: '12px' }}>Price</th>
              <th style={{ padding: '12px' }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px' }}>{p.name}</td>
                <td style={{ padding: '12px' }}>{p.sku}</td>
                <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                  {p.attributes?.material} {p.attributes?.dimensions && `(${p.attributes.dimensions})`}
                </td>
                <td style={{ padding: '12px' }}>₹{p.selling_price}</td>
                <td style={{ padding: '12px' }}>{p.stock_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}