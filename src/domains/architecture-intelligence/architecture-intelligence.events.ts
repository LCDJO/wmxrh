/**
 * Architecture Intelligence — Domain Events
 *
 * Events:
 *   1. ModuleRegistered        → novo módulo registrado na plataforma
 *   2. ModuleUpdated           → módulo atualizado (status, versão, SLA, etc.)
 *   3. ArchitectureVersionCreated → nova versão arquitetural registrada
 *   4. DeliverableCompleted    → entregável marcado como concluído
 */

type EventHandler = (payload: Record<string, unknown>) => void;
const handlers = new Map<string, EventHandler[]>();

export const architectureIntelligenceEvents = {
  MODULE_REGISTERED: 'architecture:module_registered',
  MODULE_UPDATED: 'architecture:module_updated',
  ARCHITECTURE_VERSION_CREATED: 'architecture:version_created',
  DELIVERABLE_COMPLETED: 'architecture:deliverable_completed',
} as const;

export function emitArchitectureEvent(event: string, payload: Record<string, unknown>): void {
  const fns = handlers.get(event) || [];
  fns.forEach(fn => fn(payload));
}

export function onArchitectureEvent(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event)!.push(handler);
  return () => {
    const arr = handlers.get(event);
    if (arr) handlers.set(event, arr.filter(h => h !== handler));
  };
}

export const __DOMAIN_CATALOG = {
  domain: 'Architecture Intelligence',
  color: 'hsl(200 60% 50%)',
  events: [
    { name: 'ModuleRegistered', description: 'Novo módulo registrado na plataforma' },
    { name: 'ModuleUpdated', description: 'Módulo atualizado (status, versão, SLA)' },
    { name: 'ArchitectureVersionCreated', description: 'Nova versão arquitetural registrada' },
    { name: 'DeliverableCompleted', description: 'Entregável marcado como concluído' },
  ],
};
