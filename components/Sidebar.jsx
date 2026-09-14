'use client';

import Link from 'next/link'; // <--- MUST be next/link, NOT next/navigation
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [shopName, setShopName] = useState('InventoryApp');

  useEffect(() => {
    fetchShopName();
  }, []);

  const fetchShopName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: appUser } = await supabase
        .from('users')
        .select('shop_id')
        .eq('id', user.id)
        .single();

      if (!appUser?.shop_id) return;

      const { data: shop } = await supabase
        .from('shops')
        .select('name')
        .eq('id', appUser.shop_id)
        .single();

      if (shop?.name) {
        setShopName(shop.name);
      }
    } catch (err) {
      console.error('Error fetching shop name:', err);
    }
  };

  const navItems = [
    { label: '📊 Dashboard', href: '/dashboard' },
    { label: '🛒 POS', href: '/pos' },
    { label: '📦 Products', href: '/products' },
    { label: '📋 Orders', href: '/orders' },
    { label: '📒 Ledger & Dues', href: '/ledger' },
    { label: '⚙️ Settings', href: '/settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      <div>
        <div className="logo" title={shopName}>{shopName}</div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      
      <div className="logout-section">
        <button onClick={handleLogout} className="logout-btn">
          Log Out
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          width: 220px;
          min-height: 100vh;
          background: #0f172a;
          color: #fff;
          padding: 20px;
          box-sizing: border-box;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .logo {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 30px;
          color: #38bdf8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        :global(.nav-item) {
          color: #94a3b8;
          text-decoration: none;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 14px;
          transition: background 0.2s, color 0.2s;
        }

        :global(.nav-item:hover),
        :global(.nav-item.active) {
          background: #1e293b;
          color: #fff;
        }

        .logout-section {
          padding-top: 20px;
          border-top: 1px solid #334155;
        }

        .logout-btn {
          width: 100%;
          padding: 10px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          transition: background 0.2s;
        }

        .logout-btn:hover {
          background: #dc2626;
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            min-height: auto;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
          }

          .logo {
            margin-bottom: 0;
            max-width: 120px;
          }

          nav {
            flex-direction: row;
            gap: 5px;
            overflow-x: auto;
          }

          :global(.nav-item) {
            padding: 6px 10px;
            font-size: 13px;
            white-space: nowrap;
          }

          .logout-section {
            padding-top: 0;
            border-top: none;
          }

          .logout-btn {
            padding: 6px 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </aside>
  );
}