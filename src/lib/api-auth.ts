/**
 * API Authentication & Authorization Helpers
 * Provides reusable functions for securing API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'client';
  clientId?: string;
}

/**
 * Verify user is authenticated (has valid session)
 * Returns user data if authenticated, null if not
 */
export async function verifyAuthentication(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email || '',
    role: session.user.role as 'admin' | 'client',
    clientId: session.user.clientId || undefined,
  };
}

/**
 * Verify user is admin
 * Returns user data if admin, throws error if not
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await verifyAuthentication();

  if (!user) {
    throw new AuthError('Unauthorized - Authentication required', 401);
  }

  if (user.role !== 'admin') {
    throw new AuthError('Forbidden - Admin access required', 403);
  }

  return user;
}

/**
 * Verify user owns the specified client
 * Admins can access any client, regular users only their own
 */
export async function requireClientAccess(clientId: string): Promise<AuthenticatedUser> {
  const user = await verifyAuthentication();

  if (!user) {
    throw new AuthError('Unauthorized - Authentication required', 401);
  }

  // Admin can access any client
  if (user.role === 'admin') {
    return user;
  }

  // Non-admin must own the client
  if (user.clientId !== clientId) {
    throw new AuthError('Forbidden - You do not have access to this client', 403);
  }

  return user;
}

/**
 * Custom error class for authentication/authorization errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Error handler for API routes
 * Converts AuthError to proper JSON response
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode }
    );
  }

  // Generic error
  console.error('API Error:', error);
  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Verify CRON secret for scheduled jobs
 */
export function verifyCronSecret(secret: string | null | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is not set in env, reject all requests
  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return secret === cronSecret;
}
