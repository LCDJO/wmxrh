/**
 * AnnouncementHub — Domain service for Platform Institutional Announcements.
 *
 * TenantCommunicationCenter: Separates SaaS-level institutional communications
 * from operational notifications. Supports targeting: Global (tenant_id=null) or Tenant-specific.
 *
 * Categories: billing, fiscal, system, security, compliance, general
 * Source: manual | automatic | system
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type AnnouncementCategory =
  | 'billing'
  | 'fiscal'
  | 'system'
  | 'security'
  | 'compliance'
  | 'general'
  // legacy compat
  | 'maintenance'
  | 'update';

export type AnnouncementSubcategory =
  // Billing
  | 'plan_expiring'
  | 'payment_due'
  | 'payment_overdue'
  | 'plan_change'
  // Fiscal
  | 'nf_available'
  | 'nf_pending'
  | 'fiscal_failure'
  // System
  | 'scheduled_maintenance'
  | 'module_update'
  | 'policy_change'
  | 'feature_disabled'
  // Security
  | 'partial_suspension'
  | 'usage_limitation'
  | null;

export type AnnouncementPriority = 'low' | 'medium' | 'high' | 'critical';
export type AnnouncementSource = 'manual' | 'automatic' | 'system';

export interface PlatformAnnouncement {
  id: string;
  tenant_id: string | null;
  title: string;
  description: string;
  category: AnnouncementCategory;
  subcategory: AnnouncementSubcategory;
  priority: AnnouncementPriority;
  source: AnnouncementSource;
  action_url: string | null;
  action_label: string | null;
  is_dismissible: boolean;
  show_banner: boolean;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
  target_roles: string[];
  resolved_at: string | null;
  auto_resolve_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementDismissal {
  id: string;
  announcement_id: string;
  user_id: string;
  dismissed_at: string;
}

export interface CreateAnnouncementInput {
  tenant_id?: string | null;
  title: string;
  description: string;
  category: AnnouncementCategory;
  subcategory?: AnnouncementSubcategory;
  priority: AnnouncementPriority;
  source?: AnnouncementSource;
  action_url?: string | null;
  action_label?: string | null;
  is_dismissible?: boolean;
  show_banner?: boolean;
  starts_at?: string;
  expires_at?: string | null;
  target_roles?: string[];
  metadata?: Record<string, any>;
}

// ══════════════════════════════════════════════════════════════
// UI Config — Categories
// ══════════════════════════════════════════════════════════════

export const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  billing:     { label: 'Faturamento', icon: 'CreditCard', color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
  fiscal:      { label: 'Fiscal', icon: 'FileText', color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  system:      { label: 'Sistema', icon: 'Settings', color: 'text-primary', bgColor: 'bg-primary/10' },
  security:    { label: 'Segurança', icon: 'ShieldAlert', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  compliance:  { label: 'Compliance', icon: 'Scale', color: 'text-purple-600', bgColor: 'bg-purple-500/10' },
  general:     { label: 'Geral', icon: 'Megaphone', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  // legacy compat
  maintenance: { label: 'Manutenção', icon: 'Wrench', color: 'text-warning', bgColor: 'bg-warning/10' },
  update:      { label: 'Atualização', icon: 'Sparkles', color: 'text-primary', bgColor: 'bg-primary/10' },
};

export const SUBCATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  // Billing
  plan_expiring:         { label: 'Vencimento do Plano', icon: 'Clock' },
  payment_due:           { label: 'Mensalidade Próxima', icon: 'CalendarClock' },
  payment_overdue:       { label: 'Pagamento em Atraso', icon: 'AlertTriangle' },
  plan_change:           { label: 'Alteração de Plano', icon: 'RefreshCw' },
  // Fiscal
  nf_available:          { label: 'NF Disponível', icon: 'FileCheck' },
  nf_pending:            { label: 'NF Pendente', icon: 'FileClock' },
  fiscal_failure:        { label: 'Falha Fiscal', icon: 'FileWarning' },
  // System
  scheduled_maintenance: { label: 'Manutenção Programada', icon: 'Wrench' },
  module_update:         { label: 'Atualização de Módulo', icon: 'Sparkles' },
  policy_change:         { label: 'Mudança de Política', icon: 'BookOpen' },
  feature_disabled:      { label: 'Feature Desativada', icon: 'Ban' },
  // Security
  partial_suspension:    { label: 'Suspensão Parcial', icon: 'ShieldOff' },
  usage_limitation:      { label: 'Limitação de Uso', icon: 'Lock' },
};

export const PRIORITY_CONFIG: Record<AnnouncementPriority, {
  label: string;
  color: string;
  bannerClass: string;
}> = {
  low:      { label: 'Baixa', color: 'text-muted-foreground', bannerClass: 'bg-muted border-border' },
  medium:   { label: 'Média', color: 'text-primary', bannerClass: 'bg-primary/5 border-primary/20' },
  high:     { label: 'Alta', color: 'text-warning', bannerClass: 'bg-warning/10 border-warning/30' },
  critical: { label: 'Crítica', color: 'text-destructive', bannerClass: 'bg-destructive/10 border-destructive/30' },
};

export const SOURCE_CONFIG: Record<AnnouncementSource, { label: string; icon: string }> = {
  manual:    { label: 'Manual', icon: 'PenLine' },
  automatic: { label: 'Automático', icon: 'Bot' },
  system:    { label: 'Sistema', icon: 'Server' },
};

// Subcategories per category for form selectors
export const SUBCATEGORIES_BY_CATEGORY: Record<string, AnnouncementSubcategory[]> = {
  billing:  ['plan_expiring', 'payment_due', 'payment_overdue', 'plan_change'],
  fiscal:   ['nf_available', 'nf_pending', 'fiscal_failure'],
  system:   ['scheduled_maintenance', 'module_update', 'policy_change', 'feature_disabled'],
  security: ['partial_suspension', 'usage_limitation'],
  compliance: [],
  general:  [],
};

// ══════════════════════════════════════════════════════════════
// AnnouncementDispatcher — CRUD
// ══════════════════════════════════════════════════════════════

export const announcementDispatcher = {
  /** Fetch active announcements visible to the current user's tenant */
  async listActive(tenantId: string): Promise<PlatformAnnouncement[]> {
    const { data, error } = await supabase
      .from('platform_announcements')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as PlatformAnnouncement[];
  },

  /** Fetch ALL announcements for platform admin management */
  async listAll(filters?: {
    category?: string;
    source?: string;
    isActive?: boolean;
  }): Promise<PlatformAnnouncement[]> {
    let query = supabase
      .from('platform_announcements')
      .select('*')
      .order('created_at', { ascending: false }) as any;

    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.source) query = query.eq('source', filters.source);
    if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as PlatformAnnouncement[];
  },

  /** Create a new announcement */
  async create(input: CreateAnnouncementInput): Promise<PlatformAnnouncement> {
    const { data, error } = await supabase
      .from('platform_announcements')
      .insert({
        tenant_id: input.tenant_id ?? null,
        title: input.title,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory ?? null,
        priority: input.priority,
        source: input.source ?? 'manual',
        action_url: input.action_url ?? null,
        action_label: input.action_label ?? null,
        is_dismissible: input.is_dismissible ?? true,
        show_banner: input.show_banner ?? false,
        starts_at: input.starts_at ?? new Date().toISOString(),
        expires_at: input.expires_at ?? null,
        target_roles: input.target_roles ?? [],
        metadata: input.metadata ?? {},
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PlatformAnnouncement;
  },

  /** Update an announcement */
  async update(id: string, updates: Partial<CreateAnnouncementInput> & { is_active?: boolean }): Promise<void> {
    const { error } = await supabase
      .from('platform_announcements')
      .update(updates as any)
      .eq('id', id);

    if (error) throw error;
  },

  /** Deactivate an announcement */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('platform_announcements')
      .update({ is_active: false, resolved_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) throw error;
  },

  /** Fetch IDs already dismissed by this user */
  async getDismissedIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('announcement_dismissals')
      .select('announcement_id')
      .eq('user_id', userId);

    if (error) throw error;
    return new Set((data || []).map(d => (d as any).announcement_id));
  },

  /** Dismiss an announcement for this user */
  async dismiss(announcementId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('announcement_dismissals')
      .upsert({
        announcement_id: announcementId,
        user_id: userId,
      } as any, { onConflict: 'announcement_id,user_id' });

    if (error) throw error;
  },
};
