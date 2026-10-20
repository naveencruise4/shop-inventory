// app/layout.jsx
import './global.css';

export const metadata = {
  title: 'Simple Shop Management Platform',
  description: 'Online POS and Inventory Management',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}