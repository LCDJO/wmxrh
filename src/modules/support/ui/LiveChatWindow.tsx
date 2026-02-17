import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ChatService } from '@/domains/support/chat-service';
import ChatHeader from './chat/ChatHeader';
import MessageTimeline from './chat/MessageTimeline';
import QuickReplyBox from './chat/QuickReplyBox';
import type { ChatSession, ChatMessage, ChatSenderType } from '@/domains/support/types';

interface LiveChatWindowProps {
  ticketId: string;
  tenantId: string;
  userId: string;
  senderType: ChatSenderType;
  assignedAgentId?: string | null;
  ticketSubject?: string;
  onBack?: () => void;
}

export default function LiveChatWindow({
  ticketId,
  tenantId,
  userId,
  senderType,
  assignedAgentId,
  ticketSubject,
  onBack,
}: LiveChatWindowProps) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-[600px] max-h-[80vh] border border-border rounded-xl overflow-hidden bg-background shadow-lg">
      <ChatHeader
        session={session}
        senderType={senderType}
        connected={connected}
        ticketSubject={ticketSubject}
        ticketId={ticketId}
        onBack={onBack}
        onClose={handleCloseChat}
      />

      <MessageTimeline
        ref={scrollRef}
        messages={messages}
        senderType={senderType}
        loading={loading}
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
