/**
 * PlanOptimizationAdvisor — Suggests plan changes to maximize revenue per tenant.
 */
import type { PlanOptimizationSuggestion } from './types';

export class PlanOptimizationAdvisor {
  getSuggestions(): PlanOptimizationSuggestion[] {
    return [
      {
        id: 'po-1', currentPlan: 'starter', suggestedPlan: 'professional',
        reason: 'Tenant utiliza 92% do limite de colaboradores e 4/5 módulos disponíveis.',
        expectedRevenueImpact: 280, tenantId: 't-1', tenantName: 'Acme Corp', confidence: 88,
      },
      {
        id: 'po-2', currentPlan: 'professional', suggestedPlan: 'enterprise',
        reason: 'Solicitou API access e custom branding — funcionalidades do Enterprise.',
        expectedRevenueImpact: 750, tenantId: 't-2', tenantName: 'TechFlow Ltda', confidence: 73,
      },
    ];
  }
}

export const planOptimizationAdvisor = new PlanOptimizationAdvisor();
