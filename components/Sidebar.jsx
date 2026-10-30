'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
   // { name: 'Dashboard', href: '/dashboard' },
    { name: 'POS Checkout', href: '/pos' },
    { name: 'Sales Bills', href: '/orders?tab=bills' },
    { name: 'Sales Orders (Pre-Orders)', href: '/orders?tab=orders' },
    { name: 'Products & Inventory', href: '/products' },
    { name: 'Customer Ledger', href: '/ledger' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0b192c] text-slate-300 w-64 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <h1 className="text-base font-bold text-white tracking-wide">i2Integrate POS</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Enterprise Business Insight</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href.split('?')[0];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#1e293b] text-white font-semibold shadow-sm border-l-4 border-blue-500'
                  : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-slate-200'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Branding */}
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500">
        i2Integrate Solutions v2.6
      </div>
    </div>
  );
}