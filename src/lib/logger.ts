/**
 * Logger — Utilitário centralizado de logging da aplicação.
 *
 * Funcionalidades:
 *   - Em DEV: imprime no console com prefixos coloridos [ERROR], [WARN], [INFO], [DEBUG]
 *   - Em PROD: captura silenciosamente (error() pode ser integrado a Sentry, Datadog, etc.)
 *   - Buffer circular: mantém os últimos MAX_LOGS entries em memória
 *   - Padrão Observer: components React podem se subscrever para exibir logs em tempo real
 *
 * Consumidores:
 *   - DevConsole (Ctrl+Shift+L) — exibe logs visuais em development
 *   - AuthContext, TenantContext — registram eventos de auth/tenant
 *   - Qualquer serviço que precise de logging estruturado
 *
 * Decisões de design:
 *   - Singleton global (não requer context React) para ser usável em qualquer camada
 *   - `subscribe` entrega o estado inicial imediatamente (cold start) para que
 *     o DevConsole mostre logs emitidos antes da montagem do componente
 *   - IDs gerados com timestamp+random para ordenação cronológica sem colisão
 *
 * @example
 * import { logger } from '@/lib/logger';
 * logger.info('Usuário logado', { userId: '123' });
 * logger.error('Falha na API', { status: 500 });
 */

const isDev = import.meta.env.DEV;

/** Níveis de severidade do log */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** Estrutura de uma entrada de log */
export interface LogEntry {
  /** ID único para key do React e deduplicação */
  id: string;
  /** Momento da emissão */
  timestamp: Date;
  /** Severidade */
  level: LogLevel;
  /** Mensagem principal (legível por humanos) */
  message: string;
  /** Dados estruturados adicionais (expandível no DevConsole) */
  data?: unknown;
}

/** Limite do buffer circular — evita vazamento de memória */
const MAX_LOGS = 500;

/** Buffer de logs — mais recente primeiro (unshift) */
const logs: LogEntry[] = [];

/** Set de listeners para o padrão Observer */
const listeners = new Set<(logs: LogEntry[]) => void>();

/**
 * Adiciona uma entrada ao buffer e notifica listeners.
 * Se o buffer exceder MAX_LOGS, o mais antigo é descartado (pop).
 *
 * @param level   - Severidade do log
 * @param message - Mensagem legível
 * @param data    - Dados estruturados opcionais
 */
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

/** Distribui snapshot atualizado para todos os listeners */
function notifyListeners() {
  listeners.forEach(fn => fn([...logs]));
}

/**
 * API pública do logger.
 *
 * Métodos de logging:
 *   - error(): erros críticos que requerem atenção
 *   - warn(): situações anômalas mas não fatais
 *   - info(): eventos informativos de fluxo normal
 *   - debug(): detalhes de implementação para debugging
 *
 * Métodos de consumo (React):
 *   - subscribe(): registra callback para atualizações em tempo real
 *   - getLogs(): snapshot pontual de todos os logs
 *   - clearLogs(): limpa buffer (acionado pelo botão no DevConsole)
 */
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

  /**
   * Subscreve para receber atualizações em tempo real.
   * O callback é chamado imediatamente com o estado atual (cold start).
   *
   * @returns Função de unsubscribe para cleanup em useEffect
   */
  subscribe: (callback: (logs: LogEntry[]) => void) => {
    listeners.add(callback);
    callback([...logs]); // enviar estado inicial
    return () => listeners.delete(callback);
  },

  /** Snapshot pontual de todos os logs (cópia defensiva) */
  getLogs: () => [...logs],
  
  /** Limpa todo o buffer de logs */
  clearLogs: () => {
    logs.length = 0;
    notifyListeners();
  },
};
