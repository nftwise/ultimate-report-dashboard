/**
 * Simple error logging utility
 *
 * KISS approach: Console logging with structured format
 * Upgrade to Sentry later if needed
 *
 * Benefits:
 * - No external dependencies
 * - Works immediately
 * - Logs visible in Vercel dashboard
 * - Easy to upgrade to Sentry/DataDog later
 */

export type ErrorContext = {
  /**
   * Error location (e.g., 'API:/api/admin/overview-fast')
   */
  location: string;

  /**
   * User ID (if available)
   */
  userId?: string;

  /**
   * Client ID (if available)
   */
  clientId?: string;

  /**
   * Additional context
   */
  [key: string]: any;
};

export type ErrorSeverity = 'error' | 'warning' | 'info' | 'fatal';

/**
 * Log an error with context
 *
 * @example
 * ```ts
 * try {
 *   await fetchData()
 * } catch (error) {
 *   logError(error, {
 *     location: 'API:/api/dashboard',
 *     userId: user.id,
 *     action: 'fetchData'
 *   })
 * }
 * ```
 */
export function logError(
  error: unknown,
  context: ErrorContext,
  severity: ErrorSeverity = 'error'
): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const logData = {
    timestamp,
    severity,
    message: errorMessage,
    stack: errorStack,
    ...context,
  };

  // Log to console (visible in Vercel logs)
  const prefix = {
    fatal: '🔴 [FATAL]',
    error: '❌ [ERROR]',
    warning: '⚠️  [WARNING]',
    info: 'ℹ️  [INFO]',
  }[severity];

  console.error(prefix, JSON.stringify(logData, null, 2));

  // TODO: Send to Sentry when SENTRY_DSN is configured
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(error, { contexts: { custom: context } });
  // }
}

/**
 * Log a warning
 */
export function logWarning(message: string, context?: Partial<ErrorContext>): void {
  logError(new Error(message), { location: 'Unknown', ...context }, 'warning');
}

/**
 * Log info message
 */
export function logInfo(message: string, context?: Partial<ErrorContext>): void {
  console.log('ℹ️  [INFO]', message, context || '');
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  /**
   * End monitoring and log duration
   */
  end(context?: Partial<ErrorContext>): number {
    const duration = Date.now() - this.startTime;

    if (duration > 1000) {
      // Log slow operations
      logWarning(`Slow operation detected: ${this.label}`, {
        location: this.label,
        duration,
        ...context,
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️  [PERF] ${this.label}: ${duration}ms`, context || '');
    }

    return duration;
  }
}

/**
 * Async error boundary wrapper
 *
 * @example
 * ```ts
 * const result = await safely(
 *   async () => await fetchData(),
 *   {
 *     location: 'API:/api/dashboard',
 *     fallback: { data: [] }
 *   }
 * );
 * ```
 */
export async function safely<T>(
  fn: () => Promise<T>,
  options: {
    location: string;
    fallback?: T;
    onError?: (error: unknown) => void;
  }
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logError(error, { location: options.location });

    if (options.onError) {
      options.onError(error);
    }

    return options.fallback;
  }
}

/**
 * Global error handler for unhandled errors
 */
if (typeof window !== 'undefined') {
  // Client-side error handler
  window.addEventListener('error', (event) => {
    logError(event.error, {
      location: 'Client:GlobalErrorHandler',
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, {
      location: 'Client:UnhandledPromiseRejection',
    });
  });
}

/**
 * Health check logger
 */
export function logHealthCheck(
  service: string,
  status: 'healthy' | 'degraded' | 'down',
  details?: Record<string, any>
): void {
  const emoji = {
    healthy: '✅',
    degraded: '⚠️ ',
    down: '🔴',
  }[status];

  console.log(`${emoji} [HEALTH] ${service}: ${status}`, details || '');

  if (status === 'down') {
    logError(new Error(`Service ${service} is down`), {
      location: 'HealthCheck',
      service,
      ...details,
    }, 'fatal');
  }
}
