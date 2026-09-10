'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  
  // POS Cart State
  const [cart, setCart] = useState([]);
  
  // Search & Dropdown State
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Checkout Processing State
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();

    // Close dropdown on outside click
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
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

  // Filter products for POS search bar
  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add product to cart or increment quantity if already exists
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
        price: product.selling_price
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

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  };

  // Handle Checkout Process
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

      // 1. Insert Master Sale Record
      const { data: saleData, error: saleErr } = await supabase.from('sales').insert([{
        shop_id: currentShopId,
        customer_id: selectedCustomer || null,
        sale_status: 'completed',
        total_amount: calculateTotal()
      }]).select().single();

      if (saleErr) throw saleErr;

      // 2. Insert Sale Items & Deduct Stock
      for (const item of cart) {
        // Insert item record
        await supabase.from('sale_items').insert([{
          shop_id: currentShopId,
          sale_id: saleData.id,
          product_id: item.id,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price
        }]);

        // Deduct from physical stock quantity
        const newStock = item.total_stock - item.quantity;
        await supabase.from('productsinfo').update({
          stock_quantity: newStock
        }).eq('id', item.id);
      }

      alert('Checkout completed successfully!');
      setCart([]);
      setSelectedCustomer('');
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

              {/* Quick Grid or Category shortcuts if needed */}
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
              
              <div className="customer-select-row">
                <label>Customer (Optional)</label>
                <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
                  ))}
                </select>
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
                        <th>Price</th>
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
                          <td>₹{item.price}</td>
                          <td>₹{item.price * item.quantity}</td>
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
                <div className="total-row">
                  <span>Total Amount:</span>
                  <span className="grand-total">₹{calculateTotal().toFixed(2)}</span>
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
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        
        .pos-container { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; height: fit-content; }
        
        .search-dropdown-container { position: relative; margin-bottom: 20px; }
        .search-input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
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
        .customer-select-row { margin-bottom: 16px; }
        .customer-select-row label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
        .customer-select-row select { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; background: #white; }

        .cart-items-wrapper { min-height: 220px; max-height: 350px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; }
        .cart-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cart-table th { background: #f1f5f9; padding: 8px 10px; text-align: left; color: #475569; }
        .cart-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .empty-cart-text { text-align: center; color: #94a3b8; padding: 40px 0; margin: 0; font-size: 13px; }

        .qty-controls { display: flex; align-items: center; gap: 6px; }
        .qty-controls button { background: #e2e8f0; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold; font-size: 14px; }

        .cart-summary { border-top: 1px solid #e2e8f0; padding-top: 14px; }
        .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold; margin-bottom: 14px; color: #0f172a; }
        .grand-total { font-size: 20px; color: #16a34a; }
        .checkout-btn { width: 100%; background: #16a34a; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; }
        .checkout-btn:disabled { background: #cbd5e1; cursor: not-allowed; }
      `}</style>
    </div>
  );
}