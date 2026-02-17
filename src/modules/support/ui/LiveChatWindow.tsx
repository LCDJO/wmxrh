import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatService } from '@/domains/support/chat-service';
import ChatHeader from './chat/ChatHeader';
import MessageTimeline from './chat/MessageTimeline';
import QuickReplyBox from './chat/QuickReplyBox';
import type { ChatSession, ChatMessage, ChatSenderType } from '@/domains/support/types';

export interface ChatIdentity {
  name: string;
  role: string;
  company?: string;
  tenantId?: string;
}

interface LiveChatWindowProps {
  ticketId: string;
  tenantId: string;
  userId: string;
  senderType: ChatSenderType;
  assignedAgentId?: string | null;
  ticketSubject?: string;
  onBack?: () => void;
  embedded?: boolean;
}

export default function LiveChatWindow({
  ticketId,
  tenantId,
  userId,
  senderType,
  assignedAgentId,
  ticketSubject,
  onBack,
  embedded = false,
}: LiveChatWindowProps) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [counterpartIdentity, setCounterpartIdentity] = useState<ChatIdentity | null>(null);
  const [senderIdentities, setSenderIdentities] = useState<Record<string, ChatIdentity>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch identity information for header & bubbles
  useEffect(() => {
    async function fetchIdentities() {
      try {
        if (senderType === 'tenant') {
          // Client view: fetch agent info
          if (assignedAgentId) {
            const { data: agent } = await supabase
              .from('platform_users')
              .select('display_name, role')
              .eq('user_id', assignedAgentId)
              .maybeSingle();
            if (agent) {
              setCounterpartIdentity({
                name: agent.display_name ?? 'Agente',
                role: agent.role ?? 'Suporte',
              });
              setSenderIdentities(prev => ({
                ...prev,
                [assignedAgentId]: {
                  name: agent.display_name ?? 'Agente',
                  role: agent.role ?? 'Suporte',
                },
              }));
            }
          }
        } else {
          // Agent view: fetch tenant user info (ticket creator)
          const { data: ticket } = await supabase
            .from('support_tickets')
            .select('created_by')
            .eq('id', ticketId)
            .maybeSingle();

          if (ticket?.created_by) {
            const [empRes, tenantRes] = await Promise.all([
              supabase
                .from('employees')
                .select('name, company_id, position_id')
                .eq('user_id', ticket.created_by)
                .eq('tenant_id', tenantId)
                .maybeSingle(),
              supabase
                .from('tenants')
                .select('name')
                .eq('id', tenantId)
                .maybeSingle(),
            ]);

            let positionTitle: string | null = null;
            if (empRes.data?.position_id) {
              const { data: pos } = await supabase
                .from('positions')
                .select('title')
                .eq('id', empRes.data.position_id)
                .maybeSingle();
              positionTitle = pos?.title ?? null;
            }

            const identity: ChatIdentity = {
              name: empRes.data?.name ?? 'Cliente',
              role: positionTitle ?? 'Colaborador',
              company: tenantRes.data?.name ?? undefined,
              tenantId: tenantId.slice(0, 8),
            };
            setCounterpartIdentity(identity);
            setSenderIdentities(prev => ({
              ...prev,
              [ticket.created_by]: identity,
            }));
          }
        }
      } catch {
        // silent — identity is supplementary
      }
    }
    fetchIdentities();
  }, [senderType, assignedAgentId, ticketId, tenantId]);

  // Initialize session
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setLoading(true);
        const s = await ChatService.getOrCreateSession({
          ticket_id: ticketId,
          tenant_id: tenantId,
          assigned_agent_id: assignedAgentId ?? undefined,
        });
        if (!cancelled) {
          setSession(s);
          const msgs = await ChatService.getMessages(s.id);
          setMessages(msgs);
        }
      } catch {
        toast.error('Erro ao iniciar chat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [ticketId, tenantId, assignedAgentId]);

  // Realtime subscription
  useEffect(() => {
    if (!session) return;
    setConnected(true);
    const unsubscribe = ChatService.subscribeToSession(session.id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => {
      setConnected(false);
      unsubscribe();
    };
  }, [session]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark unread as read
  useEffect(() => {
    if (!session || !messages.length) return;
    const unread = messages.filter((m) => m.sender_type !== senderType && !m.read_at);
    if (unread.length > 0) {
      ChatService.markAsRead(unread.map((m) => m.id)).catch(() => {});
    }
  }, [messages, session, senderType]);

  // Send handler
  const handleSend = async (
    text: string,
    attachments?: Array<{ name: string; url: string; type: string }>,
  ) => {
    if (!session) return;
    await ChatService.sendMessage(
      {
        session_id: session.id,
        sender_type: senderType,
        message_text: text,
        attachments: attachments as unknown[],
      },
      userId,
    );
  };

  // Close chat handler
  const handleCloseChat = async () => {
    if (!session) return;
    try {
      await ChatService.updateSessionStatus(session.id, 'closed');
      setSession({ ...session, status: 'closed', ended_at: new Date().toISOString() });
      toast.success('Atendimento encerrado');
    } catch {
      toast.error('Erro ao encerrar atendimento');
    }
  };

  const isClosed = session?.status === 'closed';

  return (
    <div className={`flex flex-col ${embedded ? 'h-full' : 'h-[600px] max-h-[80vh] border border-border rounded-xl shadow-lg'} overflow-hidden bg-background`}>
      <ChatHeader
        session={session}
        senderType={senderType}
        connected={connected}
        ticketSubject={ticketSubject}
        ticketId={ticketId}
        onBack={onBack}
        onClose={handleCloseChat}
        counterpartIdentity={counterpartIdentity}
      />

      <MessageTimeline
        ref={scrollRef}
        messages={messages}
        senderType={senderType}
        loading={loading}
        senderIdentities={senderIdentities}
      />

      <QuickReplyBox
        onSend={handleSend}
        disabled={!session}
        isClosed={isClosed}
        sessionId={session?.id}
        userId={userId}
      />
    </div>
  );
}
