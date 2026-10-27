'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function PrintableReceiptModal({
  show,
  onClose,
  completedGstOrder,
  completedEstimateOrder
}) {
  const [activeReceiptTab, setActiveReceiptTab] = useState('gst');
  const [shopProfile, setShopProfile] = useState(null);

  useEffect(() => {
    if (show) {
      fetchShopProfile();
    }
  }, [show]);

  const fetchShopProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: appUser } = await supabase
        .from('users')
        .select('shop_id')
        .eq('id', user.id)
        .single();

      if (appUser?.shop_id) {
        const { data: shop } = await supabase
          .from('shops')
          .select('name, address, phone, has_gst, gstin')
          .eq('id', appUser.shop_id)
          .single();

        if (shop) setShopProfile(shop);
      }
    } catch (err) {
      console.error('Error fetching shop profile for receipt:', err);
    }
  };

  if (!show || (!completedGstOrder && !completedEstimateOrder)) return null;

  const currentActiveOrder = activeReceiptTab === 'gst' ? (completedGstOrder || completedEstimateOrder) : (completedEstimateOrder || completedGstOrder);
  const isGstBill = currentActiveOrder?.isGstInvoice && shopProfile?.has_gst;

  const handlePrint = () => {
    const receiptElement = document.getElementById('printable-receipt');
    if (!receiptElement) return;

    document.getElementById('print-mount-root')?.remove();

    const printContainer = document.createElement('div');
    printContainer.id = 'print-mount-root';

    const receiptClone = receiptElement.cloneNode(true);
    receiptClone.removeAttribute('id');

    printContainer.appendChild(receiptClone);
    document.body.appendChild(printContainer);

    const cleanup = () => {
      printContainer.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    try {
      window.print();
    } catch (error) {
      cleanup();
      console.error('Unable to print receipt:', error);
    }
  };

  return (
    <div className="modal-overlay receipt-modal-overlay">
      <div className="modal receipt-modal-container">
        <div className="receipt-actions no-print">
          <div>
            <h3>Receipt Ready</h3>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {completedGstOrder && (
                <button
                  className={`tab-btn ${activeReceiptTab === 'gst' ? 'active' : ''}`}
                  onClick={() => setActiveReceiptTab('gst')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    background: activeReceiptTab === 'gst' ? '#0f172a' : '#fff',
                    color: activeReceiptTab === 'gst' ? '#fff' : '#0f172a'
                  }}
                >
                  📄 GST Invoice (₹{completedGstOrder.totalAmount?.toFixed(2)})
                </button>
              )}
              {completedEstimateOrder && (
                <button
                  className={`tab-btn ${activeReceiptTab === 'estimate' ? 'active' : ''}`}
                  onClick={() => setActiveReceiptTab('estimate')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    background: activeReceiptTab === 'estimate' ? '#0f172a' : '#fff',
                    color: activeReceiptTab === 'estimate' ? '#fff' : '#0f172a'
                  }}
                >
                  📝 Estimate (₹{completedEstimateOrder.totalAmount?.toFixed(2)})
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="primary-btn" onClick={handlePrint}>🖨️ Print Active Receipt</button>
            <button className="cancel-btn" onClick={onClose}>Close</button>
          </div>
        </div>

        {currentActiveOrder && (
          <div id="printable-receipt" className="receipt-box">
            {/* Side-by-Side Compact Header Layout */}
            <div className="receipt-header">
              <div className="header-left">
                <h2>{currentActiveOrder.shopName || shopProfile?.name || 'MY STORE'}</h2>
                {shopProfile?.address && <p className="shop-address">{shopProfile.address}</p>}
              </div>
              <div className="header-right">
                <p className="receipt-subtitle">
                  {currentActiveOrder.saleStatus === 'pre_order' ? 'PRE-ORDER RECEIPT' : currentActiveOrder.isGstInvoice ? 'Invoice' : 'Estimate'}
                </p>
                {shopProfile?.phone && <p className="shop-detail">Phone: {shopProfile.phone}</p>}
                {isGstBill && shopProfile?.gstin && (
                  <p className="shop-detail"><strong>GSTIN:</strong> {shopProfile.gstin}</p>
                )}
              </div>
            </div>

            <div className="receipt-meta-block">
              <div className="receipt-meta">
                <div><strong>Date:</strong> {currentActiveOrder.date}</div>
                {currentActiveOrder.orderNumber && (
                  <div><strong>Order No:</strong> {currentActiveOrder.orderNumber}</div>
                )}
                
              </div>
              <div className="receipt-meta">
                <div><strong>Customer:</strong> {currentActiveOrder.customer} {currentActiveOrder.customerPhone ? `(${currentActiveOrder.customerPhone})` : ''}</div>
                <div><strong>Order ID:</strong> #{currentActiveOrder.saleId?.slice(0, 8)}</div>
                
              </div>
              <div className="receipt-meta">
                <div><strong>Sales Rep:</strong> {currentActiveOrder.salesmanName || 'Unassigned'}</div>
                <div><strong>Payment:</strong> {currentActiveOrder.paymentMethod?.toUpperCase()}</div>
              </div>
            </div>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Description</th>
                  <th>Qty</th>
                  <th>Rate (₹)</th>
                  <th>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {currentActiveOrder.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      {it.sku} {it.name || it.sku}
                      {it.has_gst && it.gst_percentage > 0 && (
                        <span className="receipt-subtext"> (Incl. {it.gst_percentage}% GST)</span>
                      )}
                    </td>
                    <td>{it.quantity}</td>
                    <td>₹{Number(it.unit_price || it.price).toFixed(2)}</td>
                    <td>₹{(it.quantity * (it.unit_price || it.price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-summary-block">
              {currentActiveOrder.totalGst > 0 && (
                <div className="receipt-row">
                  <span>Taxable Amount (Base):</span>
                  <span>₹{currentActiveOrder.totalBase?.toFixed(2)}</span>
                </div>
              )}
              {currentActiveOrder.totalGst > 0 && (
                <div className="receipt-row">
                  <span>Total GST Extracted:</span>
                  <span>₹{currentActiveOrder.totalGst?.toFixed(2)}</span>
                </div>
              )}
              <div className="receipt-row grand-total-row">
                <span>Grand Total:</span>
                <span>₹{currentActiveOrder.totalAmount?.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Amount Paid:</span>
                <span>₹{currentActiveOrder.paidAmount?.toFixed(2)}</span>
              </div>
              {currentActiveOrder.totalAmount - currentActiveOrder.paidAmount > 0 && (
                <div className="receipt-row pending-row" style={{ color: '#b91c1c', fontWeight: 'bold' }}>
                  <span>Balance Due:</span>
                  <span>₹{(currentActiveOrder.totalAmount - currentActiveOrder.paidAmount).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="receipt-footer">
              <p>Thank you for shopping with us!</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal { background: white; padding: 24px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; }
        .primary-btn { padding: 10px 16px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .cancel-btn { padding: 10px 16px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; }
        .receipt-modal-container { width: 550px; max-height: 90vh; overflow-y: auto; }
        .receipt-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
        .receipt-box { background: #fff; padding: 16px 20px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: sans-serif; }
        
        /* Compact Side-by-Side Header */
        .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed #0f172a; padding-bottom: 8px; margin-bottom: 8px; }
        .header-left { flex: 1; padding-right: 12px; }
        .header-left h2 { margin: 0 0 2px 0; font-size: 18px; text-transform: uppercase; color: #0f172a; }
        .shop-address { margin: 0; font-size: 11px; color: #475569; line-height: 1.3; white-space: pre-line; }
        
        .header-right { text-align: right; flex-shrink: 0; }
        .receipt-subtitle { margin: 0 0 2px 0; font-size: 13px; color: #0f172a; font-weight: bold; }
        .shop-detail { margin: 0; font-size: 11px; color: #475569; line-height: 1.3; }

        .receipt-meta-block { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; }
        .receipt-meta { display: flex; justify-content: space-between; font-size: 12px; color: #334155; }
        
        .receipt-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
        .receipt-table th { border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 5px 4px; text-align: left; }
        .receipt-table td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; }
        .receipt-subtext { font-size: 10px; color: #64748b; }
        .receipt-summary-block { border-top: 1px dashed #0f172a; padding-top: 6px; margin-top: 8px; display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
        .receipt-row { display: flex; justify-content: space-between; }
        .grand-total-row { font-size: 13px; font-weight: bold; border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 3px 0; margin: 3px 0; }
        .receipt-footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
      `}</style>

      <style jsx global>{`
        #print-mount-root { display: none !important; }
        @media print {
          @page {
            size: A5 portrait;
            margin: 6mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body > *:not(#print-mount-root) {
            display: none !important;
          }
          body > #print-mount-root {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            overflow: visible !important;
          }
          #print-mount-root, #print-mount-root * {
            box-sizing: border-box !important;
          }
          #print-mount-root .receipt-box {
            display: block !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            border: none !important;
            box-shadow: none !important;
            font-family: Arial, sans-serif !important;
            color: #000 !important;
            background: #fff !important;
          }
          #print-mount-root .no-print {
            display: none !important;
          }
          #print-mount-root .receipt-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #print-mount-root .receipt-table thead {
            display: table-header-group !important;
          }
          #print-mount-root .receipt-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #print-mount-root .receipt-header,
          #print-mount-root .receipt-meta-block,
          #print-mount-root .receipt-summary-block,
          #print-mount-root .receipt-footer {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}