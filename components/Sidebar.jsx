'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [shopName, setShopName] = useState('InventoryApp');
  const [isCollapsed, setIsCollapsed] = useState(false);

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
  //  { label: 'Dashboard', icon: '📊', href: '/dashboard' },
    { label: 'POS', icon: '🛒', href: '/pos' },
    { label: 'Products', icon: '📦', href: '/products' },
    { label: 'Orders', icon: '📋', href: '/orders' },
    { label: 'Ledger', icon: '📖', href: '/ledger' },
    { label: 'Settings', icon: '⚙️', href: '/settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="sidebar-top-row">
            {!isCollapsed && <div className="logo" title={shopName}>{shopName}</div>}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="collapse-btn" 
              title={isCollapsed ? "Expand Sidebar" : "Minimize Sidebar"}
            >
              {isCollapsed ? '➡' : '⬅'}
            </button>
          </div>
          
          <nav>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="logout-section">
          <button onClick={handleLogout} className="logout-btn" title="Log Out">
            {isCollapsed ? '🚪' : 'Log Out'}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .sidebar {
          width: ${isCollapsed ? '76px' : '220px'};
          position: sticky;
          top: 0;
          height: 100vh;
          background: #0f172a;
          color: #fff;
          padding: 20px 14px;
          box-sizing: border-box;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: width 0.25s ease;
          z-index: 100;
          overflow-y: auto;
        }

        .sidebar-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 8px;
        }

        .logo {
          font-size: 15px;
          font-weight: bold;
          color: #38bdf8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .collapse-btn {
          background: #1e293b;
          color: #94a3b8;
          border: 1px solid #334155;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s, color 0.2s;
        }

        .collapse-btn:hover {
          background: #334155;
          color: #fff;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        :global(.nav-item) {
          color: #94a3b8;
          text-decoration: none;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 14px;
          transition: background 0.2s, color 0.2s;
          display: flex;
          align-items: center;
          gap: 12px;
          white-space: nowrap;
        }

        .nav-icon {
          font-size: 16px;
          min-width: 20px;
          text-align: center;
        }

        :global(.nav-item:hover),
        :global(.nav-item.active) {
          background: #1e293b;
          color: #fff;
        }

        .logout-section {
          padding-top: 16px;
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
          white-space: nowrap;
          overflow: hidden;
          text-align: center;
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
            width: 100% !important;
            height: 65px;
            min-height: auto;
            flex-direction: row;
            align-items: center;
            justify-content: space-around;
            padding: 0 4px;
            z-index: 1000;
            border-top: 1px solid #334155;
            box-shadow: 0 -4px 10px rgba(0,0,0,0.1);
            overflow-y: visible;
          }

          .sidebar-top-row, .logout-section {
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