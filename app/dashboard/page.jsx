'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    grossRevenue: '0.00',
    actualReceived: '0.00',
    inventoryStockValue: '0.00',
    realizedProfit: '0.00',
    profitMarginPct: '0.0'
  });

  useEffect(() => {
    calculateDashboard();
  }, []);

  const calculateDashboard = async () => {
    try {
      // ---------------------------------------------------------
      // 1. Get sales + sale items
      // ---------------------------------------------------------
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*, sale_items(*)');

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        return;
      }

      // ---------------------------------------------------------
      // 2. Get products and their purchase prices
      // ---------------------------------------------------------
      const { data: products, error: productsError } = await supabase
        .from('productsinfo')
        .select('id, purchase_price, stock_quantity, avg_cost_price');

      if (productsError) {
        console.error('Error fetching products:', productsError);
        return;
      }

      // Create a quick lookup:
      // product ID -> purchase price
      const productPurchasePriceMap = new Map<
        string | number,
        number
      >();

      products?.forEach((product) => {
        productPurchasePriceMap.set(
          product.id,
          Number(product.purchase_price || 0)
        );
      });

      // ---------------------------------------------------------
      // 3. Calculate sales figures
      // ---------------------------------------------------------
      let totalGross = 0;
      let totalReceived = 0;
      let totalPurchaseCost = 0;

      sales?.forEach((sale) => {
        // Ignore cancelled sales
        if (sale.sale_status !== 'Cancelled') {
          // Total sale/order value
          totalGross += Number(sale.total_amount || 0);

          // Actual money received
          totalReceived += Number(sale.advance_paid || 0);

          // Calculate purchase cost of sold products
          sale.sale_items?.forEach((item: any) => {
            const productId = item.product_id;

            const purchasePrice =
              productPurchasePriceMap.get(productId) || 0;

            const quantity = Number(item.quantity || 1);

            totalPurchaseCost += purchasePrice * quantity;
          });
        }
      });

      // ---------------------------------------------------------
      // 4. Inventory Stock Value
      // ---------------------------------------------------------
      let stockValue = 0;

      products?.forEach((product) => {
        const stockQuantity = Number(product.stock_quantity || 0);

        const purchasePrice = Number(
          product.purchase_price || product.avg_cost_price || 0
        );

        stockValue += stockQuantity * purchasePrice;
      });

      // ---------------------------------------------------------
      // 5. Calculate realized profit
      //
      // Actual amount received
      // MINUS
      // Purchase price of products sold
      // ---------------------------------------------------------
      const netProfit = totalReceived - totalPurchaseCost;

      const marginPct =
        totalReceived > 0
          ? (netProfit / totalReceived) * 100
          : 0;

      // ---------------------------------------------------------
      // 6. Update dashboard
      // ---------------------------------------------------------
      setMetrics({
        grossRevenue: totalGross.toFixed(2),
        actualReceived: totalReceived.toFixed(2),
        inventoryStockValue: stockValue.toFixed(2),
        realizedProfit: netProfit.toFixed(2),
        profitMarginPct: marginPct.toFixed(1)
      });
    } catch (error) {
      console.error('Dashboard calculation error:', error);
    }
  };

  return (
    <div className="layout">
      <Sidebar />

      <main className="content">
        <h1>Financial Dashboard</h1>

        <div className="metrics-grid">

          {/* Gross Sales */}
          <div className="card">
            <span className="card-title">
              Gross Sales Value
            </span>

            <div className="card-value">
              ₹{metrics.grossRevenue}
            </div>

            <span className="card-sub">
              Total sales orders placed
            </span>
          </div>

          {/* Actual Amount Received */}
          <div className="card highlight">
            <span className="card-title">
              Actual Amount Received
            </span>

            <div className="card-value">
              ₹{metrics.actualReceived}
            </div>

            <span className="card-sub">
              Collected via advance & payments
            </span>
          </div>

          {/* Inventory */}
          <div className="card">
            <span className="card-title">
              Current Inventory Value
            </span>

            <div className="card-value">
              ₹{metrics.inventoryStockValue}
            </div>

            <span className="card-sub">
              Total stock purchase cost
            </span>
          </div>

          {/* Profit */}
          <div className="card success">
            <span className="card-title">
              Realized Net Profit
            </span>

            <div className="card-value">
              ₹{metrics.realizedProfit}
            </div>

            <span className="card-sub">
              Profit Margin:{' '}
              <strong>{metrics.profitMarginPct}%</strong>
            </span>
          </div>

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
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(220px, 1fr)
          );
          gap: 16px;
          margin-top: 20px;
        }

        .card {
          background: #fff;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .card.highlight {
          border-left: 4px solid #0284c7;
        }

        .card.success {
          border-left: 4px solid #16a34a;
        }

        .card-title {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .card-value {
          font-size: 24px;
          font-weight: bold;
          color: #0f172a;
        }

        .card-sub {
          font-size: 12px;
          color: #94a3b8;
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
