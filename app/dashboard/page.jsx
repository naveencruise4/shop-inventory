'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    grossRevenue: 0,
    actualReceived: 0,
    inventoryStockValue: 0,
    realizedProfit: 0,
    profitMarginPct: 0
  });

  useEffect(() => {
    calculateDashboard();
  }, []);

  const calculateDashboard = async () => {
    // 1. Calculate Gross Revenue & Actual Received from sales
    const { data: sales } = await supabase.from('sales').select('*, sale_items(*)');
    let totalGross = 0;
    let totalReceived = 0;
    let totalSoldCost = 0;

    if (sales) {
      sales.forEach(s => {
        if (s.sale_status !== 'Cancelled') {
          totalGross += Number(s.total_amount || 0);
          totalReceived += Number(s.advance_paid || 0);

          s.sale_items?.forEach(item => {
            totalSoldCost += Number(item.cost_price || 0) * Number(item.quantity || 1);
          });
        }
      });
    }

    // 2. Inventory Stock Value from productsinfo
    const { data: products } = await supabase.from('productsinfo').select('stock_quantity, avg_cost_price');
    let stockValue = 0;
    if (products) {
      products.forEach(p => {
        stockValue += (Number(p.stock_quantity) || 0) * (Number(p.avg_cost_price) || 0);
      });
    }

    // Realized Net Profit
    const netProfit = totalReceived - totalSoldCost;
    const marginPct = totalReceived > 0 ? (netProfit / totalReceived) * 100 : 0;

    setMetrics({
      grossRevenue: totalGross.toFixed(2),
      actualReceived: totalReceived.toFixed(2),
      inventoryStockValue: stockValue.toFixed(2),
      realizedProfit: netProfit.toFixed(2),
      profitMarginPct: marginPct.toFixed(1)
    });
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <h1>Financial Dashboard</h1>

        <div className="metrics-grid">
          <div className="card">
            <span className="card-title">Gross Sales Value</span>
            <div className="card-value">₹{metrics.grossRevenue}</div>
            <span className="card-sub">Total sales orders placed</span>
          </div>

          <div className="card highlight">
            <span className="card-title">Actual Amount Received</span>
            <div className="card-value">₹{metrics.actualReceived}</div>
            <span className="card-sub">Collected via advance & payments</span>
          </div>

          <div className="card">
            <span className="card-title">Current Inventory Value</span>
            <div className="card-value">₹{metrics.inventoryStockValue}</div>
            <span className="card-sub">Total stock purchase cost</span>
          </div>

          <div className="card success">
            <span className="card-title">Realized Net Profit</span>
            <div className="card-value">₹{metrics.realizedProfit}</div>
            <span className="card-sub">Profit Margin: <strong>{metrics.profitMarginPct}%</strong></span>
          </div>
        </div>
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 20px; }
        .card { background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px; }
        .card.highlight { border-left: 4px solid #0284c7; }
        .card.success { border-left: 4px solid #16a34a; }
        .card-title { font-size: 13px; color: #64748b; font-weight: 500; }
        .card-value { font-size: 24px; font-weight: bold; color: #0f172a; }
        .card-sub { font-size: 12px; color: #94a3b8; }
        @media (max-width: 768px) { .layout { flex-direction: column; } .content { padding: 16px; } }
      `}</style>
    </div>
  );
}