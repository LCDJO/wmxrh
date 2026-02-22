/**
 * Logger — Utilitário centralizado de logging.
 *
 * - Dev: imprime no console.
 * - Prod: error() pode ser integrado a um serviço de monitoramento.
 */
const isDev = import.meta.env.DEV;

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];
const listeners = new Set<(logs: LogEntry[]) => void>();

function addLog(level: LogLevel, message: string, data?: unknown) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    level,
    message,
    data,
  };
  
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();
  
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach(fn => fn([...logs]));
}

export const logger = {
  error: (message: string, data?: unknown) => {
    addLog('error', message, data);
    if (isDev) {
      console.error(`[ERROR] ${message}`, data);
    }
    // Em produção: enviar para serviço de monitoramento (Sentry, Datadog, etc.)
  },

  warn: (message: string, data?: unknown) => {
    addLog('warn', message, data);
    if (isDev) {
      console.warn(`[WARN] ${message}`, data);
    }
  },

  info: (message: string, data?: unknown) => {
    addLog('info', message, data);
    if (isDev) {
      console.info(`[INFO] ${message}`, data);
    }
  },

  debug: (message: string, data?: unknown) => {
    addLog('debug', message, data);
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },

  // API para componentes React
  subscribe: (callback: (logs: LogEntry[]) => void) => {
    listeners.add(callback);
    callback([...logs]); // enviar estado inicial
    return () => listeners.delete(callback);
  },

  getLogs: () => [...logs],
  
  clearLogs: () => {
    logs.length = 0;
    notifyListeners();
  },
};
