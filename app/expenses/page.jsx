'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function ExpensesPage() {
  const [shopInfo, setShopInfo] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    payment_method: 'cash',
    expense_date: todayStr,
    reference_number: '',
    notes: ''
  });

  // Quick Category Creation Modal State
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
    if (appUser?.shop_id) {
      const { data: shop } = await supabase.from('shops').select('id, name').eq('id', appUser.shop_id).single();
      if (shop) {
        setShopInfo(shop);
        fetchCategories(shop.id);
        fetchExpenses(shop.id, selectedMonth);
      }
    }
  };

  const fetchCategories = async (shopId) => {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('name');
    if (data) setCategories(data);
  };

  const fetchExpenses = useCallback(async (shopId, monthStr) => {
    setLoading(true);
    const sid = shopId || shopInfo?.id;
    if (!sid) return;

        // monthStr is formatted as "YYYY-MM"
    const [year, month] = monthStr.split('-');

    // Dynamically calculate the last day of the selected month
    const lastDayDate = new Date(Number(year), Number(month), 0);

    // FIX: Format using local date methods instead of toISOString()
    const yyyy = lastDayDate.getFullYear();
    const mm = String(lastDayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDayDate.getDate()).padStart(2, '0');

    const lastDayStr = `${yyyy}-${mm}-${dd}`; // Will correctly be "2026-10-31"
    const firstDayStr = `${monthStr}-01`;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .eq('shop_id', sid)
        .gte('expense_date', firstDayStr)
        .lte('expense_date', lastDayStr)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error('Error fetching expenses:', err.message);
    } finally {
      setLoading(false);
    }
  }, [shopInfo?.id]);

  useEffect(() => {
    if (shopInfo?.id) {
      fetchExpenses(shopInfo.id, selectedMonth);
    }
  }, [selectedMonth, shopInfo?.id, fetchExpenses]);

  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setForm({
      category_id: categories[0]?.id || '',
      amount: '',
      payment_method: 'cash',
      expense_date: todayStr,
      reference_number: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp);
    setForm({
      category_id: exp.category_id,
      amount: exp.amount,
      payment_method: exp.payment_method,
      expense_date: exp.expense_date,
      reference_number: exp.reference_number || '',
      notes: exp.notes || ''
    });
    setShowModal(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!shopInfo?.id) return;
    if (!form.category_id) {
      alert('⚠️ Please select an expense category.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      alert('⚠️ Please enter a valid expense amount.');
      return;
    }

    try {
      if (editingExpense) {
        // Update
        const { error } = await supabase
          .from('expenses')
          .update({
            category_id: form.category_id,
            amount: Number(form.amount),
            payment_method: form.payment_method,
            expense_date: form.expense_date,
            reference_number: form.reference_number.trim() || null,
            notes: form.notes.trim() || null
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        alert('✅ Expense updated successfully!');
      } else {
        // Insert
        const { error } = await supabase
          .from('expenses')
          .insert([{
            shop_id: shopInfo.id,
            category_id: form.category_id,
            amount: Number(form.amount),
            payment_method: form.payment_method,
            expense_date: form.expense_date,
            reference_number: form.reference_number.trim() || null,
            notes: form.notes.trim() || null
          }]);

        if (error) throw error;
        alert('✅ Expense recorded successfully!');
      }

      setShowModal(false);
      fetchExpenses(shopInfo.id, selectedMonth);
    } catch (err) {
      alert(`Failed to save expense: ${err.message}`);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      alert('🗑️ Expense deleted successfully.');
      fetchExpenses(shopInfo.id, selectedMonth);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !shopInfo?.id) return;

    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert([{ shop_id: shopInfo.id, name: newCatName.trim() }])
        .select()
        .single();

      if (error) throw error;

      await fetchCategories(shopInfo.id);
      setForm({ ...form, category_id: data.id });
      setShowCatModal(false);
      setNewCatName('');
      alert('✅ New category created!');
    } catch (err) {
      alert(`Failed to create category: ${err.message}`);
    }
  };

  const totalMonthExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <div>
            <h1>Expense Management</h1>
            <p className="subtext">Track shop operational expenses and overhead costs</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '6px' }}>Month Filter:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <button className="primary-btn" onClick={handleOpenAddModal}>+ Record Expense</button>
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card danger">
            <span className="summary-label">Total Expenses ({selectedMonth})</span>
            <span className="summary-value">₹{totalMonthExpenses.toFixed(2)}</span>
          </div>
        </div>

        <div className="table-wrapper card">
          <h3>Expense Transactions</h3>
          {loading ? (
            <p className="loading-text">Loading expenses...</p>
          ) : (
            <div className="table-scroll-area" style={{ marginTop: '10px' }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Notes / Description</th>
                    <th>Ref #</th>
                    <th>Payment Method</th>
                    <th>Amount (₹)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No expenses recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.expense_date}</td>
                        <td><span className="category-badge">{exp.expense_categories?.name || 'General'}</span></td>
                        <td>{exp.notes || '—'}</td>
                        <td>{exp.reference_number || '—'}</td>
                        <td style={{ textTransform: 'uppercase' }}>{exp.payment_method}</td>
                        <td style={{ fontWeight: 'bold', color: '#dc2626' }}>₹{Number(exp.amount).toFixed(2)}</td>
                        <td style={{ display: 'flex', gap: '6px' }}>
                          <button className="reprint-btn" onClick={() => handleOpenEditModal(exp)}>✏️ Edit</button>
                          <button className="reprint-btn delete" onClick={() => handleDeleteExpense(exp.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Record / Edit Expense */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal" style={{ width: '480px' }}>
              <h3>{editingExpense ? 'Edit Expense Record' : 'Record New Expense'}</h3>
              <form onSubmit={handleSaveExpense}>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Category *</label>
                    <button type="button" onClick={() => setShowCatModal(true)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                      + Add New Category
                    </button>
                  </div>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    required
                  >
                    <option value="">Select category...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div className="form-group">
                    <label>Payment Method *</label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expense Date *</label>
                    <input
                      type="date"
                      value={form.expense_date}
                      onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>Reference / Receipt Number</label>
                  <input
                    placeholder="Optional UTR or bill ref..."
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Notes / Description</label>
                  <input
                    placeholder="Optional details..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button type="submit" className="primary-btn">{editingExpense ? 'Update Expense' : 'Save Expense'}</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Quick Create Category */}
        {showCatModal && (
          <div className="modal-overlay" style={{ zIndex: 110 }}>
            <div className="modal" style={{ width: '350px' }}>
              <h3>Add Expense Category</h3>
              <form onSubmit={handleCreateCategory}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Category Name *</label>
                  <input
                    placeholder="e.g. Electricity, Rent"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="primary-btn">Save Category</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowCatModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .top-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; flex-shrink: 0; }
        .top-bar h1 { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
        .subtext { font-size: 13px; color: #64748b; }
        .summary-cards { display: flex; margin-bottom: 16px; flex-shrink: 0; }
        .summary-card { background: white; padding: 14px 20px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; border-left: 4px solid #0284c7; min-width: 220px; }
        .summary-card.danger { border-left-color: #dc2626; }
        .summary-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
        .summary-value { font-size: 22px; font-weight: 700; color: #0f172a; }
        .table-wrapper { background: white; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; padding: 16px; }
        .table-scroll-area { flex: 1; overflow: auto; }
        .orders-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 13px; }
        .orders-table th { background: #f1f5f9; color: #475569; padding: 10px 12px; font-weight: 600; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; }
        .orders-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        .category-badge { background: #f1f5f9; color: #334155; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .reprint-btn { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .reprint-btn.delete { color: #dc2626; border-color: #fca5a5; background: #fef2f2; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .modal { background: white; padding: 24px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; width: 400px; }
        .modal input, .modal select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; font-size: 13px; }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group label { font-size: 12px; font-weight: 600; color: #475569; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
        .primary-btn { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
        .cancel-btn { padding: 8px 14px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
      `}</style>
    </div>
  );
}