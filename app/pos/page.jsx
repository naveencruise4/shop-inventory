'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Trash2, ShoppingCart, CreditCard, UserPlus } from 'lucide-react';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSalesman, setSelectedSalesman] = useState('');
  const [checkoutMode, setCheckoutMode] = useState('direct_sale'); // 'direct_sale' or 'sales_order'
  const [invoiceType, setInvoiceType] = useState('gst'); // 'gst' or 'estimate'
  const [fulfillmentStatus, setFulfillmentStatus] = useState('not_set');
  const [roundingOn, setRoundingOn] = useState(false);
  
  // Multi-tender payments state
  const [payments, setPayments] = useState([{ method: 'cash', amount: 0 }]);
  const [loading, setLoading] = useState(false);

  // New B2B Customer Modal State
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '', is_business: false, gstin: '' });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const { data: prodData } = await supabase.from('vw_product_stock').select('*');
    const { data: custData } = await supabase.from('customers').select('*');
    const { data: salesData } = await supabase.from('salesman').select('*');

    if (prodData) setProducts(prodData);
    if (custData) setCustomers(custData);
    if (salesData) setSalesmen(salesData);
  };

  const addToCart = (product) => {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        selling_price: Number(product.selling_price),
        quantity: 1,
        has_gst: Boolean(product.has_gst),
        gst_percentage: Number(product.gst_percentage || 0)
      }]);
    }
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));

  const updateQuantity = (id, qty) => {
    if (qty <= 0) removeFromCart(id);
    else setCart(cart.map(i => i.id === id ? { ...i, quantity: Number(qty) } : i));
  };

  // Tax and Total Calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  
  const calculatedTax = cart.reduce((sum, item) => {
    if (item.has_gst && item.gst_percentage > 0) {
      const basePrice = item.selling_price / (1 + (item.gst_percentage / 100));
      return sum + ((item.selling_price - basePrice) * item.quantity);
    }
    return sum;
  }, 0);

  const rawTotal = rawSubtotal;
  const roundedTotal = roundingOn ? Math.round(rawTotal) : rawTotal;
  const roundingAdjustment = roundedTotal - rawTotal;

  const handleAddPaymentRow = () => {
    setPayments([...payments, { method: 'upi', amount: 0 }]);
  };

  const handleUpdatePayment = (index, field, val) => {
    const updated = [...payments];
    updated[index][field] = field === 'amount' ? Number(val) : val;
    setPayments(updated);
  };

  const handleRemovePaymentRow = (index) => {
    if (payments.length > 1) setPayments(payments.filter((_, i) => i !== index));
  };

  const handleCreateCustomer = async () => {
    if (!newCust.name || !newCust.phone) return alert('Name and phone are required');
    const { data, error } = await supabase.from('customers').insert([{
      shop_id: products[0]?.shop_id,
      name: newCust.name,
      phone: newCust.phone,
      address: newCust.address,
      is_business: newCust.is_business,
      gstin: newCust.is_business ? newCust.gstin : null
    }]).select();

    if (error) return alert(error.message);
    setCustomers([...customers, data[0]]);
    setSelectedCustomer(data[0].id);
    setShowCustModal(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    if (!selectedCustomer) return alert('Please select a customer!');

    if (fulfillmentStatus === 'not_set') {
      const confirmProceed = confirm('Fulfillment status is NOT SET. Do you want to proceed without setting delivery status?');
      if (!confirmProceed) return;
    }

    setLoading(true);

    const itemsPayload = cart.map(item => {
      const basePrice = item.has_gst ? item.selling_price / (1 + (item.gst_percentage / 100)) : item.selling_price;
      const gstAmt = item.selling_price - basePrice;
      return {
        product_id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.selling_price,
        has_gst: item.has_gst,
        gst_percentage: item.gst_percentage,
        base_price: basePrice,
        gst_amount: gstAmt
      };
    });

    const paymentsPayload = payments
      .filter(p => Number(p.amount) > 0)
      .map(p => ({ payment_method: p.method, amount: Number(p.amount) }));

    const shopId = products[0]?.shop_id;

    try {
      if (checkoutMode === 'direct_sale') {
        const { data, error } = await supabase.rpc('create_direct_sale', {
          p_shop_id: shopId,
          p_customer_id: selectedCustomer,
          p_salesman_id: selectedSalesman || null,
          p_invoice_type: invoiceType,
          p_items: itemsPayload,
          p_payments: paymentsPayload,
          p_rounding_adjustment: roundingAdjustment,
          p_total_amount: roundedTotal,
          p_fulfillment_status: fulfillmentStatus
        });

        if (error) throw error;
        alert(`Direct Sale Invoice created successfully! Invoice ID: ${data}`);
      } else {
        const { data, error } = await supabase.rpc('create_sales_order', {
          p_shop_id: shopId,
          p_customer_id: selectedCustomer,
          p_salesman_id: selectedSalesman || null,
          p_total_amount: roundedTotal,
          p_items: itemsPayload,
          p_payments: paymentsPayload,
          p_fulfillment_status: fulfillmentStatus
        });

        if (error) throw error;
        alert(`Sales Order (Pre-Order) booked successfully! Booking ID: ${data}`);
      }

      setCart([]);
      setPayments([{ method: 'cash', amount: 0 }]);
    } catch (err) {
      alert(`Checkout Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Product Selection Catalog */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Point of Sale</h2>
        
        <div className="grid grid-cols-3 gap-4">
          {products.map(product => (
            <div key={product.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">{product.sku}</span>
                <h3 className="font-semibold text-slate-800">{product.name}</h3>
                <p className="text-sm text-slate-500 font-medium">Available: {product.available_stock || 0}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-600">₹{product.selling_price}</span>
                <button 
                  onClick={() => addToCart(product)}
                  className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout Panel */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg">
        {/* Checkout Mode Segmented Toggle */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200 rounded-lg">
            <button
              onClick={() => setCheckoutMode('direct_sale')}
              className={`py-2 text-xs font-bold rounded-md transition ${
                checkoutMode === 'direct_sale' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Direct Sale
            </button>
            <button
              onClick={() => setCheckoutMode('sales_order')}
              className={`py-2 text-xs font-bold rounded-md transition ${
                checkoutMode === 'sales_order' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Pre-Order Booking
            </button>
          </div>
        </div>

        {/* Customer & Settings Header */}
        <div className="p-4 space-y-3 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 p-2 text-sm"
            >
              <option value="">-- Select Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone}) {c.is_business ? '[B2B]' : ''}</option>
              ))}
            </select>
            <button 
              onClick={() => setShowCustModal(true)}
              className="p-2 bg-slate-100 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          <select
            value={selectedSalesman}
            onChange={(e) => setSelectedSalesman(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          >
            <option value="">-- Select Salesman --</option>
            {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {checkoutMode === 'direct_sale' && (
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Invoice Type:</span>
              <div className="space-x-2">
                <label><input type="radio" value="gst" checked={invoiceType === 'gst'} onChange={() => setInvoiceType('gst')} /> GST</label>
                <label><input type="radio" value="estimate" checked={invoiceType === 'estimate'} onChange={() => setInvoiceType('estimate')} /> Estimate</label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Fulfillment:</span>
            <select 
              value={fulfillmentStatus} 
              onChange={(e) => setFulfillmentStatus(e.target.value)}
              className="rounded border border-slate-300 p-1 text-xs"
            >
              <option value="not_set">Not Set</option>
              <option value="pending">Pending</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-400">₹{item.selling_price} x {item.quantity}</p>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="number" 
                  min="1"
                  value={item.quantity} 
                  onChange={(e) => updateQuantity(item.id, e.target.value)}
                  className="w-12 text-center rounded border border-slate-300 py-1 text-xs"
                />
                <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Payments & Totals Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          {/* Multi-Tender Entry */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-600">Payment Tenders</span>
              <button onClick={handleAddPaymentRow} className="text-xs text-emerald-600 font-bold hover:underline">+ Add Method</button>
            </div>
            {payments.map((p, idx) => (
              <div key={idx} className="flex space-x-2 mb-1">
                <select 
                  value={p.method} 
                  onChange={(e) => handleUpdatePayment(idx, 'method', e.target.value)}
                  className="rounded border border-slate-300 text-xs p-1"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
                <input 
                  type="number" 
                  placeholder="Amount" 
                  value={p.amount} 
                  onChange={(e) => handleUpdatePayment(idx, 'amount', e.target.value)}
                  className="flex-1 rounded border border-slate-300 text-xs p-1"
                />
                {payments.length > 1 && (
                  <button onClick={() => handleRemovePaymentRow(idx)} className="text-rose-500 text-xs">X</button>
                )}
              </div>
            ))}
          </div>

          {/* Rounding Control */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input type="checkbox" checked={roundingOn} onChange={(e) => setRoundingOn(e.target.checked)} />
              <span>Enable Rounding</span>
            </label>
            {roundingOn && <span className="text-slate-400">Adj: ₹{roundingAdjustment.toFixed(2)}</span>}
          </div>

          <div className="flex justify-between text-lg font-bold text-slate-800">
            <span>Total Payable:</span>
            <span>₹{roundedTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-emerald-700 transition flex items-center justify-center space-x-2"
          >
            <CreditCard className="w-5 h-5" />
            <span>{loading ? 'Processing...' : checkoutMode === 'direct_sale' ? 'Complete Direct Sale' : 'Book Sales Order'}</span>
          </button>
        </div>
      </div>

      {/* Create B2B Customer Modal */}
      {showCustModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-96 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-800">New Customer Master</h3>
            <input 
              type="text" placeholder="Name *" value={newCust.name} 
              onChange={e => setNewCust({...newCust, name: e.target.value})} 
              className="w-full border rounded p-2 text-sm" 
            />
            <input 
              type="text" placeholder="Phone *" value={newCust.phone} 
              onChange={e => setNewCust({...newCust, phone: e.target.value})} 
              className="w-full border rounded p-2 text-sm" 
            />
            <input 
              type="text" placeholder="Address" value={newCust.address} 
              onChange={e => setNewCust({...newCust, address: e.target.value})} 
              className="w-full border rounded p-2 text-sm" 
            />
            
            <label className="flex items-center space-x-2 text-sm">
              <input 
                type="checkbox" checked={newCust.is_business} 
                onChange={e => setNewCust({...newCust, is_business: e.target.checked})} 
              />
              <span>Is Business Customer (B2B)?</span>
            </label>

            {newCust.is_business && (
              <input 
                type="text" placeholder="GSTIN Number" value={newCust.gstin} 
                onChange={e => setNewCust({...newCust, gstin: e.target.value.toUpperCase()})} 
                className="w-full border rounded p-2 text-sm" 
              />
            )}

            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowCustModal(false)} className="px-3 py-1 text-slate-500 text-sm">Cancel</button>
              <button onClick={handleCreateCustomer} className="px-4 py-1 bg-emerald-600 text-white rounded text-sm font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}