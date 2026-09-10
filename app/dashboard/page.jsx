'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalCollections: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalReceivables: 0,
    inventoryValue: 0,
  });

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);

      // Call single PostgreSQL RPC for authoritative financial data
      const { data, error } = await supabase.rpc('get_dashboard_metrics');

      if (error) throw error;

      if (data) {
        setMetrics({
          totalSales: Number(data.totalSales || 0),
          totalCollections: Number(data.totalCollections || 0),
          totalCogs: Number(data.totalCogs || 0),
          grossProfit: Number(data.grossProfit || 0),
          totalReceivables: Number(data.totalReceivables || 0),
          inventoryValue: Number(data.inventoryValue || 0),
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics from PostgreSQL:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <h1>Business Intelligence Dashboard</h1>
          <button className="refresh-btn" onClick={fetchDashboardMetrics}>🔄 Refresh Data</button>
        </div>

        {loading ? (
          <p className="loading-text">Fetching financial metrics from database...</p>
        ) : (
          <div className="dashboard-grid">
            
            <div className="metric-card primary">
              <span className="card-category">Commercial Performance</span>
              <h3>Gross Sales (Invoiced)</h3>
              <div className="metric-value">₹{metrics.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="card-subtext">Total invoice value across all completed sales.</p>
            </div>

            <div className="metric-card success">
              <span className="card-category">Cash Flow Health</span>
              <h3>Collections (Cash Received)</h3>
              <div className="metric-value">₹{metrics.totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="card-subtext">Actual funds collected in register / bank.</p>
            </div>

            <div className="metric-card">
              <span className="card-category">Cost Accounting</span>
              <h3>Cost of Goods Sold (COGS)</h3>
              <div className="metric-value">₹{metrics.totalCogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="card-subtext">Wholesale cost of goods sold.</p>
            </div>

            <div className="metric-card highlight">
              <span className="card-category">Core Profitability</span>
              <h3>Gross Profit</h3>
              <div className="metric-value">₹{metrics.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="card-subtext">Sales minus COGS.</p>
            </div>

            <div className="metric-card warning">
              <span className="card-category">Credit Risk</span>
              <h3>Receivables (Outstanding Dues)</h3>
              <div className="metric-value">₹{metrics.totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="card-subtext">Uncollected credit balances owed by customers.</p>
            </div>

            <div className="metric-card">
              <span className="card-category">Asset Valuation</span>
              <h3>Current Inventory Value</h3>
              <div className="metric-value">₹{metrics.inventoryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <p className="card-subtext">Wholesale value of active shelf inventory.</p>
            </div>

          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .refresh-btn { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
        
        .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .metric-card.primary { border-left: 4px solid #0284c7; }
        .metric-card.success { border-left: 4px solid #16a34a; }
        .metric-card.highlight { border-left: 4px solid #9333ea; background: #faf5ff; }
        .metric-card.warning { border-left: 4px solid #d97706; }

        .card-category { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #64748b; }
        .metric-card h3 { margin: 0; font-size: 15px; color: #334155; font-weight: 600; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0f172a; }
        .card-subtext { font-size: 12px; color: #64748b; margin: 0; }
        .loading-text { color: #64748b; font-size: 14px; }
      `}</style>
    </div>
  );
}