import React from 'react';

export default function PrintableReceiptModal({ sale, customer, items, allocations, onClose }) {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl w-96 shadow-2xl font-mono text-xs space-y-4">
        {/* Header */}
        <div className="text-center border-b pb-2">
          <h2 className="font-bold text-base">INVOICE RECEIPT</h2>
          <p>{sale.order_number}</p>
          <p>{new Date(sale.invoice_date).toLocaleString()}</p>
        </div>

        {/* B2B Customer Info */}
        <div className="border-b pb-2">
          <p><strong>Customer:</strong> {customer?.name}</p>
          {customer?.is_business && (
            <p><strong>GSTIN:</strong> {customer?.gstin}</p>
          )}
        </div>

        {/* Itemized Table */}
        <div className="space-y-1 border-b pb-2">
          {items?.map(item => (
            <div key={item.id} className="flex justify-between">
              <span>{item.name} x{item.quantity}</span>
              <span>₹{item.unit_price * item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="space-y-1 font-bold">
          <div className="flex justify-between">
            <span>Total Bill:</span>
            <span>₹{sale.total_amount}</span>
          </div>
          <div className="flex justify-between text-emerald-600">
            <span>Total Paid:</span>
            <span>₹{sale.paid_amount || 0}</span>
          </div>
        </div>

        <button 
          onClick={() => window.print()} 
          className="w-full py-2 bg-slate-800 text-white rounded font-sans font-bold"
        >
          Print Receipt
        </button>
        <button onClick={onClose} className="w-full text-center text-slate-400 font-sans">Close</button>
      </div>
    </div>
  );
}