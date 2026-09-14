'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // User & Shop State
  const [userEmail, setUserEmail] = useState('');
  const [shopId, setShopId] = useState(null);
  const [shopData, setShopData] = useState({
    name: '',
    address: '',
    phone: '',
    currency: '₹'
  });

  // Password Update State
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passMessage, setPassMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchAccountDetails();
  }, []);

  const fetchAccountDetails = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      setUserEmail(user.email || '');

      // Fetch user profile and associated shop_id
      const { data: appUser, error: userError } = await supabase
        .from('users')
        .select('shop_id')
        .eq('id', user.id)
        .single();

      if (userError || !appUser?.shop_id) return;
      setShopId(appUser.shop_id);

      // Fetch shop information
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', appUser.shop_id)
        .single();

      if (shop && !shopError) {
        setShopData({
          name: shop.name || '',
          address: shop.address || '',
          phone: shop.phone || '',
          currency: shop.currency || '₹'
        });
      }
    } catch (err) {
      console.error('Error loading profile/shop details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShop = async (e) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('shops')
        .update({
          name: shopData.name,
          address: shopData.address,
          phone: shopData.phone,
          currency: shopData.currency
        })
        .eq('id', shopId);

      if (error) throw error;
      alert('Shop profile updated successfully!');
    } catch (err) {
      alert(`Failed to update shop details: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPassMessage({ text: '', type: '' });

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPassMessage({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    if (passwords.newPassword.length < 6) {
      setPassMessage({ text: 'Password must be at least 6 characters long.', type: 'error' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });

      if (error) throw error;

      setPassMessage({ text: 'Password updated successfully!', type: 'success' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPassMessage({ text: err.message, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="content"><p>Loading account settings...</p></main>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <div className="top-bar">
          <h1>Account & Shop Settings</h1>
        </div>

        <div className="settings-grid">
          {/* Shop Information Card */}
          <div className="card">
            <h3>Shop Profile Configuration</h3>
            <p className="subtext">Manage your active business name, location, and communication details.</p>
            
            <form onSubmit={handleUpdateShop} className="settings-form">
              <div>
                <label>Shop Name</label>
                <input 
                  type="text" 
                  value={shopData.name} 
                  onChange={(e) => setShopData({ ...shopData, name: e.target.value })} 
                  required 
                />
              </div>

              <div>
                <label>Business Phone Number</label>
                <input 
                  type="text" 
                  value={shopData.phone} 
                  onChange={(e) => setShopData({ ...shopData, phone: e.target.value })} 
                  placeholder="e.g., +91 98765 43210" 
                />
              </div>

              <div>
                <label>Shop Address</label>
                <textarea 
                  rows="3" 
                  value={shopData.address} 
                  onChange={(e) => setShopData({ ...shopData, address: e.target.value })} 
                  placeholder="Enter complete store address..." 
                />
              </div>

              <div>
                <label>Default Currency Symbol</label>
                <input 
                  type="text" 
                  value={shopData.currency} 
                  onChange={(e) => setShopData({ ...shopData, currency: e.target.value })} 
                  maxLength="5" 
                />
              </div>

              <button type="submit" className="action-btn" disabled={saving}>
                {saving ? 'Saving Changes...' : 'Save Shop Profile'}
              </button>
            </form>
          </div>

          {/* Login & Security Management Card */}
          <div className="card">
            <h3>Login Credentials & Security</h3>
            <p className="subtext">Signed in as: <strong>{userEmail}</strong></p>

            <form onSubmit={handleUpdatePassword} className="settings-form">
              <div>
                <label>New Password</label>
                <input 
                  type="password" 
                  value={passwords.newPassword} 
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} 
                  placeholder="Min. 6 characters" 
                  required 
                />
              </div>

              <div>
                <label>Confirm New Password</label>
                <input 
                  type="password" 
                  value={passwords.confirmPassword} 
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} 
                  placeholder="Re-enter new password" 
                  required 
                />
              </div>

              {passMessage.text && (
                <div className={`message-box ${passMessage.type}`}>
                  {passMessage.text}
                </div>
              )}

              <button type="submit" className="secondary-btn">
                Update Password
              </button>
            </form>
          </div>
        </div>
      </main>

      <style jsx>{`
        .layout { display: flex; min-height: 100vh; background: #f8fafc; }
        .content { flex: 1; padding: 24px; box-sizing: border-box; max-width: 1200px; }
        .top-bar { margin-bottom: 20px; }
        .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .card { background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .card h3 { margin-bottom: 4px; color: #0f172a; }
        .subtext { font-size: 13px; color: #64748b; margin-bottom: 20px; }
        .settings-form { display: flex; flex-direction: column; gap: 14px; }
        .settings-form label { font-size: 13px; font-weight: 500; color: #334155; display: block; margin-bottom: 4px; }
        .settings-form input, .settings-form textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
        .settings-form input:focus, .settings-form textarea:focus { outline: none; border-color: #0f172a; }
        .action-btn { background: #0f172a; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; margin-top: 6px; }
        .action-btn:disabled { background: #94a3b8; cursor: not-allowed; }
        .secondary-btn { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; margin-top: 6px; }
        .message-box { padding: 10px; border-radius: 6px; font-size: 13px; }
        .message-box.error { background: #fee2e2; color: #b91c1c; }
        .message-box.success { background: #dcfce7; color: #15803d; }
      `}</style>
    </div>
  );
}