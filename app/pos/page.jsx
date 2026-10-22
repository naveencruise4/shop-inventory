'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [shopInfo, setShopInfo] = useState({ id: null, name: 'My Shop' });
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  
  // Selected Customer State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' });

  // Salesman State
  const [salesman, setSalesman] = useState([]);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [salesmanSearch, setSalesmanSearch] = useState('');
  const [showSalesmanDropdown, setShowSalesmanDropdown] = useState(false);

  // POS Cart State
  const [cart, setCart] = useState([]);
  const [customGrandTotal, setCustomGrandTotal] = useState('');
  
  // Search & Dropdown State
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedProductSearch, setAppliedProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const dropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  const salesmanDropdownRef = useRef(null);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saleStatus, setSaleStatus] = useState('completed');
<<<<<<< HEAD
=======

  // Print Receipt State
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
>>>>>>> n1.0

  useEffect(() => {
    fetchInitialData();
    fetchSalesman();

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
      if (salesmanDropdownRef.current && !salesmanDropdownRef.current.contains(e.target)) {
        setShowSalesmanDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSalesman = async () => {
    const { data } = await supabase.from('salesman').select('*');
    if (data) setSalesman(data);
  };

  const fetchInitialData = async () => {
    const { data: custs } = await supabase.from('customers').select('*');
    if (custs) setCustomers(custs);

    const { data: appUser } = await supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null };
      return supabase.from('users').select('shop_id').eq('id', user.id).single();
    });

    let currentShopId = appUser?.shop_id;

    if (!currentShopId) {
      const { data: shops } = await supabase.from('shops').select('id, name').limit(1);
      if (shops?.[0]) {
        currentShopId = shops[0].id;
        setShopInfo({ id: shops[0].id, name: shops[0].name });
      }
    } else {
      const { data: shop } = await supabase.from('shops').select('id, name').eq('id', currentShopId).single();
      if (shop) setShopInfo({ id: shop.id, name: shop.name });
    }

    if (currentShopId) {
      // Load initial quick catalog items (First 12 products)
      const { data: initialProds } = await supabase
        .from('vw_product_stock')
        .select('*')
        .eq('shop_id', currentShopId)
        .order('name', { ascending: true })
        .limit(12);

      if (initialProds) setProducts(initialProds);
    }
  };

  // Explicit Product Search Form Submit
  const handleProductSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const queryTerm = searchTerm.trim();
    setAppliedProductSearch(queryTerm);
    if (queryTerm) {
      performProductSearch(queryTerm);
    }
  };

  const performProductSearch = async (term) => {
    if (!shopInfo.id || !term) return;
    setIsSearchingProducts(true);

    try {
      const q = `%${term}%`;
      const { data, error } = await supabase
        .from('vw_product_stock')
        .select('*')
        .eq('shop_id', shopInfo.id)
        .or(`name.ilike.${q},sku.ilike.${q},category_name.ilike.${q}`)
        .limit(20);

      if (error) throw error;

      if (data && data.length > 0) {
        setProducts(data);
        setShowDropdown(true);

        // If exact 1 SKU or barcode match, automatically add to cart
        const exactSkuMatch = data.find(p => p.sku?.toLowerCase() === term.toLowerCase());
        if (data.length === 1 || exactSkuMatch) {
          addToCart(exactSkuMatch || data[0]);
        }
      } else {
        setProducts([]);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error('Error searching products:', err.message);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const handleClearProductSearch = () => {
    setSearchTerm('');
    setAppliedProductSearch('');
    setShowDropdown(false);
    fetchInitialData();
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const filteredSalesman = salesman.filter(s =>
    s.name?.toLowerCase().includes(salesmanSearch.toLowerCase())
  );

  const handleCreateSalesman = async () => {
    if (!salesmanSearch.trim() || !shopInfo.id) return;

    const { data: newSalesman, error } = await supabase
      .from('salesman')
      .insert([{ shop_id: shopInfo.id, name: salesmanSearch.trim() }])
      .select()
      .single();

    if (error) {
      alert(`Failed to add salesman: ${error.message}`);
      return;
    }

    setSelectedSalesman(newSalesman);
    setSalesmanSearch(newSalesman.name);
    setShowSalesmanDropdown(false);
    fetchSalesman();
  };

  const addToCart = (product) => {
    if (product.available_stock <= 0) {
      alert('This product is out of stock!');
      return;
    }

    const hasGst = product.has_gst ?? false;
    const gstPct = Number(product.gst_percentage || 0);

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
        price: product.selling_price,
        has_gst: hasGst,
        gst_percentage: gstPct
      }]);
    }
    setSearchTerm('');
    setAppliedProductSearch('');
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

  const handleItemPriceChange = (id, newPriceVal) => {
    const newPrice = Number(newPriceVal);
    setCart(cart.map(item => item.id === id ? { ...item, price: isNaN(newPrice) ? 0 : newPrice } : item));
    setCustomGrandTotal('');
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
    setCustomGrandTotal('');
  };

  const calculateOriginalSubtotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.originalPrice) * Number(item.quantity)), 0);
  };

  const calculateCurrentSubtotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  };

<<<<<<< HEAD
  // Accurate Item-Level & Grand Total GST Calculations
=======
>>>>>>> n1.0
  const calculateTotalGSTBreakdown = () => {
    let totalBase = 0;
    let totalGst = 0;

    cart.forEach(item => {
      const itemInclusiveTotal = item.price * item.quantity;
      const pct = Number(item.gst_percentage || 0);

      if (item.has_gst && pct > 0) {
        const base = itemInclusiveTotal / (1 + pct / 100);
        const gst = itemInclusiveTotal - base;
        totalBase += base;
        totalGst += gst;
      } else {
        totalBase += itemInclusiveTotal;
      }
    });

    return { totalBase, totalGst };
  };

  const handleCustomTotalChange = (val) => {
    setCustomGrandTotal(val);
    const newTotal = Number(val);
    const currentSub = calculateCurrentSubtotal();

    if (!isNaN(newTotal) && newTotal > 0 && currentSub > 0) {
      const ratio = newTotal / currentSub;
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
    if (!shopInfo.id) {
      alert('Error: No active shop found.');
      return;
    }

    const { data: newCustomerData, error } = await supabase.from('customers').insert([{
      shop_id: shopInfo.id,
      name: newCust.name,
      phone: newCust.phone,
      email: newCust.email
    }]).select().single();

    if (error) {
      alert(`Failed to create customer: ${error.message}`);
      return;
    }

    const { data: custs } = await supabase.from('customers').select('*');
    if (custs) setCustomers(custs);

    setSelectedCustomer(newCustomerData);
    setCustomerSearch(`${newCustomerData.name} (${newCustomerData.phone})`);
    setShowNewCustomerModal(false);
    setNewCust({ name: '', phone: '', email: '' });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      if (!shopInfo.id) {
        alert('Error: No active shop found.');
        setIsCheckingOut(false);
        return;
      }

      const finalTotal = getFinalTotal();
      const actualPaidAmount = amountPaid !== '' ? Number(amountPaid) : finalTotal;
      const pendingAmount = Math.max(0, finalTotal - actualPaidAmount);
      const { totalBase, totalGst } = calculateTotalGSTBreakdown();

      const itemsPayload = cart.map(item => {
        const pct = Number(item.gst_percentage || 0);
        const isTaxed = item.has_gst && pct > 0;

        const baseUnitPrice = isTaxed 
          ? Number((item.price / (1 + pct / 100)).toFixed(2))
          : item.price;
        
        const unitGstAmount = isTaxed
          ? Number((item.price - baseUnitPrice).toFixed(2))
          : 0;

        return {
          product_id: item.id,
          sku: item.sku,
<<<<<<< HEAD
=======
          name: item.name,
>>>>>>> n1.0
          quantity: item.quantity,
          price: item.price,
          unit_price: item.price,
          has_gst: item.has_gst,
          gst_percentage: pct,
          base_price: baseUnitPrice,
          gst_amount: unitGstAmount * item.quantity
        };
      });

      const { data: saleId, error: rpcError } = await supabase.rpc('complete_sale', {
        p_shop_id: shopInfo.id,
        p_customer_id: selectedCustomer?.id || null,
        p_total_amount: finalTotal,
        p_items: itemsPayload,
        p_amount_paid: actualPaidAmount,
        p_payment_method: paymentMethod || 'cash',
        p_sale_status: saleStatus || 'completed',
        p_salesman_id: selectedSalesman?.id || null
      });

      if (rpcError) throw rpcError;

      setCompletedOrder({
        saleId,
        shopName: shopInfo.name,
        date: new Date().toLocaleString(),
        customer: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        customerPhone: selectedCustomer ? selectedCustomer.phone : '',
        salesmanName: selectedSalesman ? selectedSalesman.name : 'Unassigned',
        items: itemsPayload,
        totalAmount: finalTotal,
        paidAmount: actualPaidAmount,
        pendingAmount: pendingAmount,
        paymentMethod,
        totalBase,
        totalGst
      });

      setShowReceiptModal(true);

      setCart([]);
      setCustomGrandTotal('');
      setAmountPaid('');
      setSaleStatus('completed');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setSelectedSalesman(null);
      setSalesmanSearch('');

      fetchInitialData();

    } catch (err) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

<<<<<<< HEAD
=======
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

>>>>>>> n1.0
  const { totalBase, totalGst } = calculateTotalGSTBreakdown();

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
              
              {/* EXPLICIT SEARCH FORM WITH BUTTON */}
              <div className="search-dropdown-container" ref={dropdownRef}>
                <form onSubmit={handleProductSearchSubmit} className="search-form-group">
                  <input 
                    placeholder="Scan barcode, type SKU or product name & press Enter..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  <button type="submit" className="search-btn" disabled={isSearchingProducts}>
                    {isSearchingProducts ? '...' : '🔍 Search'}
                  </button>
                  {appliedProductSearch && (
                    <button type="button" onClick={handleClearProductSearch} className="clear-btn">
                      ✕ Clear
                    </button>
                  )}
                </form>

                {showDropdown && (
                  <div className="dropdown-list">
                    {products.length > 0 ? (
                      products.map(p => (
                        <div key={p.id} className="dropdown-item" onClick={() => addToCart(p)}>
                          <div>
                            <strong>{p.name}</strong> <span className="subtext">({p.sku})</span>
                            {p.has_gst && Number(p.gst_percentage) > 0 && (
                              <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', marginLeft: '6px', padding: '2px 4px', borderRadius: '4px' }}>
                                GST {p.gst_percentage}%
                              </span>
                            )}
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
              
              {/* ALIGNED 2-COLUMN FORM ROW FOR CUSTOMER & SALESMAN */}
              <div className="pos-meta-grid">
                {/* Customer Dropdown */}
                <div className="select-section" ref={customerDropdownRef}>
                  <label>Customer</label>
                  <div className="customer-input-row">
                    <input 
                      placeholder="Search name or phone..."
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

                {/* Salesman Dropdown */}
                <div className="select-section" ref={salesmanDropdownRef}>
                  <label>Sales Rep / Lead</label>
                  <div className="customer-input-row">
                    <input 
                      placeholder="Type salesman name..."
                      value={salesmanSearch}
                      onChange={(e) => {
                        setSalesmanSearch(e.target.value);
                        setShowSalesmanDropdown(true);
                        if (!e.target.value) setSelectedSalesman(null);
                      }}
                      onFocus={() => setShowSalesmanDropdown(true)}
                      className="search-input"
                    />
                    {selectedSalesman && (
                      <button className="clear-cust-btn" onClick={() => { setSelectedSalesman(null); setSalesmanSearch(''); }}>✕</button>
                    )}
                  </div>

                  {showSalesmanDropdown && salesmanSearch.trim() !== '' && (
                    <div className="dropdown-list">
                      {filteredSalesman.length > 0 ? (
                        filteredSalesman.map(s => (
                          <div key={s.id} className="dropdown-item" onClick={() => {
                            setSelectedSalesman(s);
                            setSalesmanSearch(s.name);
                            setShowSalesmanDropdown(false);
                          }}>
                            <strong>{s.name}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="dropdown-item create-new-prompt" onClick={handleCreateSalesman}>
                          <span>🔍 Salesman not found. <strong>+ Create "{salesmanSearch}"</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                        <th>Price (₹)</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => {
                        const pct = Number(item.gst_percentage || 0);
                        const isTaxed = item.has_gst && pct > 0;
                        const lineTotal = item.price * item.quantity;
                        const baseUnit = isTaxed ? (item.price / (1 + pct / 100)) : item.price;
                        const lineGst = isTaxed ? (lineTotal - (baseUnit * item.quantity)) : 0;

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.name}</strong><br/>
                              <span className="subtext">{item.sku}</span>
                              {isTaxed ? (
                                <span style={{ display: 'block', fontSize: '10px', color: '#0369a1', marginTop: '2px' }}>
                                  Incl. {pct}% GST (Base: ₹{baseUnit.toFixed(2)} | GST: ₹{(lineGst / item.quantity).toFixed(2)})
                                </span>
                              ) : (
                                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  Non-GST / Exempt
                                </span>
                              )}
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
                            <td>₹{lineTotal.toFixed(2)}</td>
                            <td>
                              <button className="remove-btn" onClick={() => removeFromCart(item.id)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                    <span>Original Subtotal:</span>
                    <span className="strike-text">₹{calculateOriginalSubtotal().toFixed(2)}</span>
                </div>

                {cart.length > 0 && (
                  <div className="summary-row" style={{ fontSize: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '6px 8px', borderRadius: '4px', color: '#0369a1' }}>
                    <span>Tax Breakdown:</span>
                    <span>Base: ₹{totalBase.toFixed(2)} | Total GST: ₹{totalGst.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="summary-row adjustment-row">
                    <span>Override Total (₹):</span>
                    <input 
                      type="number" 
                      placeholder="Enter custom total..." 
                      value={customGrandTotal}
                      onChange={(e) => handleCustomTotalChange(e.target.value)}
                      className="custom-total-input"
                    />
                </div>

                <div className="summary-row">
                    <span>Amount Paid (₹):</span>
                    <input 
                      type="number" 
                      placeholder="Leave blank for full" 
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="custom-total-input"
                    />
                </div>

                <div className="summary-row">
                    <span>Payment Method:</span>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="custom-total-input" style={{ width: '130px' }}>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                </div>

                <div className="summary-row">
                    <span>Fulfillment Status:</span>
                    <select value={saleStatus} onChange={(e) => setSaleStatus(e.target.value)} className="custom-total-input" style={{ width: '130px' }}>
                      <option value="completed">Delivered / Completed</option>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                    </select>
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

        {/* Modal: New Customer */}
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

        {/* Modal & Printable Receipt */}
        {showReceiptModal && completedOrder && (
          <div className="modal-overlay receipt-modal-overlay">
            <div className="modal receipt-modal-container">
              <div className="receipt-actions no-print">
                <h3>Sale Completed Successfully!</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="primary-btn" onClick={handlePrint}>🖨️ Print Receipt (A5 Half Sheet)</button>
                  <button className="cancel-btn" onClick={() => setShowReceiptModal(false)}>Close</button>
                </div>
              </div>

              {/* PRINTABLE RECEIPT TEMPLATE */}
              <div id="printable-receipt" className="receipt-box">
                <div className="receipt-header">
                  <h2>{completedOrder.shopName}</h2>
                  <p className="receipt-subtitle">Estimate</p>
                  <div className="receipt-meta">
                    <div><strong>Date:</strong> {completedOrder.date}</div>
                    <div><strong>Order ID:</strong> {completedOrder.saleId?.slice(0, 8)}</div>
                  </div>
                  <div className="receipt-meta">
                    <div><strong>Customer:</strong> {completedOrder.customer} {completedOrder.customerPhone ? `(${completedOrder.customerPhone})` : ''}</div>
                    <div><strong>Payment:</strong> {completedOrder.paymentMethod.toUpperCase()}</div>
                  </div>
                  <div className="receipt-meta">
                    <div><strong>Sales Lead:</strong> {completedOrder.salesmanName}</div>
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
                    {completedOrder.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          {it.name || it.sku}
                          {it.has_gst && it.gst_percentage > 0 && (
                            <span className="receipt-subtext"> (Incl. {it.gst_percentage}% GST)</span>
                          )}
                        </td>
                        <td>{it.quantity}</td>
                        <td>₹{Number(it.price).toFixed(2)}</td>
                        <td>₹{(it.quantity * it.price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="receipt-summary-block">
                  {completedOrder.totalGst > 0 && (
                    <div className="receipt-row">
                      <span>Taxable Amount (Base):</span>
                      <span>₹{completedOrder.totalBase.toFixed(2)}</span>
                    </div>
                  )}
                  {completedOrder.totalGst > 0 && (
                    <div className="receipt-row">
                      <span>Total GST Extracted:</span>
                      <span>₹{completedOrder.totalGst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="receipt-row grand-total-row">
                    <span>Grand Total:</span>
                    <span>₹{completedOrder.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Amount Paid:</span>
                    <span>₹{completedOrder.paidAmount.toFixed(2)}</span>
                  </div>
                  {completedOrder.pendingAmount > 0 && (
                    <div className="receipt-row pending-row" style={{ color: '#b91c1c', fontWeight: 'bold' }}>
                      <span>Balance Due / Pending:</span>
                      <span>₹{completedOrder.pendingAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="receipt-footer">
                  <p>Thank you for shopping with us!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        /* --- POS PAGE STYLES --- */
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .pos-container { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; height: fit-content; }
        .search-dropdown-container { position: relative; margin-bottom: 20px; }
        
        .search-form-group { display: flex; gap: 8px; align-items: center; width: 100%; }
        .search-input { flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
        .search-btn { background: #0f172a; color: white; border: none; padding: 10px 14px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; white-space: nowrap; }
        .clear-btn { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; }
        .clear-btn:hover { background: #e2e8f0; }

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
        
        /* 2-COLUMN ALIGNED FORM ROW FOR CUSTOMER & SALESMAN */
        .pos-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .select-section { position: relative; }
        .select-section label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; font-weight: 600; }
        .customer-input-row { display: flex; position: relative; }
        .clear-cust-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; font-weight: bold; }
        .create-new-prompt { color: #0284c7; background: #f0fdf4; width: 100%; justify-content: flex-start; }
<<<<<<< HEAD
=======
        
>>>>>>> n1.0
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
        .action-btn, .primary-btn { padding: 10px 16px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .cancel-btn { padding: 10px 16px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; }

        /* Receipt On-Screen Modal Layout */
        .receipt-modal-container { width: 550px; max-height: 90vh; overflow-y: auto; }
        .receipt-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
        .receipt-box { background: #fff; padding: 20px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: sans-serif; }
        .receipt-header { text-align: center; border-bottom: 1px dashed #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
        .receipt-header h2 { margin: 0 0 4px 0; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        .receipt-subtitle { margin: 0 0 10px 0; font-size: 12px; color: #64748b; }
        .receipt-meta { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; color: #334155; }
        .receipt-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        .receipt-table th { border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 6px 4px; text-align: left; }
        .receipt-table td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; }
        .receipt-subtext { font-size: 10px; color: #64748b; }
        .receipt-summary-block { border-top: 1px dashed #0f172a; padding-top: 8px; margin-top: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
        .receipt-row { display: flex; justify-content: space-between; }
        .grand-total-row { font-size: 14px; font-weight: bold; border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 4px 0; margin: 4px 0; }
        .receipt-footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
      `}</style>

     <style jsx global>{`
        #print-mount-root {
          display: none !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          body > *:not(#print-mount-root) {
            display: none !important;
          }

          body > #print-mount-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 148mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #fff !important;
            color: #000 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          #print-mount-root,
          #print-mount-root * {
            box-sizing: border-box !important;
          }

          #print-mount-root .receipt-box {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 132mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
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
            display: table-header-group;
          }

          #print-mount-root .receipt-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #print-mount-root .receipt-header,
          #print-mount-root .receipt-summary-block,
          #print-mount-root .receipt-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}