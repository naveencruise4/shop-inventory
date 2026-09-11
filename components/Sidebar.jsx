'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: '📊 Dashboard', href: '/dashboard' },
    { label: '🛒 POS', href: '/pos' },
    { label: '📦 Products', href: '/products' },
    { label: '📒 Orders', href: '/orders' },
    { label: '📒 Ledger & Dues', href: '/ledger' }, // Added here
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      <div className="logo">InventoryApp</div>
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
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 30px;
          color: #38bdf8;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
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

        /* Mobile View */
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
          }

          nav {
            flex-direction: row;
            gap: 5px;
            flex: initial;
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