/**
 * AnnouncementHub — Domain service for Platform Institutional Announcements.
 *
 * Separates SaaS-level institutional communications from operational notifications.
 * Supports targeting: Global (tenant_id=null) or Tenant-specific.
 * Categories: maintenance, update, billing, security, compliance, general.
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type AnnouncementCategory =
  | 'maintenance'
  | 'update'
  | 'billing'
  | 'security'
  | 'compliance'
  | 'general';

export type AnnouncementPriority = 'low' | 'medium' | 'high' | 'critical';

export interface PlatformAnnouncement {
  id: string;
  tenant_id: string | null;
  title: string;
  description: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  action_url: string | null;
  action_label: string | null;
  is_dismissible: boolean;
  show_banner: boolean;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
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

// ══════════════════════════════════════════════════════════════
// UI Config
// ══════════════════════════════════════════════════════════════

export const CATEGORY_CONFIG: Record<AnnouncementCategory, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  maintenance: { label: 'Manutenção', icon: 'Wrench', color: 'text-warning', bgColor: 'bg-warning/10' },
  update:      { label: 'Atualização', icon: 'Sparkles', color: 'text-primary', bgColor: 'bg-primary/10' },
  billing:     { label: 'Faturamento', icon: 'CreditCard', color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
  security:    { label: 'Segurança', icon: 'ShieldAlert', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  compliance:  { label: 'Compliance', icon: 'Scale', color: 'text-purple-600', bgColor: 'bg-purple-500/10' },
  general:     { label: 'Geral', icon: 'Megaphone', color: 'text-muted-foreground', bgColor: 'bg-muted' },
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
