'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../lib/supabaseClient';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({ totalSales: 0, pendingOrders: 0, lowStockCount: 0 });

  useEffect(() => {
    async function loadMetrics() {
      const { data: salesData } = await supabase.from('sales').select('total_amount, order_status');
      const { data: productsData } = await supabase.from('productsinfo').select('stock_quantity');

      if (salesData) {
        const total = salesData.reduce((sum, s) => sum + Number(s.total_amount), 0);
        const pending = salesData.filter((s) => s.order_status !== 'COMPLETED').length;
        setMetrics((m) => ({ ...m, totalSales: total, pendingOrders: pending }));
      }

      if (productsData) {
        const lowStock = productsData.filter((p) => p.stock_quantity <= 2).length;
        setMetrics((m) => ({ ...m, lowStockCount: lowStock }));
      }
    }
    loadMetrics();
  }, []);

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '30px' }}>
        <h1>Overview</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Gross Revenue</span>
            <h2>₹{metrics.totalSales.toLocaleString()}</h2>
          </div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #eab308' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Active Orders</span>
            <h2>{metrics.pendingOrders}</h2>
          </div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Low Stock Items</span>
            <h2>{metrics.lowStockCount}</h2>
          </div>
        </div>
      </main>
    </div>
  );
}