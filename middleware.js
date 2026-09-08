import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const token = req.cookies.get('sb-access-token');

  const isAuthPage = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/signup');

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/productsinfo/:path*', '/pos/:path*', '/orders/:path*', '/login', '/signup'],
};