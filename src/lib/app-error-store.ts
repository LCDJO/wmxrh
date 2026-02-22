/**
 * AppErrorStore — Store in-memory para erros de runtime da aplicação.
 *
 * Funciona como um buffer circular (FIFO) que armazena os últimos MAX_ERRORS
 * erros capturados pelos mecanismos de proteção global:
 *
 *   - ErrorBoundary (React)      → source: 'error_boundary'
 *   - window.onunhandledrejection → source: 'unhandled_rejection'
 *   - window.onerror              → source: 'global_error'
 *
 * Consumido pelo PlatformLogs na aba "Erros de Aplicação" para
 * dar visibilidade de erros ao time de suporte/plataforma.
 *
 * Padrão: Observer — listeners são notificados em push e clear.
 * Usa `useSyncExternalStore` no React para reatividade sem re-renders desnecessários.
 *
 * @see ErrorBoundary — pushAppError no componentDidCatch
 * @see UnhandledRejectionGuard — pushAppError no handler de unhandledrejection
 * @see PlatformLogs — consome via getAppErrors + onAppErrorsChange
 */

/** Estrutura de um erro capturado */
export interface AppError {
  /** UUID único do erro */
  id: string;
  /** Timestamp ISO-8601 de quando o erro foi capturado */
  timestamp: string;
  /** Mecanismo que capturou o erro */
  source: 'error_boundary' | 'unhandled_rejection' | 'global_error';
  /** Mensagem de erro legível */
  message: string;
  /** Stack trace completo (quando disponível) */
  stack?: string;
  /** Component stack do React (apenas ErrorBoundary) */
  componentStack?: string;
  /** Rota onde o erro ocorreu */
  url: string;
}

/** Limite máximo de erros armazenados — evita crescimento infinito de memória */
const MAX_ERRORS = 200;

/** Buffer de erros — mais recente primeiro (unshift) */
let errors: AppError[] = [];

/** Listeners do padrão Observer — notificados em push/clear */
let listeners: Array<() => void> = [];

/** Notifica todos os listeners registrados */
function notify() {
  listeners.forEach(fn => fn());
}

/**
 * Registra um novo erro no store.
 *
 * @param error - Dados do erro (sem id, timestamp e url — gerados automaticamente)
 *
 * O erro é adicionado no início do array (newest-first) e o buffer
 * é truncado em MAX_ERRORS para evitar vazamento de memória.
 */
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

/**
 * Retorna snapshot de todos os erros armazenados (newest-first).
 * Usado como `getSnapshot` do `useSyncExternalStore`.
 */
export function getAppErrors(): AppError[] {
  return errors;
}

/**
 * Limpa todos os erros do store.
 * Acionado pelo botão "Limpar" na aba de erros do PlatformLogs.
 */
export function clearAppErrors(): void {
  errors = [];
  notify();
}

/**
 * Registra um listener para mudanças no store.
 * Retorna função de unsubscribe (cleanup).
 * Usado como `subscribe` do `useSyncExternalStore`.
 */
export function onAppErrorsChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}
