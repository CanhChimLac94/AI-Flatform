import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// No-op middleware: app uses its own I18nContext, not next-intl routing.
// next-intl/middleware was causing 404 on "/" when Accept-Language: en
// because it redirected to "/en/" which has no [locale] route group.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
