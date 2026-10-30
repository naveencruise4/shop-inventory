'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowRightLeft, FileText, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'orders' ? 'orders' : 'bills';

  const [salesBills, setSalesBills] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Conversion Modal State
  const [convertModalOrder, setConvertModalOrder] = useState(null);
  const [conversionPayments, setConversionPayments] = useState([{ method: 'cash', amount: 0 }]);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState('cash');

  useEffect(() => {
    fetchOrdersData();
  }, [activeTab]);

  const fetchOrdersData = async () => {
    setLoading(true);
    if (activeTab === 'bills') {
      const { data } = await supabase
        .from('sales')
        .select('*, customers(name, phone, gstin), salesman(name)')
        .order('created_at', { ascending: false });
      if (data) setSalesBills(data);
    } else {
      const { data } = await supabase
        .from('sales_order')
        .select('*, customers(name, phone), salesman(name), sale_items(*), sale_payments(*)')
        .order('created_at', { ascending: false });
      if (data) setSalesOrders(data);
    }
    setLoading(false);
  };

  const handleOpenConvertModal = (order) => {
    setConvertModalOrder(order);
    setConversionPayments([{ method: 'cash', amount: 0 }]);
    setRefundAmount(0);
  };

  const handleExecuteConversion = async () => {
    if (!convertModalOrder) return;

    const shopId = convertModalOrder.shop_id;
    const newPaymentsPayload = conversionPayments
      .filter(p => Number(p.amount) > 0)
      .map(p => ({ payment_method: p.method, amount: Number(p.amount) }));

    const refundPayload = refundAmount > 0 ? {
      amount: Number(refundAmount),
      payment_method: refundMethod
    } : null;

    try {
      const { data, error } = await supabase.rpc('convert_sales_order_to_sales', {
        p_shop_id: shopId,
        p_sales_order_id: convertModalOrder.id,
        p_new_payments: newPaymentsPayload,
        p_refund_payment: refundPayload,
        p_fulfillment_status: convertModalOrder.fulfillment_status || 'not_set'
      });

      if (error) throw error;

      alert(`Conversion Successful! Invoices Generated: ${JSON.stringify(data)}`);
      setConvertModalOrder(null);
      fetchOrdersData();
    } catch (err) {
      alert(`Conversion Failed: ${err.message}`);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {activeTab === 'bills' ? 'Sales Bills & Invoices' : 'Sales Orders (Pre-Orders)'}
          </h1>
          <p className="text-sm text-slate-500">
            {activeTab === 'bills' ? 'View and track finalized tax and estimate invoices' : 'Manage active bookings and convert them upon stock arrival'}
          </p>
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading records...</div>
        ) : activeTab === 'bills' ? (
          /* Sales Bills Table */
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Type</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Paid</th>
                <th className="p-4">Payment Status</th>
                <th className="p-4">Fulfillment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesBills.map(bill => (
                <tr key={bill.id} className="hover:bg-slate-50">
                  <td className="p-4 font-bold text-emerald-700">{bill.order_number}</td>
                  <td className="p-4 text-slate-500">{new Date(bill.invoice_date || bill.created_at).toLocaleDateString()}</td>
                  <td className="p-4 font-medium">{bill.customers?.name || 'Walk-in'}</td>
                  <td className="p-4"><span className="uppercase text-xs font-bold px-2 py-0.5 bg-slate-200 rounded">{bill.invoice_type}</span></td>
                  <td className="p-4 font-bold">₹{bill.total_amount}</td>
                  <td className="p-4">₹{bill.paid_amount || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      bill.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {bill.payment_status}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-semibold capitalize">{bill.fulfillment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Sales Orders Table */
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-4">Booking #</th>
                <th className="p-4">Booking Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Order Value</th>
                <th className="p-4">Advance Paid</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="p-4 font-bold text-emerald-700">{order.booking_number}</td>
                  <td className="p-4 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-4 font-medium">{order.customers?.name || 'Walk-in'}</td>
                  <td className="p-4 font-bold">₹{order.total_amount}</td>
                  <td className="p-4 text-emerald-600 font-bold">₹{order.paid_amount || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      order.conversion_status === 'converted' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {order.conversion_status}
                    </span>
                  </td>
                  <td className="p-4">
                    {order.conversion_status === 'open' && (
                      <button
                        onClick={() => handleOpenConvertModal(order)}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 hover:bg-emerald-700"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Convert to Sale</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Conversion Action Modal */}
      {convertModalOrder && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Convert Pre-Order {convertModalOrder.booking_number}</h3>
            
            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <p><strong>Customer:</strong> {convertModalOrder.customers?.name}</p>
              <p><strong>Order Total:</strong> ₹{convertModalOrder.total_amount}</p>
              <p><strong>Advances Received:</strong> ₹{convertModalOrder.paid_amount || 0}</p>
            </div>

            {/* Excess Advance Refund Section */}
            {convertModalOrder.paid_amount > convertModalOrder.total_amount && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <p className="text-xs text-amber-800 font-bold">Excess advance detected! Enter refund details prior to conversion:</p>
                <input 
                  type="number" 
                  placeholder="Refund Amount" 
                  value={refundAmount} 
                  onChange={e => setRefundAmount(e.target.value)} 
                  className="w-full text-xs p-2 border rounded"
                />
              </div>
            )}

            {/* Additional Payment Entry */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Today's Balance Payment</label>
              {conversionPayments.map((p, idx) => (
                <div key={idx} className="flex space-x-2 mb-1">
                  <select 
                    value={p.method} 
                    onChange={e => {
                      const updated = [...conversionPayments];
                      updated[idx].method = e.target.value;
                      setConversionPayments(updated);
                    }}
                    className="text-xs p-1 border rounded"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                  <input 
                    type="number" 
                    placeholder="Amount" 
                    value={p.amount} 
                    onChange={e => {
                      const updated = [...conversionPayments];
                      updated[idx].amount = Number(e.target.value);
                      setConversionPayments(updated);
                    }}
                    className="flex-1 text-xs p-1 border rounded"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <button onClick={() => setConvertModalOrder(null)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
              <button onClick={handleExecuteConversion} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
                Finalize & Generate Invoices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}