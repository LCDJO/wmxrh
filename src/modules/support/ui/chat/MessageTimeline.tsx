import { forwardRef } from 'react';
import { CheckCheck, Check, Send, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import type { ChatMessage, ChatSenderType } from '@/domains/support/types';
import type { ChatIdentity } from '../LiveChatWindow';

// ── Chat Bubble ──

function ChatBubble({
  message,
  isOwn,
  senderIdentity,
}: {
  message: ChatMessage;
  isOwn: boolean;
  senderIdentity?: ChatIdentity;
}) {
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

  const attachments = (message.attachments ?? []) as Array<{ name?: string; url?: string; type?: string }>;

  // Determine sender label
  const senderLabel = senderIdentity?.name
    ?? (message.sender_type === 'agent' ? 'Suporte' : 'Cliente');

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
          <div className="mb-0.5">
            <p className="text-[10px] font-semibold" style={{ color: 'hsl(200 70% 50%)' }}>
              {senderLabel}
            </p>
            {senderIdentity?.role && (
              <p className="text-[9px] opacity-60">{senderIdentity.role}</p>
            )}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-1 mb-1">
            {attachments.map((att, i) => {
              const isImage = att.type?.startsWith('image/');
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
                  {isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  {att.name ?? 'Anexo'}
                </a>
              );
            })}
          </div>
        )}

        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.message_text}</p>
        <div
          className={`flex items-center justify-end gap-1 mt-0.5 ${
            isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground'
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
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground bg-background px-2 font-medium">{date}</span>
      <div className="flex-1 h-px bg-border" />
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

    return (
      <div
        ref={ref}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(var(--muted)) 1px, transparent 0)',
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
              {group.msgs.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_type === senderType}
                  senderIdentity={msg.sender_id ? senderIdentities[msg.sender_id] : undefined}
                />
              ))}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isCounterpartTyping && (
          <div className="flex justify-start mb-1">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

MessageTimeline.displayName = 'MessageTimeline';
export default MessageTimeline;
