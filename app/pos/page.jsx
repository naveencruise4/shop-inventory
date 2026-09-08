'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [advancePaid, setAdvancePaid] = useState(0);

  useEffect(() => {
    supabase.from('productsinfo').select('*').then(({ data }) => setProducts(data || []));
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const total = cart.reduce((sum, item) => sum + item.selling_price * item.qty, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Select products to checkout.');

    const { data: userData } = await supabase.from('users').select('shop_id').single();
    const shopId = userData?.shop_id;

    let customerId = null;
    if (customer.name && customer.phone) {
      const { data: cust } = await supabase
        .from('customers')
        .insert([{ shop_id: shopId, name: customer.name, phone: customer.phone }])
        .select()
        .single();
      if (cust) customerId = cust.id;
    }

    const { data: sale, error } = await supabase
      .from('sales')
      .insert([{
        shop_id: shopId,
        customer_id: customerId,
        total_amount: total,
        advance_paid: Number(advancePaid),
        payment_status: advancePaid >= total ? 'PAID' : advancePaid > 0 ? 'PARTIAL' : 'PENDING',
        order_status: 'CONFIRMED'
      }])
      .select()
      .single();

    if (error) return alert(`Order failed: ${error.message}`);

    for (const item of cart) {
      await supabase.from('sale_items').insert([{
        shop_id: shopId,
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.selling_price
      }]);

      await supabase
        .from('productsinfo')
        .update({ stock_quantity: item.stock_quantity - item.qty })
        .eq('id', item.id);
    }

    alert('Order created successfully!');
    setCart([]);
    setAdvancePaid(0);
    setCustomer({ name: '', phone: '' });
    supabase.from('productsinfo').select('*').then(({ data }) => setProducts(data || []));
  };

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '30px', display: 'flex', gap: '20px' }}>
        <div style={{ flex: 2 }}>
          <h1>POS Terminal</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fill, minmax(180px, 1fr) )', gap: '15px' }}>
            {products.map((p) => (
              <div key={p.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <h4 style={{ margin: '0 0 5px 0' }}>{p.name}</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>Stock: {p.stock_quantity}</p>
                <p style={{ fontWeight: 'bold', margin: '10px 0' }}>₹{p.selling_price}</p>
                <button
                  disabled={p.stock_quantity <= 0}
                  onClick={() => addToCart(p)}
                  style={{ width: '100%', padding: '6px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, background: '#fff', padding: '20px', borderRadius: '8px', height: 'fit-content' }}>
          <h2>Current Order</h2>
          <input
            placeholder="Customer Name"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }}
          />
          <input
            placeholder="Phone Number"
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            style={{ width: '100%', padding: '8px', marginBottom: '15px', boxSizing: 'border-box' }}
          />

          {cart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{item.name} (x{item.qty})</span>
              <span>₹{item.selling_price * item.qty}</span>
            </div>
          ))}

          <hr style={{ margin: '15px 0' }} />
          <h3>Total: ₹{total}</h3>

          <label style={{ fontSize: '14px' }}>Advance Paid (₹):</label>
          <input
            type="number"
            value={advancePaid}
            onChange={(e) => setAdvancePaid(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px', marginBottom: '15px', boxSizing: 'border-box' }}
          />

          <button
            onClick={handleCheckout}
            style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Complete Order
          </button>
        </div>
      </main>
    </div>
  );
}