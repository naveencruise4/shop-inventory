'use client';

export const dynamic = 'force-dynamic';

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
    <div className="layout">
      <Sidebar />
      <main className="content">
        <h1>Catalog & Inventory</h1>
        
        <form onSubmit={handleAddProduct} className="form-grid">
          <input placeholder="Item Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="SKU Code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input type="number" placeholder="Selling Price (₹)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required />
          <input type="number" placeholder="Initial Stock" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} required />
          <input placeholder="Material" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
          <input placeholder="Dimensions" value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} />
          <button type="submit" className="submit-btn">Add Product</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Specs</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td className="specs">{p.attributes?.material} {p.attributes?.dimensions && `(${p.attributes.dimensions})`}</td>
                  <td>₹{p.selling_price}</td>
                  <td>{p.stock_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <style jsx>{`
        .layout {
          display: flex;
          min-height: 100vh;
        }

        .content {
          flex: 1;
          padding: 24px;
          box-sizing: border-box;
          max-width: 1200px;
        }

        .form-grid {
          background: #fff;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          border: 1px solid #e2e8f0;
        }

        input {
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
        }

        :global(.submit-btn) {
          grid-column: 1 / -1;
          padding: 12px;
          background: #16a34a;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        .table-wrapper {
          overflow-x: auto;
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 600px;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }

        th {
          background: #f8fafc;
        }

        .specs {
          font-size: 12px;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .layout {
            flex-direction: column;
          }

          .content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}