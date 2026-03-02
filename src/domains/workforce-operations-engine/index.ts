/**
 * WorkforceOperationsEngine — Unified Domain Barrel
 *
 * CAMADA 4: Motor de operações do dia-a-dia da força de trabalho.
 *
 * Subdomínios:
 *   1. TimeTracking        — Ponto, banco de horas, presença
 *   2. PayrollSimulation   — Simulação de folha, impostos, custo empregador
 *   3. Documents           — Gestão documental, validação, vault
 *   4. TerminationWorkflow — Desligamento, rescisão, archival
 *
 * Cada subdomínio é autônomo com tipos e serviço próprios.
 * Comunicação via GovernanceEventBus (eventos imutáveis).
 */

// ── Time Tracking ──
export * from './time-tracking';

// ── Payroll Simulation ──
export * from './payroll-simulation';

// ── Documents ──
export * from './documents';

// ── Termination Workflow ──
export * from './termination-workflow';
