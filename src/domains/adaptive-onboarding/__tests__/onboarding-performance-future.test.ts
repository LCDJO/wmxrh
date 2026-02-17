/**
 * Tests for:
 *   12) Performance — incremental progress cache
 *   13) Future preparation — AI assistant, segment templates, auto-import
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveProgressToCache,
  loadProgressFromCache,
  invalidateCache,
  isCacheValidForFlow,
  hydrateProgressFromCache,
  isOnboardingCompleteFromCache,
} from '../onboarding-progress-cache';
import {
  createOnboardingAIAssistant,
  createSegmentTemplateRegistry,
  createAutoImportOrchestrator,
  type MarketSegment,
} from '../onboarding-future';
import { createOnboardingFlowResolver } from '../onboarding-flow-resolver';
import { initializeProgress } from '../onboarding-progress-tracker';
import type { OnboardingProgress, FlowResolverContext } from '../types';

// ── Mock localStorage ───────────────────────────────────────────

const store: Record<string, string> = {};
const mockStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  vi.stubGlobal('localStorage', mockStorage);
});

// ═══════════════════════════════════════════════════════════════
// 12) PERFORMANCE — Progress Cache
// ═══════════════════════════════════════════════════════════════

describe('Onboarding Progress Cache', () => {
  const TENANT = 'cache_tenant';
  let progress: OnboardingProgress;

  beforeEach(() => {
    const resolver = createOnboardingFlowResolver();
    const ctx: FlowResolverContext = { planTier: 'professional' };
    const flow = resolver.resolveFlow(TENANT, ctx);
    progress = {
      tenant_id: TENANT,
      flow,
      completed_steps: ['welcome', 'create_company'],
      skipped_steps: ['setup_departments'],
      current_step_id: 'configure_roles',
      last_activity_at: Date.now(),
    };
    flow.completion_pct = 35;
  });

  describe('saveProgressToCache + loadProgressFromCache', () => {
    it('round-trips progress snapshot', () => {
      saveProgressToCache(progress);
      const snapshot = loadProgressFromCache(TENANT);

      expect(snapshot).toBeTruthy();
      expect(snapshot!.tenant_id).toBe(TENANT);
      expect(snapshot!.completed_steps).toEqual(['welcome', 'create_company']);
      expect(snapshot!.skipped_steps).toEqual(['setup_departments']);
      expect(snapshot!.current_step_id).toBe('configure_roles');
      expect(snapshot!.completion_pct).toBe(35);
    });

    it('returns null for unknown tenant', () => {
      expect(loadProgressFromCache('unknown')).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('removes cached data', () => {
      saveProgressToCache(progress);
      expect(loadProgressFromCache(TENANT)).toBeTruthy();

      invalidateCache(TENANT);
      expect(loadProgressFromCache(TENANT)).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('invalidates after TTL', () => {
      saveProgressToCache(progress, 1); // 1ms TTL

      // Force expiration by manipulating cached_at
      const key = Object.keys(store).find(k => k.includes(TENANT))!;
      const parsed = JSON.parse(store[key]);
      parsed.cached_at = Date.now() - 1000; // 1s ago, TTL is 1ms
      store[key] = JSON.stringify(parsed);

      expect(loadProgressFromCache(TENANT)).toBeNull();
    });
  });

  describe('isCacheValidForFlow', () => {
    it('returns true when step count matches', () => {
      saveProgressToCache(progress);
      expect(isCacheValidForFlow(TENANT, progress.flow)).toBe(true);
    });

    it('returns false when step count differs', () => {
      saveProgressToCache(progress);
      const modifiedFlow = { ...progress.flow, steps: [...progress.flow.steps, { id: 'new_step' } as any] };
      expect(isCacheValidForFlow(TENANT, modifiedFlow)).toBe(false);
    });

    it('returns false for uncached tenant', () => {
      expect(isCacheValidForFlow('unknown', progress.flow)).toBe(false);
    });
  });

  describe('hydrateProgressFromCache', () => {
    it('restores step statuses from snapshot', () => {
      saveProgressToCache(progress);
      const snapshot = loadProgressFromCache(TENANT)!;

      const resolver = createOnboardingFlowResolver();
      const freshFlow = resolver.resolveFlow(TENANT, { planTier: 'professional' });

      const hydrated = hydrateProgressFromCache(snapshot, freshFlow);

      expect(hydrated.completed_steps).toEqual(['welcome', 'create_company']);
      expect(hydrated.skipped_steps).toEqual(['setup_departments']);
      expect(hydrated.current_step_id).toBe('configure_roles');

      const welcomeStep = hydrated.flow.steps.find(s => s.id === 'welcome');
      expect(welcomeStep?.status).toBe('completed');

      const deptStep = hydrated.flow.steps.find(s => s.id === 'setup_departments');
      expect(deptStep?.status).toBe('skipped');
    });
  });

  describe('isOnboardingCompleteFromCache', () => {
    it('returns false for incomplete onboarding', () => {
      saveProgressToCache(progress);
      expect(isOnboardingCompleteFromCache(TENANT)).toBe(false);
    });

    it('returns true for 100% completion', () => {
      progress.flow.completion_pct = 100;
      saveProgressToCache(progress);
      expect(isOnboardingCompleteFromCache(TENANT)).toBe(true);
    });

    it('returns null for cache miss', () => {
      expect(isOnboardingCompleteFromCache('unknown')).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 13) FUTURE PREPARATION
// ═══════════════════════════════════════════════════════════════

describe('Future: AI Assistant', () => {
  const assistant = createOnboardingAIAssistant();

  it('startSession returns greeting message', async () => {
    const msg = await assistant.startSession('t1', 'professional');
    expect(msg.role).toBe('assistant');
    expect(msg.content).toContain('assistente');
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it('sendMessage returns placeholder', async () => {
    const msg = await assistant.sendMessage('t1', 'Como configuro?', {
      currentStep: null,
      completionPct: 0,
    });
    expect(msg.role).toBe('assistant');
  });

  it('getSuggestion returns tip for step', async () => {
    const step = { id: 'test', title: 'Test Step', description: 'Test desc' } as any;
    const msg = await assistant.getSuggestion('t1', step);
    expect(msg).toBeTruthy();
    expect(msg!.content).toContain('Test Step');
    expect(msg!.suggested_action?.type).toBe('complete_step');
  });

  it('isAvailable returns false for free tier', () => {
    expect(assistant.isAvailable('free')).toBe(false);
    expect(assistant.isAvailable('starter')).toBe(false);
    expect(assistant.isAvailable('professional')).toBe(true);
    expect(assistant.isAvailable('enterprise')).toBe(true);
  });
});

describe('Future: Segment Templates', () => {
  const registry = createSegmentTemplateRegistry();

  it('lists all available templates', () => {
    const templates = registry.listTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(6);
  });

  it('getTemplate returns correct template', () => {
    const varejo = registry.getTemplate('varejo');
    expect(varejo).toBeTruthy();
    expect(varejo!.label).toContain('Varejo');
    expect(varejo!.suggested_departments).toContain('Vendas');
  });

  it('getTemplate returns null for unknown', () => {
    expect(registry.getTemplate('generic')).toBeNull();
  });

  it('detectSegmentFromCNAE maps correctly', () => {
    expect(registry.detectSegmentFromCNAE('47.11-3')).toBe('varejo');
    expect(registry.detectSegmentFromCNAE('62.01-5')).toBe('tecnologia');
    expect(registry.detectSegmentFromCNAE('86.10-1')).toBe('saude');
    expect(registry.detectSegmentFromCNAE('41.20-4')).toBe('construcao');
    expect(registry.detectSegmentFromCNAE('99.99-9')).toBe('generic');
  });

  it('industria template has NR focus', () => {
    const ind = registry.getTemplate('industria');
    expect(ind!.applicable_nrs.length).toBeGreaterThan(10);
    expect(ind!.compliance_focus).toContain('insalubridade');
  });

  it('saude template has hospital roles', () => {
    const saude = registry.getTemplate('saude');
    expect(saude!.suggested_positions).toContain('Médico');
    expect(saude!.suggested_positions).toContain('Enfermeiro');
  });

  it('construcao template focuses on safety NRs', () => {
    const constr = registry.getTemplate('construcao');
    expect(constr!.applicable_nrs).toContain(18);
    expect(constr!.applicable_nrs).toContain(35);
  });
});

describe('Future: Auto-Import Orchestrator', () => {
  const orchestrator = createAutoImportOrchestrator();

  it('lists supported sources', () => {
    const sources = orchestrator.getSupportedSources();
    expect(sources).toContain('csv');
    expect(sources).toContain('xlsx');
    expect(sources).toContain('esocial_xml');
  });

  it('lists importable entities', () => {
    const entities = orchestrator.getImportableEntities();
    expect(entities).toContain('employees');
    expect(entities).toContain('departments');
  });

  it('validateImport returns not-available warning', async () => {
    const result = await orchestrator.validateImport('t1', 'csv', 'employees', null);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('não está disponível');
  });

  it('startImport returns pending job', async () => {
    const job = await orchestrator.startImport('t1', {
      tenant_id: 't1',
      source: 'csv',
      entity: 'employees',
      total_rows: 100,
      mappings: [],
    });
    expect(job.status).toBe('pending');
    expect(job.id).toContain('import_');
  });

  it('isAvailable only for enterprise', () => {
    expect(orchestrator.isAvailable('free')).toBe(false);
    expect(orchestrator.isAvailable('professional')).toBe(false);
    expect(orchestrator.isAvailable('enterprise')).toBe(true);
  });
});
