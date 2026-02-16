/**
 * eSocial Event Service
 * Manages the eSocial event queue and mappings for government integration.
 * Prepared for: S-1000, S-2200, S-2300, SST, GFIP/FGTS
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type {
  ESocialEvent, ESocialEventMapping, CreateESocialEventDTO,
  ESocialEventStatus, ESocialEventCategory,
} from '@/domains/shared/types';

// ── Event type constants ──

export const ESOCIAL_EVENTS = {
  // Tabelas
  S1000: 'S-1000', // Informações do Empregador
  S1030: 'S-1030', // Tabela de Cargos
  S1040: 'S-1040', // Tabela de Funções
  S1050: 'S-1050', // Tabela de Horários
  S1070: 'S-1070', // Tabela de Processos

  // Não periódicos
  S2200: 'S-2200', // Admissão
  S2205: 'S-2205', // Alteração Dados Cadastrais
  S2206: 'S-2206', // Alteração Contratual
  S2230: 'S-2230', // Afastamento Temporário
  S2299: 'S-2299', // Desligamento
  S2300: 'S-2300', // Trabalhador Sem Vínculo - Início

  // Periódicos
  S1200: 'S-1200', // Remuneração
  S1210: 'S-1210', // Pagamentos
  S1299: 'S-1299', // Fechamento Eventos Periódicos

  // SST
  S2210: 'S-2210', // CAT (Comunicação de Acidente de Trabalho)
  S2220: 'S-2220', // ASO (Monitoramento Saúde)
  S2240: 'S-2240', // Condições Ambientais - Agentes Nocivos

  // GFIP/FGTS
  GFIP: 'GFIP',
  FGTS_DIGITAL: 'FGTS_DIGITAL',
} as const;

export const CATEGORY_LABELS: Record<ESocialEventCategory, string> = {
  tabelas: 'Tabelas',
  nao_periodicos: 'Não Periódicos',
  periodicos: 'Periódicos',
  sst: 'SST',
  gfip_fgts: 'GFIP/FGTS',
};

export const STATUS_LABELS: Record<ESocialEventStatus, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  sent: 'Enviado',
  accepted: 'Aceito',
  rejected: 'Rejeitado',
  error: 'Erro',
  cancelled: 'Cancelado',
};

export const esocialEventService = {
  // ── Events CRUD ──

  async list(scope: QueryScope, opts?: {
    status?: ESocialEventStatus;
    category?: ESocialEventCategory;
    event_type?: string;
    reference_period?: string;
    limit?: number;
  }) {
    let q = applyScope(
      supabase.from('esocial_events').select('*'),
      scope,
      { skipSoftDelete: true },
    ).order('created_at', { ascending: false });

    if (opts?.status) q = q.eq('status', opts.status);
    if (opts?.category) q = q.eq('category', opts.category);
    if (opts?.event_type) q = q.eq('event_type', opts.event_type);
    if (opts?.reference_period) q = q.eq('reference_period', opts.reference_period);
    q = q.limit(opts?.limit ?? 100);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as ESocialEvent[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('esocial_events')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as ESocialEvent;
  },

  async create(dto: CreateESocialEventDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase
      .from('esocial_events')
      .insert([secured as any])
      .select()
      .single();
    if (error) throw error;
    return data as ESocialEvent;
  },

  async updateStatus(id: string, status: ESocialEventStatus, errorMessage?: string) {
    const update: Record<string, unknown> = { status };
    if (status === 'sent') update.sent_at = new Date().toISOString();
    if (status === 'processing') update.processed_at = new Date().toISOString();
    if (errorMessage) update.error_message = errorMessage;

    const { data, error } = await supabase
      .from('esocial_events')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ESocialEvent;
  },

  async cancel(id: string) {
    return this.updateStatus(id, 'cancelled');
  },

  async retry(id: string) {
    const { data, error } = await supabase
      .from('esocial_events')
      .update({ status: 'pending', retry_count: supabase.rpc as any, error_message: null })
      .eq('id', id)
      .select()
      .single();
    // Fallback: just reset status
    if (error) {
      return this.updateStatus(id, 'pending');
    }
    return data as ESocialEvent;
  },

  // ── Stats ──

  async getStatusCounts(scope: QueryScope) {
    const { data, error } = await applyScope(
      supabase.from('esocial_events').select('status'),
      scope,
      { skipSoftDelete: true },
    );
    if (error) throw error;

    const counts: Record<ESocialEventStatus, number> = {
      pending: 0, processing: 0, sent: 0, accepted: 0, rejected: 0, error: 0, cancelled: 0,
    };
    (data || []).forEach((row: any) => {
      if (row.status in counts) counts[row.status as ESocialEventStatus]++;
    });
    return counts;
  },

  // ── Mappings ──

  async listMappings(scope: QueryScope) {
    const { data, error } = await supabase
      .from('esocial_event_mappings')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .order('esocial_event_type');
    if (error) throw error;
    return (data || []) as ESocialEventMapping[];
  },

  async toggleMapping(id: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('esocial_event_mappings')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ESocialEventMapping;
  },
};
