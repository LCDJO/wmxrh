/**
 * EmployeeLifecycleEngine — Unified Domain Barrel
 *
 * CAMADA 3: Reestruturação do módulo RH em 4 domínios segregados:
 *
 *   1. Recruitment  — Pipeline de aquisição de talentos (ATS)
 *   2. Onboarding   — Integração pós-admissão com checklists e probation
 *   3. Performance  — Avaliações (90°/180°/360°), OKRs, calibração
 *   4. Development  — PDI, skill matrix, mentoria, sucessão
 *
 * Cada domínio é autônomo, com tipos, serviço e métricas próprias.
 * Comunicação entre domínios via GovernanceEventBus (eventos imutáveis).
 *
 * Re-exports legados de `employee/` para compatibilidade.
 */

// ── Recruitment ──
export * from './recruitment';

// ── Onboarding ──
export * from './onboarding';

// ── Performance ──
export * from './performance';

// ── Development ──
export * from './development';

// ── Legacy re-exports (backward compatibility) ──
export { employeeService } from '@/domains/employee/employee.service';
export { employeeEventService } from '@/domains/employee/employee-event.service';
