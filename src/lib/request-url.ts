import { NextRequest } from 'next/server';

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveAppUrl(request?: NextRequest): string {
  // Prefer the actual request host so OAuth callbacks work on preview deployments
  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const forwardedHost = request.headers.get('x-forwarded-host');

    if (forwardedProto && forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    return stripTrailingSlash(request.nextUrl.origin);
  }

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (configuredUrl) {
    return stripTrailingSlash(configuredUrl);
  }

  return 'http://localhost:3000';
}

export function resolveAbsoluteUrl(pathname: string, request?: NextRequest): string {
  return `${resolveAppUrl(request)}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
