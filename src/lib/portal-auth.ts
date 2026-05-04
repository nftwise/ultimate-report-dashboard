import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export interface PortalSession {
  userId: string;
  role: 'admin' | 'team' | 'client';
  clientId: string | null;
}

export class PortalAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'PortalAuthError';
  }
}

/**
 * Resolve the authenticated portal session for the request.
 * Throws PortalAuthError(401) if no session.
 */
export async function getPortalSession(): Promise<PortalSession> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || !user?.role) {
    throw new PortalAuthError(401, 'Unauthorized');
  }
  return {
    userId: user.id,
    role: user.role,
    clientId: user.clientId ?? null,
  };
}

/**
 * Validate that the session can access the requested clientId.
 * - admin/team: any clientId allowed (returns the requested id unchanged).
 * - client: must match session.clientId, otherwise 403.
 *
 * For client role, callers should ALWAYS pass the requested clientId from the
 * URL (not trust query params) and let this helper enforce. The returned id
 * is the one to use for DB queries.
 */
export function authorizeClientId(session: PortalSession, requestedClientId: string): string {
  if (!requestedClientId) {
    throw new PortalAuthError(400, 'clientId is required');
  }
  if (session.role === 'client') {
    if (!session.clientId || session.clientId !== requestedClientId) {
      throw new PortalAuthError(403, 'Forbidden — cannot access another client');
    }
  }
  return requestedClientId;
}

/**
 * Validate ISO date string (YYYY-MM-DD). Throws 400 if malformed.
 */
export function parseDateParam(name: string, value: string | null): string {
  if (!value) {
    throw new PortalAuthError(400, `${name} is required`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PortalAuthError(400, `${name} must be YYYY-MM-DD`);
  }
  return value;
}

/**
 * Resolve session and require admin or team role. Throws 401/403 otherwise.
 * Used by admin-only API routes that browser pages call.
 */
export async function requireAdminTeam(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (session.role !== 'admin' && session.role !== 'team') {
    throw new PortalAuthError(403, 'Forbidden — admin/team access required');
  }
  return session;
}
