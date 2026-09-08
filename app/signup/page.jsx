'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', shopName: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert([{ name: form.shopName, business_type: 'furniture' }])
      .select()
      .single();

    if (shopError) {
      alert(`Shop creation failed: ${shopError.message}`);
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      alert(`Signup failed: ${authError.message}`);
      setLoading(false);
      return;
    }

    if (authData.user) {
      await supabase.from('users').insert([{
        id: authData.user.id,
        shop_id: shop.id,
        full_name: form.fullName,
        role: 'owner'
      }]);
    }

    setLoading(false);
    alert('Shop registered! Please sign in.');
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleSignup} style={{ background: '#fff', padding: '30px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ marginTop: 0 }}>Register Shop</h2>
        <input placeholder="Full Name" onChange={(e) => setForm({ ...form, fullName: e.target.value })} required style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input placeholder="Shop Name" onChange={(e) => setForm({ ...form, shopName: e.target.value })} required style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="email" placeholder="Email" onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} required style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }} />
        <button disabled={loading} style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {loading ? 'Creating...' : 'Register'}
        </button>
        <p style={{ fontSize: '13px', marginTop: '15px' }}>Already registered? <Link href="/login">Login</Link></p>
      </form>
    </div>
  );
}