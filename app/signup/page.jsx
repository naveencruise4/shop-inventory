'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', shopName: '', businessType: 'furniture' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      alert('Shop registered! Please login.');
      router.push('/login');
    } else {
      alert(`Signup failed: ${data.error}`);
    }
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