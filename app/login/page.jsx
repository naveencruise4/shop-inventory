'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      alert(`Login failed: ${error.message}`);
    } else {
      document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=28800; SameSite=Lax`;
      router.push('/dashboard');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleLogin} style={{ background: '#fff', padding: '30px', borderRadius: '8px', width: '300px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ marginTop: 0 }}>Login</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }} />
        <button disabled={loading} style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p style={{ fontSize: '13px', marginTop: '15px' }}>Need an account? <Link href="/signup">Register Shop</Link></p>
      </form>
    </div>
  );
}