import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage, ChatSession } from './types';

export interface TranscriptExport {
  session: ChatSession;
  messages: ChatMessage[];
  ticketSubject: string;
  tenantName: string;
  exportedAt: string;
}

export const ChatTranscriptArchive = {
  /** Get full transcript for a session */
  async getTranscript(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const [sessionRes, messagesRes] = await Promise.all([
      supabase
        .from('support_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single(),
      supabase
        .from('support_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
    ]);

    if (sessionRes.error) throw sessionRes.error;

    return {
      session: sessionRes.data as unknown as ChatSession,
      messages: (messagesRes.data ?? []) as unknown as ChatMessage[],
    };
  },

  /** Get all transcripts for a ticket */
  async getTicketTranscripts(ticketId: string): Promise<Array<{ session: ChatSession; messageCount: number }>> {
    const { data: sessions, error } = await supabase
      .from('support_chat_sessions')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const results: Array<{ session: ChatSession; messageCount: number }> = [];
    for (const s of (sessions ?? [])) {
      const { count } = await supabase
        .from('support_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', s.id);
      results.push({
        session: s as unknown as ChatSession,
        messageCount: count ?? 0,
      });
    }
    return results;
  },

  /** Export transcript as plain text */
  async exportAsText(sessionId: string): Promise<string> {
    const { session, messages } = await this.getTranscript(sessionId);

    // Fetch ticket info
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('subject')
      .eq('id', session.ticket_id)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', session.tenant_id)
      .maybeSingle();

    const lines: string[] = [
      '═══════════════════════════════════════════',
      '       TRANSCRIÇÃO DE ATENDIMENTO          ',
      '═══════════════════════════════════════════',
      '',
      `Protocolo: ${session.protocol_number}`,
      `Ticket: ${ticket?.subject ?? session.ticket_id}`,
      `Empresa: ${tenant?.name ?? session.tenant_id}`,
      `Início: ${new Date(session.started_at).toLocaleString('pt-BR')}`,
      `Encerramento: ${session.ended_at ? new Date(session.ended_at).toLocaleString('pt-BR') : 'Em andamento'}`,
      `Status: ${session.status}`,
      `Total de mensagens: ${messages.length}`,
      '',
      '───────────────────────────────────────────',
      '',
    ];

    for (const msg of messages) {
      const time = new Date(msg.created_at).toLocaleString('pt-BR');
      const sender = msg.sender_type === 'agent' ? '🔵 SUPORTE' : msg.sender_type === 'system' ? '⚙️ SISTEMA' : '🟢 CLIENTE';
      lines.push(`[${time}] ${sender}:`);
      lines.push(msg.message_text);

      const attachments = (msg.attachments ?? []) as Array<{ name?: string; url?: string }>;
      if (attachments.length > 0) {
        for (const att of attachments) {
          lines.push(`  📎 ${att.name ?? 'Anexo'}: ${att.url ?? ''}`);
        }
      }
      lines.push('');
    }

    lines.push('───────────────────────────────────────────');
    lines.push(`Exportado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push('Este documento é imutável e faz parte do registro oficial.');

    return lines.join('\n');
  },

  /** Export transcript as JSON */
  async exportAsJSON(sessionId: string): Promise<string> {
    const { session, messages } = await this.getTranscript(sessionId);

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('subject')
      .eq('id', session.ticket_id)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', session.tenant_id)
      .maybeSingle();

    const exportData: TranscriptExport = {
      session,
      messages,
      ticketSubject: ticket?.subject ?? '',
      tenantName: tenant?.name ?? '',
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  },

  /** Download helper */
  downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
