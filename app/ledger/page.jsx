'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users, DollarSign, CheckCircle } from 'lucide-react';

export default function LedgerPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [pendingInvoices, setPendingInvoices] = useState([]);
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentRows, setPaymentRows] = useState([{ method: 'cash', amount: 0 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('customers').select('*').then(({ data }) => {
      if (data) setCustomers(data);
    });
  }, []);

  useEffect(() => {
    if (selectedCustId) {
      fetchCustomerInvoices(selectedCustId);
    }
  }, [selectedCustId]);

  const fetchCustomerInvoices = async (custId) => {
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', custId)
      .neq('payment_status', 'paid')
      .order('created_at', { ascending: false });

    if (data) setPendingInvoices(data);
  };

  const handleCollectPayment = async () => {
    if (!selectedInvoice) return alert('Select an invoice first!');
    
    const shopId = selectedInvoice.shop_id;
    const paymentsPayload = paymentRows
      .filter(p => Number(p.amount) > 0)
      .map(p => ({ payment_method: p.method, amount: Number(p.amount) }));

    if (paymentsPayload.length === 0) return alert('Enter at least one payment amount!');

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('collect_invoice_payment', {
        p_shop_id: shopId,
        p_sale_id: selectedInvoice.id,
        p_payments: paymentsPayload
      });

      if (error) throw error;

      alert('Payment collected successfully!');
      setSelectedInvoice(null);
      setPaymentRows([{ method: 'cash', amount: 0 }]);
      fetchCustomerInvoices(selectedCustId);
    } catch (err) {
      alert(`Collection Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Customer Accounts Ledger</h1>

      {/* Customer Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 max-w-md">
        <label className="block text-xs font-bold text-slate-600 mb-1">Select Customer</label>
        <select 
          value={selectedCustId} 
          onChange={e => setSelectedCustId(e.target.value)}
          className="w-full border rounded-lg p-2 text-sm"
        >
          <option value="">-- Choose Customer --</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
        </select>
      </div>

      {/* Pending Invoices List */}
      {selectedCustId && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="font-bold text-slate-800 mb-4">Outstanding Invoices</h2>
            <div className="space-y-3">
              {pendingInvoices.map(inv => (
                <div 
                  key={inv.id} 
                  onClick={() => setSelectedInvoice(inv)}
                  className={`p-4 rounded-lg border cursor-pointer transition ${
                    selectedInvoice?.id === inv.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-emerald-700 text-sm">{inv.order_number}</span>
                      <p className="text-xs text-slate-500">{new Date(inv.invoice_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">Total: ₹{inv.total_amount}</p>
                      <p className="text-xs text-rose-600 font-bold">Due: ₹{inv.total_amount - (inv.paid_amount || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Collection Panel */}
          {selectedInvoice && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Collect Payment for {selectedInvoice.order_number}</h3>
              
              <div className="space-y-2">
                {paymentRows.map((p, idx) => (
                  <div key={idx} className="flex space-x-2">
                    <select 
                      value={p.method} 
                      onChange={e => {
                        const updated = [...paymentRows];
                        updated[idx].method = e.target.value;
                        setPaymentRows(updated);
                      }}
                      className="text-xs border rounded p-1"
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
                        const updated = [...paymentRows];
                        updated[idx].amount = Number(e.target.value);
                        setPaymentRows(updated);
                      }}
                      className="flex-1 text-xs border rounded p-1"
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={handleCollectPayment}
                disabled={loading}
                className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-emerald-700 transition"
              >
                {loading ? 'Recording...' : 'Record Allocation'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}