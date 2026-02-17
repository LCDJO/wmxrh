import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Loader2, CheckCheck, Check, Wifi, WifiOff,
  Phone, Paperclip, Smile, MoreVertical, ArrowLeft,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatService } from '@/domains/support/chat-service';
import type { ChatSession, ChatMessage, ChatSenderType } from '@/domains/support/types';

interface LiveChatWindowProps {
  ticketId: string;
  tenantId: string;
  userId: string;
  senderType: ChatSenderType; // 'tenant' | 'agent'
  assignedAgentId?: string | null;
  ticketSubject?: string;
  onBack?: () => void;
}

// ── Chat Bubble ──

function ChatBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const time = new Date(message.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
          {message.message_text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-card border border-border text-foreground rounded-bl-md'
        }`}
      >
        {!isOwn && (
          <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'hsl(200 70% 50%)' }}>
            {message.sender_type === 'agent' ? 'Suporte' : 'Cliente'}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.message_text}</p>
        <div className={`flex items-center justify-end gap-1 mt-0.5 ${isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
          <span className="text-[10px]">{time}</span>
          {isOwn && (
            message.read_at
              ? <CheckCheck className="h-3 w-3" style={{ color: 'hsl(200 70% 60%)' }} />
              : <Check className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Date Separator ──

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground bg-background px-2 font-medium">{date}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Typing Indicator ──

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-1">
      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Presence Dot ──

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full border-2 border-background"
      style={{ backgroundColor: online ? 'hsl(145 60% 42%)' : 'hsl(0 0% 60%)' }}
    />
  );
}

// ── Main LiveChatWindow ──

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
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === msg.id)) return prev;
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

  // Mark unread messages as read
  useEffect(() => {
    if (!session || !messages.length) return;
    const unread = messages.filter(
      m => m.sender_type !== senderType && !m.read_at
    );
    if (unread.length > 0) {
      ChatService.markAsRead(unread.map(m => m.id)).catch(() => {});
    }
  }, [messages, session, senderType]);

  const handleSend = async () => {
    if (!input.trim() || !session) return;
    const text = input.trim();
    setInput('');
    try {
      setSending(true);
      await ChatService.sendMessage(
        { session_id: session.id, sender_type: senderType, message_text: text },
        userId,
      );
    } catch {
      toast.error('Erro ao enviar mensagem');
      setInput(text); // restore
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce<Array<{ date: string; msgs: ChatMessage[] }>>((acc, msg) => {
    const d = new Date(msg.created_at).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    const last = acc[acc.length - 1];
    if (last && last.date === d) {
      last.msgs.push(msg);
    } else {
      acc.push({ date: d, msgs: [msg] });
    }
    return acc;
  }, []);

  const isClosed = session?.status === 'closed';
  const headerLabel = senderType === 'agent' ? 'Cliente' : 'Suporte';

  return (
    <div className="flex flex-col h-[600px] max-h-[80vh] border border-border rounded-xl overflow-hidden bg-background shadow-lg">
      {/* Header — WhatsApp style */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary-foreground/10 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <span className="text-sm font-bold">{headerLabel[0]}</span>
          </div>
          <PresenceDot online={connected} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{headerLabel}</p>
          <p className="text-[10px] opacity-70 truncate">
            {ticketSubject ?? `Ticket #${ticketId.slice(0, 8)}`}
            {session?.protocol_number && ` · ${session.protocol_number}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {connected ? (
            <Wifi className="h-4 w-4 opacity-70" />
          ) : (
            <WifiOff className="h-4 w-4 opacity-50" />
          )}
          {session && (
            <Badge
              variant="secondary"
              className="text-[9px] ml-1"
              style={{
                backgroundColor: isClosed ? 'hsla(0,0%,50%,0.2)' : 'hsla(145,60%,42%,0.2)',
                color: isClosed ? 'hsl(0 0% 70%)' : 'hsl(145 60% 70%)',
              }}
            >
              {isClosed ? 'Encerrado' : 'Ao Vivo'}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages area — subtle pattern BG */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--muted)) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Send className="h-7 w-7 opacity-30" />
            </div>
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-[11px] mt-1">Envie a primeira mensagem para iniciar a conversa</p>
          </div>
        ) : (
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              <DateSeparator date={group.date} />
              {group.msgs.map(msg => (
                <ChatBubble key={msg.id} message={msg} isOwn={msg.sender_type === senderType} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Input bar */}
      {isClosed ? (
        <div className="px-4 py-3 bg-muted/50 text-center border-t border-border">
          <p className="text-xs text-muted-foreground">Esta conversa foi encerrada</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-card border-t border-border shrink-0">
          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0 h-9 w-9">
            <Smile className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0 h-9 w-9">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            ref={inputRef}
            placeholder="Digite uma mensagem..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="rounded-full h-9 w-9 shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
