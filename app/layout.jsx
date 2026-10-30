'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import './global.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased overflow-hidden">
        {isAuthPage ? (
          <main className="min-h-screen flex items-center justify-center bg-slate-100">
            {children}
          </main>
        ) : (
          <div className="flex h-screen bg-slate-100">
            {/* Dark Enterprise Sidebar */}
            <aside className="w-64 h-full shrink-0 shadow-lg z-10">
              <Sidebar />
            </aside>

            {/* Main Content Pane */}
            <main className="flex-1 h-full overflow-y-auto p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}