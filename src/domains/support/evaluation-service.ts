import { supabase } from '@/integrations/supabase/client';
import type { SupportEvaluation, SystemRating } from './types';

export const EvaluationService = {
  async createTicketEvaluation(data: {
    ticket_id: string;
    tenant_id: string;
    agent_id: string | null;
    agent_score: number | null;
    system_score: number | null;
    comment?: string;
  }): Promise<SupportEvaluation> {
    const { data: result, error } = await supabase
      .from('support_evaluations')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result as unknown as SupportEvaluation;
  },

  async getByTicket(ticketId: string): Promise<SupportEvaluation | null> {
    const { data, error } = await supabase
      .from('support_evaluations')
      .select('*')
      .eq('ticket_id', ticketId)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as SupportEvaluation | null;
  },

  async listAll(): Promise<SupportEvaluation[]> {
    const { data, error } = await supabase
      .from('support_evaluations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as SupportEvaluation[];
  },

  // System ratings
  async createSystemRating(data: {
    tenant_id: string;
    user_id: string;
    category: string;
    rating: number;
    feedback?: string;
  }): Promise<SystemRating> {
    const { data: result, error } = await supabase
      .from('support_system_ratings')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result as unknown as SystemRating;
  },

  async listSystemRatings(): Promise<SystemRating[]> {
    const { data, error } = await supabase
      .from('support_system_ratings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as SystemRating[];
  },
};
