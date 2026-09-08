'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Sidebar() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  return (
    <aside style={{ width: '220px', background: '#1e293b', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h2 style={{ marginBottom: '30px', fontSize: '18px', color: '#38bdf8' }}>Shop Manager</h2>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <Link href="/dashboard" style={{ color: '#f8fafc', textDecoration: 'none' }}>Dashboard</Link>
        <Link href="/pos" style={{ color: '#f8fafc', textDecoration: 'none' }}>POS Checkout</Link>
        <Link href="/products" style={{ color: '#f8fafc', textDecoration: 'none' }}>Products</Link>
        <Link href="/orders" style={{ color: '#f8fafc', textDecoration: 'none' }}>Orders</Link>
        <button 
          onClick={handleLogout}
          style={{ marginTop: 'auto', background: '#ef4444', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </nav>
    </aside>
  );
}