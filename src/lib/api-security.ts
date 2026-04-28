/**
 * API Security Middleware - Input Validation & Rate Limiting
 * Apply these to all public-facing API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, getClientIp } from '@/lib/utils/rate-limit';
import { isValidDate, isValidUUID, sanitizeString } from '@/lib/utils/validation';

/**
 * Apply rate limiting to API route
 * Returns NextResponse with 429 error if rate limit exceeded
 */
export function applyRateLimit(
  request: NextRequest,
  limiter: 'auth' | 'admin' | 'api' = 'api'
): NextResponse | null {
  const ip = getClientIp(request);
  const limit = rateLimiters[limiter](ip);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: limit.remaining, // seconds
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.remaining),
        },
      }
    );
  }

  return null; // No rate limit error
}

/**
 * Validate common API parameters
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateDateRange(
  startDate: string | null,
  endDate: string | null
): ValidationResult {
  const errors: string[] = [];

  if (!startDate) {
    errors.push('startDate is required');
  } else if (!isValidDate(startDate)) {
    errors.push('startDate must be in YYYY-MM-DD format');
  }

  if (!endDate) {
    errors.push('endDate is required');
  } else if (!isValidDate(endDate)) {
    errors.push('endDate must be in YYYY-MM-DD format');
  }

  if (errors.length === 0 && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      errors.push('startDate must be before endDate');
    }

    // Limit to 2 years range
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 730) {
      errors.push('Date range cannot exceed 2 years');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateClientId(clientId: string | null): ValidationResult {
  const errors: string[] = [];

  if (!clientId) {
    errors.push('clientId is required');
  } else {
    // Check if it's UUID or slug
    const isUUID = isValidUUID(clientId);
    const isSlug = /^[a-z0-9-]+$/.test(clientId);

    if (!isUUID && !isSlug) {
      errors.push('clientId must be a valid UUID or slug');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Combined security check: rate limiting + validation
 * Use this at the start of API routes
 */
export function validateApiRequest(
  request: NextRequest,
  options: {
    rateLimit?: 'auth' | 'admin' | 'api';
    requireDateRange?: boolean;
    requireClientId?: boolean;
  } = {}
): { error: NextResponse | null; params: Record<string, string> } {
  // 1. Apply rate limiting
  if (options.rateLimit !== undefined) {
    const rateLimitError = applyRateLimit(request, options.rateLimit);
    if (rateLimitError) {
      return { error: rateLimitError, params: {} };
    }
  }

  // 2. Extract and validate parameters
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  const errors: string[] = [];

  // Validate date range if required
  if (options.requireDateRange) {
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    } else {
      params.startDate = startDate!;
      params.endDate = endDate!;
    }
  }

  // Validate clientId if required
  if (options.requireClientId) {
    const clientId = searchParams.get('clientId');

    const clientValidation = validateClientId(clientId);
    if (!clientValidation.isValid) {
      errors.push(...clientValidation.errors);
    } else {
      params.clientId = clientId!;
    }
  }

  // Return validation errors if any
  if (errors.length > 0) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors,
        },
        { status: 400 }
      ),
      params: {},
    };
  }

  return { error: null, params };
}

/**
 * Sanitize request body to prevent XSS
 */
export function sanitizeRequestBody(body: any): any {
  if (typeof body === 'string') {
    return sanitizeString(body);
  }

  if (Array.isArray(body)) {
    return body.map(sanitizeRequestBody);
  }

  if (body && typeof body === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(body)) {
      sanitized[key] = sanitizeRequestBody(value);
    }
    return sanitized;
  }

  return body;
}
