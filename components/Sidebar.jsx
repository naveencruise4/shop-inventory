'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Products', href: '/products' },
    { label: 'POS', href: '/pos' },
  ];

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

      <style jsx>{`
        .sidebar {
          width: 220px;
          min-height: 100vh;
          background: #0f172a;
          color: #fff;
          padding: 20px;
          box-sizing: border-box;
          flex-shrink: 0;
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
          gap: 10px;
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

        /* Mobile View: Top bar instead of sidebar */
        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            min-height: auto;
            display: flex;
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
          }

          :global(.nav-item) {
            padding: 6px 10px;
            font-size: 13px;
          }
        }
      `}</style>
    </aside>
  );
}