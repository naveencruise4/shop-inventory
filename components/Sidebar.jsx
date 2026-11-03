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
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isPurchasesOpen, setIsPurchasesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  // Auto-expand sales or purchases dropdown if currently on a subpage
  useEffect(() => {
    if (pathname?.startsWith('/orders') || pathname?.startsWith('/sales')) {
      setIsSalesOpen(true);
    }
    if (pathname?.startsWith('/purchases')) {
      setIsPurchasesOpen(true);
    }
  }, [pathname]);

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
            <Link
              href="/pos"
              className={`nav-item ${pathname === '/pos' ? 'active' : ''}`}
              title={isCollapsed ? 'POS' : ''}
            >
              <span className="nav-icon">🛒</span>
              {!isCollapsed && <span className="nav-label">POS Checkout</span>}
            </Link>

            <Link
              href="/products"
              className={`nav-item ${pathname === '/products' ? 'active' : ''}`}
              title={isCollapsed ? 'Products' : ''}
            >
              <span className="nav-icon">📦</span>
              {!isCollapsed && <span className="nav-label">Products</span>}
            </Link>

            {/* Sales Dropdown Menu */}
            <div className="nav-dropdown-container">
              <div
                className={`nav-item dropdown-toggle ${(pathname?.startsWith('/orders') || pathname?.startsWith('/sales')) ? 'active-parent' : ''}`}
                onClick={() => {
                  if (isCollapsed) setIsCollapsed(false);
                  setIsSalesOpen(!isSalesOpen);
                }}
                title={isCollapsed ? 'Sales' : ''}
              >
                <span className="nav-icon">📋</span>
                {!isCollapsed && (
                  <>
                    <span className="nav-label" style={{ flex: 1 }}>Sales</span>
                    <span className="dropdown-arrow">{isSalesOpen ? '▼' : '▶'}</span>
                  </>
                )}
              </div>

              {(!isCollapsed && isSalesOpen) && (
                <div className="sub-nav">
                  <Link
                    href="/sales/salesbill"
                    className={`nav-sub-item ${pathname === '/sales/salesbill' ? 'active' : ''}`}
                  >
                    📄 Sales Bill
                  </Link>
                  <Link
                    href="/sales/salesorder"
                    className={`nav-sub-item ${pathname === '/sales/salesorder' ? 'active' : ''}`}
                  >
                    📦 Sales Order
                  </Link>
                </div>
              )}
            </div>

            {/* Purchases Dropdown Menu */}
            <div className="nav-dropdown-container">
              <div
                className={`nav-item dropdown-toggle ${pathname?.startsWith('/purchases') ? 'active-parent' : ''}`}
                onClick={() => {
                  if (isCollapsed) setIsCollapsed(false);
                  setIsPurchasesOpen(!isPurchasesOpen);
                }}
                title={isCollapsed ? 'Purchases' : ''}
              >
                <span className="nav-icon">🛒</span>
                {!isCollapsed && (
                  <>
                    <span className="nav-label" style={{ flex: 1 }}>Purchases</span>
                    <span className="dropdown-arrow">{isPurchasesOpen ? '▼' : '▶'}</span>
                  </>
                )}
              </div>

              {(!isCollapsed && isPurchasesOpen) && (
                <div className="sub-nav">
                  <Link
                    href="/purchases/bills"
                    className={`nav-sub-item ${pathname === '/purchases/bills' ? 'active' : ''}`}
                  >
                    📥 Purchase Bills
                  </Link>
                  <Link
                    href="/purchases/ledger"
                    className={`nav-sub-item ${pathname === '/purchases/ledger' ? 'active' : ''}`}
                  >
                    📒 Supplier Ledger
                  </Link>
                </div>
              )}
            </div>

            {/* Reports Dropdown Menu */}
            <div className="nav-dropdown-container">
              <div
                className={`nav-item dropdown-toggle ${pathname?.startsWith('/reports') ? 'active-parent' : ''}`}
                onClick={() => {
                  if (isCollapsed) setIsCollapsed(false);
                  setIsReportsOpen(!isReportsOpen);
                }}
                title={isCollapsed ? 'Purchases' : ''}
              >
                <span className="nav-icon">🛒</span>
                {!isCollapsed && (
                  <>
                    <span className="nav-label" style={{ flex: 1 }}>Reports</span>
                    <span className="dropdown-arrow">{isReportsOpen ? '▼' : '▶'}</span>
                  </>
                )}
              </div>

              {(!isCollapsed && isReportsOpen) && (
                <div className="sub-nav">
                  <Link
                    href="/reports/daybook"
                    className={`nav-sub-item ${pathname === '/reports/daybook' ? 'active' : ''}`}
                  >
                    📖 Day Book
                  </Link>
                  <Link
                    href="/reports/gst"
                    className={`nav-sub-item ${pathname === '/reports/gst' ? 'active' : ''}`}
                  >
                    📑 GST Reports
                  </Link>
                </div>
              )}
            </div>

            {/* <Link
              href="/ledger"
              className={`nav-item ${pathname === '/ledger' ? 'active' : ''}`}
              title={isCollapsed ? 'Ledger' : ''}
            >
              <span className="nav-icon">📖</span>
              {!isCollapsed && <span className="nav-label">Ledger</span>}
            </Link> */}

            <Link
              href="/settings"
              className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}
              title={isCollapsed ? 'Settings' : ''}
            >
              <span className="nav-icon">⚙️</span>
              {!isCollapsed && <span className="nav-label">Settings</span>}
            </Link>
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
          cursor: pointer;
        }

        .dropdown-toggle {
          user-select: none;
        }

        .dropdown-arrow {
          font-size: 10px;
          color: #64748b;
        }

        .sub-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-left: 32px;
          margin: 2px 0 6px 0;
        }

        .nav-sub-item {
          color: #94a3b8;
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }

        .nav-sub-item:hover,
        .nav-sub-item.active {
          background: #1e293b;
          color: #38bdf8;
        }

        .nav-icon {
          font-size: 16px;
          min-width: 20px;
          text-align: center;
        }

        :global(.nav-item:hover),
        :global(.nav-item.active),
        :global(.nav-item.active-parent) {
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
            display: none;
          }

          nav {
            flex-direction: row;
            justify-content: space-around;
            width: 100%;
            gap: 0;
          }

          .sub-nav {
            display: none !important; /* Hide dropdown list on mobile bottom bar */
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

          :global(.nav-item.active),
          :global(.nav-item.active-parent) {
            color: #38bdf8;
            font-weight: 600;
          }
        }
      `}</style>
    </>
  );
}