'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Selected Customer State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' });

  // POS Cart State
  const [cart, setCart] = useState([]);
  const [customGrandTotal, setCustomGrandTotal] = useState(''); // Order-level total override
  
  // Search & Dropdown State
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('vw_product_stock').select('*');
    if (data) setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data);
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const addToCart = (product) => {
    if (product.available_stock <= 0) {
      alert('This product is out of stock!');
      return;
    }

    const existingIndex = cart.findIndex(item => item.id === product.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const currentQty = updatedCart[existingIndex].quantity;
      if (currentQty + 1 > product.available_stock) {
        alert(`Cannot add more. Only ${product.available_stock} units available.`);
        return;
      }
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        ...product,
        quantity: 1,
        originalPrice: product.selling_price,
        price: product.selling_price // Negotiable price
      }]);
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const updateCartQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty > item.available_stock) {
          alert(`Only ${item.available_stock} units available in stock.`);
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  // Handle individual item price change (Bargaining)
  const handleItemPriceChange = (id, newPriceVal) => {
    const newPrice = Number(newPriceVal);
    setCart(cart.map(item => item.id === id ? { ...item, price: isNaN(newPrice) ? 0 : newPrice } : item));
    setCustomGrandTotal(''); // Reset custom total when individual items change manually
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
    setCustomGrandTotal('');
  };

  // Calculate standard subtotal sum
  const calculateOriginalSubtotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.originalPrice) * Number(item.quantity)), 0);
  };

  const calculateCurrentSubtotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  };

  // Handle Order-Level Total Adjustment (Auto-adjusts item prices proportionally)
  const handleCustomTotalChange = (val) => {
    setCustomGrandTotal(val);
    const newTotal = Number(val);
    const currentSub = calculateCurrentSubtotal();

    if (!isNaN(newTotal) && newTotal > 0 && currentSub > 0) {
      const ratio = newTotal / currentSub;
      // Proportional distribution across items
      setCart(cart.map(item => ({
        ...item,
        price: Number((item.price * ratio).toFixed(2))
      })));
    }
  };

  const getFinalTotal = () => {
    const custom = Number(customGrandTotal);
    return (!isNaN(custom) && custom > 0) ? custom : calculateCurrentSubtotal();
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    const { data: shops } = await supabase.from('shops').select('id').limit(1);
    const currentShopId = shops?.[0]?.id;

    if (!currentShopId) {
      alert('Error: No active shop found.');
      return;
    }

    const { data: newCustomerData, error } = await supabase.from('customers').insert([{
      shop_id: currentShopId,
      name: newCust.name,
      phone: newCust.phone,
      email: newCust.email
    }]).select().single();

    if (error) {
      alert(`Failed to create customer: ${error.message}`);
      return;
    }

    await fetchCustomers();
    setSelectedCustomer(newCustomerData);
    setCustomerSearch(`${newCustomerData.name} (${newCustomerData.phone})`);
    setShowNewCustomerModal(false);
    setNewCust({ name: '', phone: '', email: '' });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      const { data: shops } = await supabase.from('shops').select('id').limit(1);
      const currentShopId = shops?.[0]?.id;

      if (!currentShopId) {
        alert('Error: No active shop found.');
        setIsCheckingOut(false);
        return;
      }

      const finalTotal = getFinalTotal();

      // Format cart items payload for the Postgres function
      const itemsPayload = cart.map(item => ({
        product_id: item.id,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price
      }));

      // Call the atomic database RPC transaction
      const { data: saleId, error: rpcError } = await supabase.rpc('complete_sale', {
        p_shop_id: currentShopId,
        p_customer_id: selectedCustomer?.id || null,
        p_total_amount: finalTotal,
        p_items: itemsPayload
      });

      if (rpcError) throw rpcError;

      alert(`Checkout completed successfully! Sale ID: ${saleId}`);
      setCart([]);
      setCustomGrandTotal('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      fetchProducts();
    } catch (err) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <h1>POS Terminal</h1>
        </div>

        <div className="pos-container">
          {/* LEFT: Search & Catalog Selector */}
          <div className="pos-left">
            <div className="card">
              <h3>Find & Add Products</h3>
              <div className="search-dropdown-container" ref={dropdownRef}>
                <input 
                  placeholder="Scan barcode, type SKU or product name..." 
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="search-input"
                />
                {showDropdown && searchTerm.trim() !== '' && (
                  <div className="dropdown-list">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <div key={p.id} className="dropdown-item" onClick={() => addToCart(p)}>
                          <div>
                            <strong>{p.name}</strong> <span className="subtext">({p.sku})</span>
                          </div>
                          <div className="dropdown-right">
                            <span className="price">₹{p.selling_price}</span>
                            <span className={`stock-badge ${p.available_stock > 0 ? 'green' : 'red'}`}>
                              Stock: {p.available_stock}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="dropdown-item empty">No matching products found</div>
                    )}
                  </div>
                )}
              </div>

              <h4>Quick Catalog</h4>
              <div className="quick-grid">
                {products.slice(0, 8).map(p => (
                  <button key={p.id} className="quick-tile" onClick={() => addToCart(p)}>
                    <span className="tile-name">{p.name}</span>
                    <span className="tile-price">₹{p.selling_price}</span>
                    <span className="tile-stock">Available: {p.available_stock}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Active Cart & Checkout */}
          <div className="pos-right">
            <div className="card cart-card">
              <h3>Current Order Cart</h3>
              
              <div className="customer-select-section" ref={customerDropdownRef}>
                <label>Customer (Search Name or Mobile)</label>
                <div className="customer-input-row">
                  <input 
                    placeholder="Type name or mobile number..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="search-input"
                  />
                  {selectedCustomer && (
                    <button className="clear-cust-btn" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>✕</button>
                  )}
                </div>

                {showCustomerDropdown && customerSearch.trim() !== '' && (
                  <div className="dropdown-list">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(c => (
                        <div key={c.id} className="dropdown-item" onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch(`${c.name} (${c.phone || 'No Phone'})`);
                          setShowCustomerDropdown(false);
                        }}>
                          <div>
                            <strong>{c.name}</strong> <span className="subtext">{c.phone || 'No phone'}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="dropdown-item create-new-prompt" onClick={() => {
                        setShowCustomerDropdown(false);
                        setNewCust({ name: customerSearch, phone: isNaN(customerSearch) ? '' : customerSearch, email: '' });
                        setShowNewCustomerModal(true);
                      }}>
                        <span>🔍 Customer not found. <strong>+ Create new customer</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="cart-items-wrapper">
                {cart.length === 0 ? (
                  <p className="empty-cart-text">Cart is empty. Search or click products to add.</p>
                ) : (
                  <table className="cart-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Bargained Price (₹)</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong><br/>
                            <span className="subtext">{item.sku}</span>
                          </td>
                          <td>
                            <div className="qty-controls">
                              <button onClick={() => updateCartQuantity(item.id, -1)}>-</button>
                              <span>{item.quantity}</span>
                              <button onClick={() => updateCartQuantity(item.id, 1)}>+</button>
                            </div>
                          </td>
                          <td>
                            <div className="price-edit-cell">
                              <input 
                                type="number" 
                                value={item.price} 
                                onChange={(e) => handleItemPriceChange(item.id, e.target.value)}
                                className="table-price-input"
                              />
                              {item.price !== item.originalPrice && (
                                <span className="original-price-strike">₹{item.originalPrice}</span>
                              )}
                            </div>
                          </td>
                          <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                          <td>
                            <button className="remove-btn" onClick={() => removeFromCart(item.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Original Subtotal:</span>
                  <span className="strike-text">₹{calculateOriginalSubtotal().toFixed(2)}</span>
                </div>
                
                <div className="summary-row adjustment-row">
                  <span>Override Total / Final Amount (₹):</span>
                  <input 
                    type="number" 
                    placeholder="Enter custom total..." 
                    value={customGrandTotal}
                    onChange={(e) => handleCustomTotalChange(e.target.value)}
                    className="custom-total-input"
                  />
                </div>

                <div className="total-row">
                  <span>Final Payable Amount:</span>
                  <span className="grand-total">₹{getFinalTotal().toFixed(2)}</span>
                </div>

                <button 
                  className="checkout-btn" 
                  disabled={cart.length === 0 || isCheckingOut}
                  onClick={handleCheckout}
                >
                  {isCheckingOut ? 'Processing...' : 'Complete Sale & Checkout'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showNewCustomerModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add New Customer</h3>
              <form onSubmit={handleCreateCustomer}>
                <label>Customer Name</label>
                <input placeholder="Full name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} required />
                
                <label>Mobile Number</label>
                <input placeholder="Phone number" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />

                <label>Email Address (Optional)</label>
                <input type="email" placeholder="Email address" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
                
                <div className="modal-actions">
                  <button type="submit" className="action-btn">Save & Select Customer</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowNewCustomerModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        
        .pos-container { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; height: fit-content; }
        
        .search-dropdown-container { position: relative; margin-bottom: 20px; }
        .search-input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
        .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 250px; overflow-y: auto; z-index: 50; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-top: 2px; }
        .dropdown-item { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .dropdown-item:hover { background: #f8fafc; }
        .dropdown-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .dropdown-item .price { font-weight: bold; color: #0f172a; }
        .subtext { font-size: 11px; color: #94a3b8; }
        .stock-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
        .stock-badge.green { background: #dcfce7; color: #15803d; }
        .stock-badge.red { background: #fee2e2; color: #b91c1c; }

        .quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 10px; }
        .quick-tile { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: left; cursor: pointer; transition: 0.15s; display: flex; flex-direction: column; gap: 4px; }
        .quick-tile:hover { background: #f1f5f9; border-color: #cbd5e1; }
        .tile-name { font-weight: 600; font-size: 13px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tile-price { font-weight: bold; color: #0284c7; font-size: 13px; }
        .tile-stock { font-size: 11px; color: #64748b; }

        .cart-card { display: flex; flex-direction: column; }
        .customer-select-section { position: relative; margin-bottom: 16px; }
        .customer-select-section label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
        .customer-input-row { display: flex; position: relative; }
        .clear-cust-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; font-weight: bold; }
        .create-new-prompt { color: #0284c7; background: #f0fdf4; width: 100%; justify-content: flex-start; }

        .cart-items-wrapper { min-height: 200px; max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; }
        .cart-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cart-table th { background: #f1f5f9; padding: 8px 10px; text-align: left; color: #475569; }
        .cart-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .empty-cart-text { text-align: center; color: #94a3b8; padding: 40px 0; margin: 0; font-size: 13px; }

        .qty-controls { display: flex; align-items: center; gap: 6px; }
        .qty-controls button { background: #e2e8f0; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold; font-size: 14px; }

        .price-edit-cell { display: flex; flex-direction: column; gap: 2px; }
        .table-price-input { width: 80px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; }
        .original-price-strike { font-size: 11px; color: #94a3b8; text-decoration: line-through; }

        .cart-summary { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; }
        .strike-text { text-decoration: line-through; color: #94a3b8; }
        .adjustment-row { margin-bottom: 4px; }
        .custom-total-input { width: 120px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; text-align: right; }

        .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold; margin-top: 4px; margin-bottom: 10px; color: #0f172a; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
        .grand-total { font-size: 20px; color: #16a34a; }
        .checkout-btn { width: 100%; background: #16a34a; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; }
        .checkout-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .modal { background: white; padding: 24px; border-radius: 8px; width: 400px; display: flex; flex-direction: column; gap: 10px; }
        .modal input { padding: 10px; margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
        .modal label { font-size: 12px; color: #475569; font-weight: 500; }
        .modal-actions { display: flex; gap: 10px; margin-top: 10px; }
        .action-btn { flex: 1; padding: 10px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .cancel-btn { flex: 1; padding: 10px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  );
}