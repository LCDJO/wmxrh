/**
 * In-memory store for application runtime errors.
 * Captured by ErrorBoundary and UnhandledRejectionGuard.
 * Exposed to PlatformLogs for the "Erros de Aplicação" tab.
 */

export interface AppError {
  id: string;
  timestamp: string;
  source: 'error_boundary' | 'unhandled_rejection' | 'global_error';
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
}

const MAX_ERRORS = 200;
let errors: AppError[] = [];
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach(fn => fn());
}

export function pushAppError(error: Omit<AppError, 'id' | 'timestamp' | 'url'>): void {
  const entry: AppError = {
    ...error,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.pathname : '/',
  };
  errors = [entry, ...errors].slice(0, MAX_ERRORS);
  notify();
}

export function getAppErrors(): AppError[] {
  return errors;
}

export function clearAppErrors(): void {
  errors = [];
  notify();
}

export function onAppErrorsChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}
