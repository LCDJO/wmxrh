import { supabase } from '@/integrations/supabase/client';
import type { ChatSession, ChatMessage, CreateChatSessionDTO, SendChatMessageDTO } from './types';

export const ChatService = {
  async getOrCreateSession(dto: CreateChatSessionDTO): Promise<ChatSession> {
    // Try to find existing active session for this ticket
    const { data: existing } = await supabase
      .from('support_chat_sessions')
      .select('*')
      .eq('ticket_id', dto.ticket_id)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing as unknown as ChatSession;

    const { data, error } = await supabase
      .from('support_chat_sessions')
      .insert({
        ticket_id: dto.ticket_id,
        tenant_id: dto.tenant_id,
        assigned_agent_id: dto.assigned_agent_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ChatSession;
  },

  async getSessionsByTicket(ticketId: string): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('support_chat_sessions')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ChatSession[];
  },

  async updateSessionStatus(sessionId: string, status: 'active' | 'paused' | 'closed'): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === 'closed') updates.ended_at = new Date().toISOString();
    const { error } = await supabase
      .from('support_chat_sessions')
      .update(updates)
      .eq('id', sessionId);
    if (error) throw error;
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('support_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as ChatMessage[];
  },

  async sendMessage(dto: SendChatMessageDTO, senderId: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('support_chat_messages')
      .insert({
        session_id: dto.session_id,
        sender_type: dto.sender_type,
        sender_id: senderId,
        message_text: dto.message_text,
        attachments: (dto.attachments ?? []) as unknown as import('@/integrations/supabase/types').Json,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ChatMessage;
  },

  async markAsRead(messageIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('support_chat_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds);
    if (error) throw error;
  },

  /** Subscribe to realtime messages for a session */
  subscribeToSession(sessionId: string, onMessage: (msg: ChatMessage) => void) {
    const channel = supabase
      .channel(`chat-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => onMessage(payload.new as unknown as ChatMessage)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
};
