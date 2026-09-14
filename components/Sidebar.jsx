'use client';

import Link from 'next/link';
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
    { label: 'Dashboard', icon: '📊', href: '/dashboard' },
    { label: 'POS', icon: '🛒', href: '/pos' },
    { label: 'Products', icon: '📦', href: '/products' },
    { label: 'Orders', icon: '📋', href: '/orders' },
    { label: 'Ledger', icon: '📒', href: '/ledger' },
    { label: 'Settings', icon: '⚙️', href: '/settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
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
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="logout-section">
          <button onClick={handleLogout} className="logout-btn">
            Log Out
          </button>
        </div>
      </aside>

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
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-icon {
          font-size: 16px;
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

        /* MOBILE BOTTOM NAVIGATION BAR */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 65px;
            min-height: auto;
            flex-direction: row;
            align-items: center;
            justify-content: space-around;
            padding: 0 4px;
            z-index: 1000;
            border-top: 1px solid #334155;
            box-shadow: 0 -4px 10px rgba(0,0,0,0.1);
          }

          .logo, .logout-section {
            display: none; /* Hidden on mobile to keep bottom bar compact */
          }

          nav {
            flex-direction: row;
            justify-content: space-around;
            width: 100%;
            gap: 0;
          }

          :global(.nav-item) {
            padding: 6px 4px;
            font-size: 10px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            color: #94a3b8;
            background: transparent !important;
          }

          .nav-icon {
            font-size: 18px;
          }

          :global(.nav-item.active) {
            color: #38bdf8;
            font-weight: 600;
          }
        }
      `}</style>
    </>
  );
}