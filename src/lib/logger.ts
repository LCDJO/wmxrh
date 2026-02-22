/**
 * Logger — Utilitário centralizado de logging.
 *
 * - Dev: imprime no console.
 * - Prod: error() pode ser integrado a um serviço de monitoramento.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  error: (message: string, data?: unknown) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, data);
    }
    // Em produção: enviar para serviço de monitoramento (Sentry, Datadog, etc.)
  },

  warn: (message: string, data?: unknown) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, data);
    }
  },
};
