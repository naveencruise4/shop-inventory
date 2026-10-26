'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import PrintableReceiptModal from '@/components/PrintableReceiptModal';
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

  // Order Options
  const [orderType, setOrderType] = useState('sale'); // 'sale' | 'pre_order'
  const [billingMode, setBillingMode] = useState('auto_split');

  // Pre-Order Conversion & Internal Search State
  const [pendingPreOrders, setPendingPreOrders] = useState([]);
  const [preOrderSearch, setPreOrderSearch] = useState('');
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);
  const [convertingPreOrder, setConvertingPreOrder] = useState(null);

  // POS Cart State
  const [cart, setCart] = useState([]);
  const [customGrandTotal, setCustomGrandTotal] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedProductSearch, setAppliedProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  const salesmanDropdownRef = useRef(null);
  const cartScrollRef = useRef(null);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saleStatus, setSaleStatus] = useState('completed');

  // Printable Receipt State
  const [completedGstOrder, setCompletedGstOrder] = useState(null);
  const [completedEstimateOrder, setCompletedEstimateOrder] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
    fetchSalesman();

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) setShowCustomerDropdown(false);
      if (salesmanDropdownRef.current && !salesmanDropdownRef.current.contains(e.target)) setShowSalesmanDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (cartScrollRef.current) {
      cartScrollRef.current.scrollTop = cartScrollRef.current.scrollHeight;
    }
  }, [cart]);

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
      const { data: initialProds } = await supabase
        .from('vw_product_stock')
        .select('*')
        .eq('shop_id', currentShopId)
        .order('name', { ascending: true })
        .limit(30);

      if (initialProds) setProducts(initialProds);
      fetchPendingPreOrders(currentShopId);
    }
  };

  const fetchPendingPreOrders = async (sid) => {
    const { data } = await supabase
      .from('sales')
      .select('*, customers(name, phone), sale_items(*)')
      .eq('shop_id', sid)
      .eq('sale_status', 'pre_order')
      .order('created_at', { ascending: false });

    if (data) setPendingPreOrders(data);
  };

  const handleProductSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const queryTerm = searchTerm.trim();
    setAppliedProductSearch(queryTerm);
    if (queryTerm) performProductSearch(queryTerm);
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
        const exactSkuMatch = data.find(p => p.sku?.toLowerCase() === term.toLowerCase());
        if (data.length === 1 || exactSkuMatch) addToCart(exactSkuMatch || data[0]);
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

  const filteredPreOrders = pendingPreOrders.filter(po => {
    const q = preOrderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      po.id.toLowerCase().includes(q) ||
      po.customers?.name?.toLowerCase().includes(q) ||
      po.customers?.phone?.includes(q)
    );
  });

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!shopInfo.id) return;

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
    if (orderType === 'sale' && !convertingPreOrder && Number(product.available_stock || 0) <= 0) {
      alert('This product is out of stock for immediate sale!');
      return;
    }

    if (convertingPreOrder) {
      const totalStock = Number(product.total_stock || 0);
      const deliveredStock = Number(product.delivered_stock || 0);
      const physicalHeadroom = totalStock - deliveredStock;
      if (physicalHeadroom <= 0) {
        alert('Cannot fulfill pre-order: No physical stock available (Total Stock <= Delivered Stock). Please receive supplier stock first.');
        return;
      }
    }

    const hasGst = product.has_gst ?? false;
    const gstPct = Number(product.gst_percentage || 0);
    const unitType = product.unit || product.unit_name || 'Nos';
    const defaultQty = 1;

    const existingIndex = cart.findIndex(item => item.id === product.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const nextQty = updatedCart[existingIndex].quantity + defaultQty;
      
      if (orderType === 'sale' && !convertingPreOrder && nextQty > Number(product.available_stock || 0)) {
        alert(`Cannot add more. Only ${product.available_stock} units available.`);
        return;
      }

      if (convertingPreOrder) {
        const totalStock = Number(product.total_stock || 0);
        const deliveredStock = Number(product.delivered_stock || 0);
        const physicalHeadroom = totalStock - deliveredStock;
        if (nextQty > physicalHeadroom) {
          alert(`Cannot fulfill more than available physical stock headroom (${physicalHeadroom} units).`);
          return;
        }
      }

      updatedCart[existingIndex].quantity = nextQty;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        ...product,
        quantity: defaultQty,
        unit: unitType,
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
        const isKgs = item.unit?.toLowerCase().includes('kg');
        const step = isKgs ? 0.5 : 1;
        const newQty = Number((item.quantity + (delta * step)).toFixed(3));

        if (orderType === 'sale' && !convertingPreOrder && newQty > Number(item.available_stock || 0)) {
          alert(`Only ${item.available_stock} units available in stock.`);
          return item;
        }

        if (convertingPreOrder) {
          const totalStock = Number(item.total_stock || 0);
          const deliveredStock = Number(item.delivered_stock || 0);
          const physicalHeadroom = totalStock - deliveredStock;
          if (newQty > physicalHeadroom) {
            alert(`Only ${physicalHeadroom} units of physical stock available for fulfillment.`);
            return item;
          }
        }

        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleCartQuantityInput = (id, val) => {
    const parsed = parseFloat(val);
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = isNaN(parsed) ? 0 : parsed;
        if (orderType === 'sale' && !convertingPreOrder && newQty > Number(item.available_stock || 0)) {
          alert(`Only ${item.available_stock} units available in stock.`);
          return { ...item, quantity: Number(item.available_stock) };
        }

        if (convertingPreOrder) {
          const totalStock = Number(item.total_stock || 0);
          const deliveredStock = Number(item.delivered_stock || 0);
          const physicalHeadroom = totalStock - deliveredStock;
          if (newQty > physicalHeadroom) {
            alert(`Only ${physicalHeadroom} units of physical stock available for fulfillment.`);
            return { ...item, quantity: physicalHeadroom };
          }
        }

        return { ...item, quantity: newQty };
      }
      return item;
    }));
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

  const calculateOriginalSubtotal = () => cart.reduce((sum, item) => sum + (Number(item.originalPrice) * Number(item.quantity)), 0);
  const calculateCurrentSubtotal = () => cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  const calculateTotalGSTBreakdown = (itemList = cart) => {
    let totalBase = 0;
    let totalGst = 0;

    itemList.forEach(item => {
      const itemInclusiveTotal = item.price * item.quantity;
      const pct = Number(item.gst_percentage || 0);

      if (item.has_gst && pct > 0) {
        const base = itemInclusiveTotal / (1 + pct / 100);
        totalBase += base;
        totalGst += itemInclusiveTotal - base;
      } else {
        totalBase += itemInclusiveTotal;
      }
    });

    return { totalBase, totalGst };
  };

  const getFinalTotal = () => {
    const custom = Number(customGrandTotal);
    const subtotal = (!isNaN(custom) && custom > 0) ? custom : calculateCurrentSubtotal();
    return Math.ceil(subtotal); // 👈 Rounds up final total to nearest whole integer
  };

  // Pre-Order Calculations
  const finalTotal = getFinalTotal();
  const alreadyPaidAdvance = convertingPreOrder ? Number(convertingPreOrder.paid_amount || 0) : 0;
  const netOutstandingDue = Math.max(0, finalTotal - alreadyPaidAdvance);
  const todayPaidInput = amountPaid !== '' ? Number(amountPaid) : 0;
  const remainingBalanceAfterToday = Math.max(0, netOutstandingDue - todayPaidInput);

  const handleCancelPreOrderConversion = () => {
    setConvertingPreOrder(null);
    setCart([]);
    setCustomGrandTotal('');
    setAmountPaid('');
    setSelectedCustomer(null);
    setCustomerSearch('');
  };

  const handleLoadPreOrderForConversion = (po) => {
    setConvertingPreOrder(po);
    setSelectedCustomer(po.customers ? { id: po.customer_id, name: po.customers.name, phone: po.customers.phone } : null);
    if (po.customers) setCustomerSearch(`${po.customers.name} (${po.customers.phone || ''})`);

    const loadedItems = po.sale_items.map(si => ({
      id: si.product_id,
      sku: si.sku,
      name: si.name || si.sku,
      unit: si.unit || 'Nos',
      quantity: si.quantity,
      price: si.unit_price,
      originalPrice: si.unit_price,
      has_gst: si.has_gst,
      gst_percentage: si.gst_percentage,
      available_stock: 9999
    }));

    setCart(loadedItems);
    setCustomGrandTotal(''); // 👈 Clear custom lock so cart subtotal calculates dynamically!
    
    const balance = po.total_amount - (po.paid_amount || 0);
    setAmountPaid(balance > 0 ? balance.toString() : '0');
    setOrderType('sale');
    setShowPreOrderModal(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (orderType === 'sale' && !convertingPreOrder && amountPaid === '') {
      alert('⚠️ Please enter the amount paid by the customer.');
      return;
    }

    const enteredPaid = amountPaid !== '' ? Number(amountPaid) : 0;

    if (orderType === 'sale' && !convertingPreOrder && Math.abs(enteredPaid - finalTotal) > 0.01) {
      alert(
         `⚠️ Amount Mismatch Warning!\n\nAmount Paid (₹${enteredPaid.toFixed(2)}) does not equal Final Payable Amount (₹${finalTotal.toFixed(2)}).`
      );
      return;
    }

    setIsCheckingOut(true);

    try {
      if (!shopInfo.id) return;

      let createdGstOrder = null;
      let createdEstimateOrder = null;

      if (billingMode === 'estimate_only' || billingMode === 'gst_only' || orderType === 'pre_order') {
        const isGstBatch = billingMode === 'gst_only' || (convertingPreOrder ? convertingPreOrder.invoice_type === 'gst' : true);
        const { totalBase, totalGst } = calculateTotalGSTBreakdown(cart);

        const itemsPayload = cart.map(item => {
          const pct = Number(item.gst_percentage || 0);
          const isTaxed = item.has_gst && pct > 0;
          const baseUnitPrice = isTaxed ? Number((item.price / (1 + pct / 100)).toFixed(2)) : item.price;
          const unitGstAmount = isTaxed ? Number((item.price - baseUnitPrice).toFixed(2)) : 0;

          return {
            product_id: item.id,
            sku: item.sku,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            price: item.price,
            unit_price: item.price,
            has_gst: isTaxed,
            gst_percentage: pct,
            base_price: baseUnitPrice,
            gst_amount: unitGstAmount * item.quantity
          };
        });

        let finalStatus = orderType === 'pre_order' ? 'pre_order' : saleStatus;
        let totalPaidSoFar = enteredPaid;
        if (convertingPreOrder) {
          totalPaidSoFar = alreadyPaidAdvance + enteredPaid;
          if (totalPaidSoFar < finalTotal) finalStatus = 'pre_order';
          else finalStatus = 'completed';
        }

        const { data: saleId, error: rpcError } = await supabase.rpc('complete_sale', {
          p_shop_id: shopInfo.id,
          p_customer_id: selectedCustomer?.id || null,
          p_total_amount: finalTotal,
          p_items: itemsPayload,
          p_amount_paid: enteredPaid,
          p_payment_method: paymentMethod || 'cash',
          p_sale_status: finalStatus,
          p_salesman_id: selectedSalesman?.id || null,
          p_invoice_type: isGstBatch ? 'gst' : 'estimate',
          p_existing_sale_id: convertingPreOrder ? convertingPreOrder.id : null
        });

        if (rpcError) throw rpcError;

        const singleOrderResult = {
          saleId,
          shopName: shopInfo.name,
          date: new Date().toLocaleString(),
          customer: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
          customerPhone: selectedCustomer ? selectedCustomer.phone : '',
          salesmanName: selectedSalesman ? selectedSalesman.name : 'Unassigned',
          items: itemsPayload,
          totalAmount: finalTotal,
          paidAmount: totalPaidSoFar,
          paymentMethod,
          totalBase,
          totalGst,
          isGstInvoice: isGstBatch,
          saleStatus: finalStatus
        };

        if (isGstBatch) createdGstOrder = singleOrderResult;
        else createdEstimateOrder = singleOrderResult;

      } else {
        let gstCartItems = [];
        let estimateCartItems = [];

        cart.forEach(item => {
          if (item.has_gst && Number(item.gst_percentage || 0) > 0) gstCartItems.push(item);
          else estimateCartItems.push(item);
        });

        const gstTotalRaw = gstCartItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
        const estimateTotalRaw = estimateCartItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
        const grandCartTotalRaw = gstTotalRaw + estimateTotalRaw;

        // 1. Scale sub-totals to match the rounded finalTotal integer precisely
        const scaleFactor = grandCartTotalRaw > 0 ? finalTotal / grandCartTotalRaw : 1;
        const gstTotal = Math.round(gstTotalRaw * scaleFactor);
        const estimateTotal = finalTotal - gstTotal; // guarantees exact sum === finalTotal

        const totalOverallPaidSoFar = convertingPreOrder ? alreadyPaidAdvance + enteredPaid : finalTotal;
        const totalOverallAdvance = convertingPreOrder ? alreadyPaidAdvance : 0;

        const gstRatio = grandCartTotalRaw > 0 ? gstTotalRaw / grandCartTotalRaw : 0;

        // 2. Allocate exact proportional paid amounts matching each batch total exactly
        const gstPaidAllocated = Number((totalOverallPaidSoFar * gstRatio).toFixed(2));
        const estPaidAllocated = Number((totalOverallPaidSoFar - gstPaidAllocated).toFixed(2));

        const gstAdvanceAllocated = Number((totalOverallAdvance * gstRatio).toFixed(2));
        const estAdvanceAllocated = Number((totalOverallAdvance - gstAdvanceAllocated).toFixed(2));

        const submitOrderBatch = async (items, batchTotal, allocatedPaid, allocatedAdvance, isGstBatch, existingId) => {
          if (items.length === 0) return null;

          const { totalBase, totalGst } = calculateTotalGSTBreakdown(items);

          const itemsPayload = items.map(item => {
            const pct = Number(item.gst_percentage || 0);
            const isTaxed = isGstBatch && item.has_gst && pct > 0;
            const baseUnitPrice = isTaxed ? Number((item.price / (1 + pct / 100)).toFixed(2)) : item.price;
            const unitGstAmount = isTaxed ? Number((item.price - baseUnitPrice).toFixed(2)) : 0;

            return {
              product_id: item.id,
              sku: item.sku,
              name: item.name,
              unit: item.unit,
              quantity: item.quantity,
              price: item.price,
              unit_price: item.price,
              has_gst: isTaxed,
              gst_percentage: pct,
              base_price: baseUnitPrice,
              gst_amount: unitGstAmount * item.quantity
            };
          });

          // Ensure both split invoices show as fully completed and paid for direct sales
          let finalStatus = saleStatus;
          let paymentForThisBatch = batchTotal; // Force batch to match its full total so paid == total

          if (convertingPreOrder) {
            if (allocatedPaid < batchTotal) finalStatus = 'pre_order';
            paymentForThisBatch = existingId ? (allocatedPaid - allocatedAdvance) : allocatedPaid;
          } else {
            finalStatus = 'completed';
          }

          const { data: saleId, error: rpcError } = await supabase.rpc('complete_sale', {
            p_shop_id: shopInfo.id,
            p_customer_id: selectedCustomer?.id || null,
            p_total_amount: batchTotal,
            p_items: itemsPayload,
            p_amount_paid: paymentForThisBatch,
            p_payment_method: paymentMethod || 'cash',
            p_sale_status: finalStatus,
            p_salesman_id: selectedSalesman?.id || null,
            p_invoice_type: isGstBatch ? 'gst' : 'estimate',
            p_existing_sale_id: existingId || null
          });

          if (rpcError) throw rpcError;

          return {
            saleId,
            shopName: shopInfo.name,
            date: new Date().toLocaleString(),
            customer: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            customerPhone: selectedCustomer ? selectedCustomer.phone : '',
            salesmanName: selectedSalesman ? selectedSalesman.name : 'Unassigned',
            items: itemsPayload,
            totalAmount: batchTotal,
            paidAmount: batchTotal,
            paymentMethod,
            totalBase,
            totalGst,
            isGstInvoice: isGstBatch,
            saleStatus: finalStatus
          };
        };

        if (gstCartItems.length > 0 && gstTotal > 0) {
          createdGstOrder = await submitOrderBatch(
            gstCartItems, 
            gstTotal, 
            gstPaidAllocated, 
            gstAdvanceAllocated, 
            true, 
            convertingPreOrder ? convertingPreOrder.id : null
          );
        }

        if (estimateCartItems.length > 0 && estimateTotal > 0) {
          createdEstimateOrder = await submitOrderBatch(
            estimateCartItems, 
            estimateTotal, 
            estPaidAllocated, 
            estAdvanceAllocated, 
            false, 
            null
          );
        }
      }

      setCompletedGstOrder(createdGstOrder);
      setCompletedEstimateOrder(createdEstimateOrder);
      setShowReceiptModal(true);

      // Reset Form State
      setCart([]);
      setCustomGrandTotal('');
      setAmountPaid('');
      setConvertingPreOrder(null);
      setOrderType('sale');
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

  const { totalBase, totalGst } = calculateTotalGSTBreakdown();

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <h1>POS Terminal</h1>
          <button className="secondary-btn" onClick={() => setShowPreOrderModal(true)}>
            📋 Pending Pre-Orders ({pendingPreOrders.length})
          </button>
        </div>

        <div className="pos-container">
          {/* LEFT: Search & Catalog Selector */}
          <div className="pos-left">
            <div className="card">
              <h3>Find & Add Products</h3>

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
                            <div className="item-tax-tag">
                              {p.has_gst && Number(p.gst_percentage || 0) > 0 ? (
                                <span className="gst-tag">GST {p.gst_percentage}%</span>
                              ) : (
                                <span className="estimate-tag">Estimate / Non-GST</span>
                              )}
                            </div>
                          </div>
                          <div className="dropdown-right">
                            <span className="price">₹{p.selling_price}</span>
                            <span className={`stock-badge ${p.available_stock > 0 ? 'green' : 'red'}`}>
                              Available: {p.available_stock} {p.unit || 'Nos'}
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

              <h4>Quick Catalog (In-Stock)</h4>
              <div className="quick-grid">
                {products
                  .filter(p => Number(p.available_stock || 0) > 0)
                  .slice(0, 8)
                  .map(p => (
                    <button key={p.id} className="quick-tile" onClick={() => addToCart(p)}>
                      <span className="tile-name">{p.name}</span>
                      <span className="tile-price">₹{p.selling_price}</span>
                      <span className="tile-stock">Stock: {p.available_stock} {p.unit || 'Nos'}</span>
                      <span className={`tile-tax ${p.has_gst && Number(p.gst_percentage || 0) > 0 ? 'gst' : 'estimate'}`}>
                        {p.has_gst && Number(p.gst_percentage || 0) > 0 ? `GST ${p.gst_percentage}%` : 'Estimate'}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Active Cart & Checkout */}
          <div className="pos-right">
            <div className="card cart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3>{convertingPreOrder ? `Fulfilling Pre-Order (#${convertingPreOrder.id.slice(0, 8)})` : 'Current Order Cart'}</h3>
                {convertingPreOrder && (
                  <button className="clear-btn" onClick={handleCancelPreOrderConversion}>✕ Cancel Conversion</button>
                )}
              </div>

              {/* Workflow Mode Selector */}
              {!convertingPreOrder && (
                <div className="segmented-control" style={{ marginBottom: '12px' }}>
                  <button type="button" className={orderType === 'sale' ? 'active' : ''} onClick={() => setOrderType('sale')}>
                    🛒 Immediate Direct Sale
                  </button>
                  <button type="button" className={orderType === 'pre_order' ? 'active' : ''} onClick={() => setOrderType('pre_order')}>
                    ⏳ Pre-Order (Advance Deposit)
                  </button>
                </div>
              )}

              <div className="pos-meta-grid">
                {/* Customer Input */}
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

                {/* Sales Rep Input */}
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

              <div className="cart-items-wrapper" ref={cartScrollRef}>
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
                        const isKgs = item.unit?.toLowerCase().includes('kg');
                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.name}</strong><br/>
                              <span className="subtext">{item.sku} ({item.unit || 'Nos'})</span>
                              <div style={{ marginTop: '2px' }}>
                                {convertingPreOrder && (
                                  <span className="cart-est-badge" style={{ background: '#e0f2fe', color: '#0369a1', marginRight: '4px' }}>
                                    Pre-booked
                                  </span>
                                )}
                                {item.has_gst && Number(item.gst_percentage || 0) > 0 ? (
                                  <span className="cart-gst-badge">GST {item.gst_percentage}%</span>
                                ) : (
                                  <span className="cart-est-badge">Estimate / Non-GST</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="qty-controls">
                                <button onClick={() => updateCartQuantity(item.id, -1)}>-</button>
                                <input
                                  type="number"
                                  step={isKgs ? "0.001" : "1"}
                                  value={item.quantity}
                                  onChange={(e) => handleCartQuantityInput(item.id, e.target.value)}
                                  className="table-qty-input"
                                />
                                <button onClick={() => updateCartQuantity(item.id, 1)}>+</button>
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleItemPriceChange(item.id, e.target.value)}
                                className="table-price-input"
                              />
                            </td>
                            <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                            <td><button className="remove-btn" onClick={() => removeFromCart(item.id)}>✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Order Generation:</span>
                  <select value={billingMode} onChange={(e) => setBillingMode(e.target.value)} className="custom-total-input" style={{ width: '180px' }}>
                    <option value="auto_split">Auto-Split (GST + Estimate)</option>
                    <option value="gst_only">GST Invoice Only</option>
                    <option value="estimate_only">Estimate / Non-GST Only</option>
                  </select>
                </div>

                <div className="summary-row">
                  <span>Tax Breakdown:</span>
                  <span className="subtext">Base: ₹{totalBase.toFixed(2)} | GST: ₹{totalGst.toFixed(2)}</span>
                </div>

                {convertingPreOrder ? (
                  <div className="preorder-ledger-card">
                    <div className="summary-row">
                      <span>Updated Cart Total:</span>
                      <strong>₹{finalTotal.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="summary-row text-blue">
                      <span>Advance Received So Far:</span>
                      <span>- ₹{alreadyPaidAdvance.toFixed(2)}</span>
                    </div>
                    <div className="summary-row text-red font-bold border-top-dashed">
                      <span>Net Outstanding Due:</span>
                      <span>₹{netOutstandingDue.toFixed(2)}</span>
                    </div>

                    <div className="summary-row" style={{ marginTop: '6px' }}>
                      <span className="font-semibold">Today's Payment Received (₹):</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="custom-total-input pay-input"
                      />
                    </div>

                    <div className="summary-row subtext-balance">
                      <span>Remaining Balance After Today:</span>
                      <span style={{ color: remainingBalanceAfterToday > 0 ? '#b91c1c' : '#15803d', fontWeight: 'bold' }}>
                        ₹{remainingBalanceAfterToday.toFixed(2)}
                      </span>
                    </div>
                    {remainingBalanceAfterToday > 0 && (
                      <div className="balance-warning-note">
                        ℹ️ Balance remaining. Order will stay as Pre-Order.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="summary-row">
                    <span>{orderType === 'pre_order' ? 'Advance Payment (₹):' : 'Amount Paid (₹) *:'}</span>
                    <input
                      type="number"
                      placeholder={orderType === 'pre_order' ? 'Leave blank for 0' : 'Enter amount paid...'}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className={`custom-total-input ${orderType === 'sale' && amountPaid === '' ? 'highlight-required' : ''}`}
                    />
                  </div>
                )}

                <div className="summary-row">
                  <span>Payment Method:</span>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="custom-total-input" style={{ width: '130px' }}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="total-row">
                  <span>Final Payable Amount:</span>
                  <span className="grand-total">₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>

                <button className="checkout-btn" disabled={cart.length === 0 || isCheckingOut} onClick={handleCheckout}>
                  {isCheckingOut ? 'Processing...' : convertingPreOrder ? 'Complete Fulfillment & Settle Balance' : orderType === 'pre_order' ? 'Save Pre-Order & Print Advance Receipt' : 'Complete Sale & Checkout'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Pending Pre-Orders */}
        {showPreOrderModal && (
          <div className="modal-overlay">
            <div className="modal" style={{ width: '550px' }}>
              <h3>Pending Pre-Orders</h3>

              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by Order ID, Customer Name or Mobile..."
                  value={preOrderSearch}
                  onChange={(e) => setPreOrderSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {filteredPreOrders.length === 0 ? (
                <p className="empty-cart-text">No pre-orders match "{preOrderSearch}".</p>
              ) : (
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {filteredPreOrders.map(po => (
                    <div key={po.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '8px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{po.customers?.name || 'Walk-in Customer'}</strong>
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>({po.customers?.phone || 'No Phone'})</span>
                        </div>
                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>Total: ₹{po.total_amount}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Order ID: <strong>#{po.id.slice(0, 8)}</strong> | Paid Advance: <strong style={{ color: '#16a34a' }}>₹{po.paid_amount}</strong> | Balance Due: <strong style={{ color: '#b91c1c' }}>₹{(po.total_amount - po.paid_amount).toFixed(2)}</strong>
                      </div>
                      <button className="primary-btn" style={{ marginTop: '8px', width: '100%' }} onClick={() => handleLoadPreOrderForConversion(po)}>
                        Load & Fulfill Pre-Order →
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className="cancel-btn" onClick={() => { setShowPreOrderModal(false); setPreOrderSearch(''); }}>Close</button>
            </div>
          </div>
        )}

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
                <label>Email Address</label>
                <input type="email" placeholder="Email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
                <div className="modal-actions">
                  <button type="submit" className="primary-btn">Save & Select</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowNewCustomerModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Shared Printable Receipt Modal */}
        <PrintableReceiptModal
          show={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          completedGstOrder={completedGstOrder}
          completedEstimateOrder={completedEstimateOrder}
        />
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .pos-container { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .search-dropdown-container { position: relative; margin-bottom: 20px; }
        .search-form-group { display: flex; gap: 8px; }
        .search-input { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
        .search-btn, .primary-btn { background: #0f172a; color: white; border: none; padding: 10px 14px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .secondary-btn { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .clear-btn { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 50; }
        .dropdown-item { padding: 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .create-new-prompt { color: #0284c7; background: #f0f9ff; font-size: 13px; }
        .item-tax-tag { margin-top: 2px; }
        .gst-tag { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        .estimate-tag { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        .cart-gst-badge { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; }
        .cart-est-badge { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; }
        .quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 10px; }
        .quick-tile { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; position: relative; }
        .tile-name { font-weight: 600; font-size: 13px; }
        .tile-price { font-weight: bold; color: #0284c7; }
        .tile-tax { font-size: 9px; font-weight: 700; padding: 2px 4px; border-radius: 3px; width: fit-content; }
        .tile-tax.gst { background: #e0f2fe; color: #0369a1; }
        .tile-tax.estimate { background: #fef3c7; color: #92400e; }
        .pos-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .select-section { position: relative; }
        .select-section label { font-size: 12px; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px; }
        .customer-input-row { display: flex; position: relative; }
        .clear-cust-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; }
        
        .cart-items-wrapper { min-height: 180px; max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; scroll-behavior: smooth; }
        .cart-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cart-table th { background: #f1f5f9; padding: 8px; text-align: left; position: sticky; top: 0; z-index: 5; }
        .cart-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .qty-controls { display: flex; align-items: center; gap: 4px; }
        .qty-controls button { background: #e2e8f0; border: none; width: 22px; height: 24px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .table-qty-input { width: 50px; padding: 4px 2px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; font-size: 12px; }
        .table-price-input { width: 75px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; }
        .remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold; }
        .cart-summary { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; }
        .custom-total-input { width: 140px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: right; font-size: 13px; }
        .custom-total-input.highlight-required { border-color: #ef4444; background: #fef2f2; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 6px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
        .grand-total { color: #16a34a; font-size: 20px; }
        .checkout-btn { width: 100%; background: #16a34a; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; }
        .segmented-control { display: flex; background: #e2e8f0; padding: 2px; border-radius: 6px; gap: 2px; }
        .segmented-control button { flex: 1; padding: 8px; border: none; background: transparent; font-size: 12px; font-weight: 600; color: #64748b; border-radius: 4px; cursor: pointer; }
        .segmented-control button.active { background: white; color: #0f172a; }

        .preorder-ledger-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
        .text-blue { color: #0284c7; font-weight: 600; }
        .text-red { color: #dc2626; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .border-top-dashed { border-top: 1px dashed #cbd5e1; padding-top: 6px; }
        .pay-input { border-color: #0284c7; font-weight: bold; }
        .subtext-balance { font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 4px; }
        .balance-warning-note { font-size: 11px; color: #b91c1c; background: #fef2f2; padding: 4px 8px; border-radius: 4px; margin-top: 2px; border: 1px solid #fecaca; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .modal { background: white; padding: 24px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; width: 400px; }
        .modal input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
        .cancel-btn { padding: 10px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  );
}