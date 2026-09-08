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
      <head>
        <style>{`
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          a {
            color: inherit;
            text-decoration: none;
          }
          button, input, select, textarea {
            font-family: inherit;
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}