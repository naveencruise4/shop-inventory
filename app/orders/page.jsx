'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, customers(name, phone)')
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const updateStatus = async (id, status) => {
    await supabase.from('sales').update({ order_status: status }).eq('id', id);
    fetchOrders();
  };

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '30px' }}>
        <h1>Order Tracking</h1>
        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Customer</th>
              <th style={{ padding: '12px' }}>Total Amount</th>
              <th style={{ padding: '12px' }}>Advance Paid</th>
              <th style={{ padding: '12px' }}>Payment Status</th>
              <th style={{ padding: '12px' }}>Order Status</th>
              <th style={{ padding: '12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px' }}>{o.customers?.name || 'Walk-in Customer'}</td>
                <td style={{ padding: '12px' }}>₹{o.total_amount}</td>
                <td style={{ padding: '12px' }}>₹{o.advance_paid}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: o.payment_status === 'PAID' ? '#d1e7dd' : '#fff3cd' }}>
                    {o.payment_status}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{o.order_status}</td>
                <td style={{ padding: '12px' }}>
                  <select value={o.order_status} onChange={(e) => updateStatus(o.id, e.target.value)}>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}