import { forwardRef, useEffect, useRef } from 'react';
import { CheckCheck, Check, Send, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import type { ChatMessage, ChatSenderType } from '@/domains/support/types';
import type { ChatIdentity } from '../LiveChatWindow';

// ── Chat Bubble ──

function ChatBubble({
  message,
  isOwn,
  senderIdentity,
  showSender,
}: {
  message: ChatMessage;
  isOwn: boolean;
  senderIdentity?: ChatIdentity;
  showSender: boolean;
}) {
  const time = new Date(message.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[11px] text-muted-foreground bg-muted/60 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm">
          {message.message_text}
        </span>
      </div>
    );
  }

  const attachments = (message.attachments ?? []) as Array<{ name?: string; url?: string; type?: string }>;
  const senderLabel = senderIdentity?.name
    ?? (message.sender_type === 'agent' ? 'Suporte' : 'Cliente');

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showSender ? 'mt-3' : 'mt-0.5'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      {/* Avatar for received messages */}
      {!isOwn && showSender && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 mt-auto mb-1 shrink-0">
          <span className="text-[10px] font-bold text-primary">
            {senderLabel[0]?.toUpperCase()}
          </span>
        </div>
      )}
      {!isOwn && !showSender && <div className="w-7 mr-2 shrink-0" />}

      <div
        className={`relative max-w-[70%] px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
            : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-sm'
        }`}
      >
        {/* Sender name on first message in group */}
        {!isOwn && showSender && (
          <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'hsl(200 70% 50%)' }}>
            {senderLabel}
            {senderIdentity?.role && (
              <span className="font-normal opacity-60 ml-1">· {senderIdentity.role}</span>
            )}
          </p>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-1 mb-1.5">
            {attachments.map((att, i) => {
              const isImage = att.type?.startsWith('image/');
              if (isImage && att.url) {
                return (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={att.url}
                      alt={att.name ?? 'Imagem'}
                      className="max-w-[240px] rounded-lg border border-border/20"
                      loading="lazy"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-[11px] underline ${
                    isOwn ? 'text-primary-foreground/80' : 'text-primary'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  {att.name ?? 'Anexo'}
                </a>
              );
            })}
          </div>
        )}

        <p className="whitespace-pre-wrap break-words">{message.message_text}</p>

        {/* Timestamp + read receipt */}
        <div
          className={`flex items-center justify-end gap-1 mt-0.5 -mb-0.5 ${
            isOwn ? 'text-primary-foreground/40' : 'text-muted-foreground/60'
          }`}
        >
          <span className="text-[10px]">{time}</span>
          {isOwn &&
            (message.read_at ? (
              <CheckCheck className="h-3 w-3" style={{ color: 'hsl(200 70% 60%)' }} />
            ) : (
              <Check className="h-3 w-3" />
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Date Separator ──

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center my-4">
      <span className="text-[10px] text-muted-foreground bg-muted/70 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm font-medium uppercase tracking-wide">
        {date}
      </span>
    </div>
  );
}

// ── Typing Indicator ──

function TypingIndicator() {
  return (
    <div className="flex justify-start mt-2 animate-in fade-in duration-300">
      <div className="w-7 mr-2 shrink-0" />
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-[3px]">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="w-[7px] h-[7px] rounded-full bg-muted-foreground/40 animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Timeline Props ──

interface MessageTimelineProps {
  messages: ChatMessage[];
  senderType: ChatSenderType;
  loading: boolean;
  senderIdentities?: Record<string, ChatIdentity>;
  isCounterpartTyping?: boolean;
}

const MessageTimeline = forwardRef<HTMLDivElement, MessageTimelineProps>(
  ({ messages, senderType, loading, senderIdentities = {}, isCounterpartTyping = false }, ref) => {
    // Group messages by date
    const groupedMessages = messages.reduce<Array<{ date: string; msgs: ChatMessage[] }>>(
      (acc, msg) => {
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
      },
      [],
    );

    // Determine if a message should show sender name (first in a consecutive group)
    const shouldShowSender = (msgs: ChatMessage[], index: number): boolean => {
      if (index === 0) return true;
      const prev = msgs[index - 1];
      const curr = msgs[index];
      if (prev.sender_type !== curr.sender_type) return true;
      if (prev.sender_id !== curr.sender_id) return true;
      // Show sender if gap > 2 minutes
      const gap = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
      return gap > 120_000;
    };

    return (
      <div
        ref={ref}
        className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='30' cy='30' r='0.8' fill='hsl(var(--muted-foreground))' opacity='0.07'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill='url(%23p)' width='60' height='60'/%3E%3C/svg%3E")`,
        }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-4">
              <Send className="h-8 w-8 opacity-20" />
            </div>
            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
            <p className="text-[11px] mt-1 opacity-60">Envie a primeira mensagem para iniciar a conversa</p>
          </div>
        ) : (
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              <DateSeparator date={group.date} />
              {group.msgs.map((msg, mi) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_type === senderType}
                  senderIdentity={msg.sender_id ? senderIdentities[msg.sender_id] : undefined}
                  showSender={shouldShowSender(group.msgs, mi)}
                />
              ))}
            </div>
          ))
        )}

        {isCounterpartTyping && <TypingIndicator />}
      </div>
    );
  },
);

MessageTimeline.displayName = 'MessageTimeline';
export default MessageTimeline;
