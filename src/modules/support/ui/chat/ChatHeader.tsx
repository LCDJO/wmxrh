import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Wifi, WifiOff, X, Building2, IdCard } from 'lucide-react';
import type { ChatSession, ChatSenderType } from '@/domains/support/types';
import type { ChatIdentity } from '../LiveChatWindow';

interface ChatHeaderProps {
  session: ChatSession | null;
  senderType: ChatSenderType;
  connected: boolean;
  ticketSubject?: string;
  ticketId: string;
  onBack?: () => void;
  onClose?: () => void;
  counterpartIdentity?: ChatIdentity | null;
  isTyping?: boolean;
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 inline-block w-3 h-3 rounded-full border-2 border-primary"
      style={{ backgroundColor: online ? 'hsl(145 60% 42%)' : 'hsl(0 0% 60%)' }}
    />
  );
}

export default function ChatHeader({
  session,
  senderType,
  connected,
  ticketSubject,
  ticketId,
  onBack,
  onClose,
  counterpartIdentity,
  isTyping,
}: ChatHeaderProps) {
  const isClosed = session?.status === 'closed';

  const headerName = counterpartIdentity?.name
    ?? (senderType === 'agent' ? 'Cliente' : 'Suporte');
  const headerRole = counterpartIdentity?.role
    ?? (senderType === 'agent' ? 'Colaborador' : 'Agente de Suporte');

  // Status text below name
  const statusText = isTyping
    ? 'digitando...'
    : connected
      ? 'online'
      : 'offline';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-primary-foreground hover:bg-primary-foreground/10 -ml-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}

      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <span className="text-sm font-bold">{headerName[0]?.toUpperCase()}</span>
        </div>
        <PresenceDot online={connected} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{headerName}</p>
        <p className={`text-[10px] truncate ${isTyping ? 'text-green-300 italic' : 'opacity-80'}`}>
          {isTyping ? statusText : headerRole}
        </p>

        {/* Contextual info line */}
        <div className="flex items-center gap-2 mt-0.5">
          {senderType === 'agent' && counterpartIdentity?.company && (
            <span className="text-[10px] opacity-60 flex items-center gap-0.5 truncate">
              <Building2 className="h-2.5 w-2.5" />
              {counterpartIdentity.company}
            </span>
          )}
          {senderType === 'agent' && counterpartIdentity?.tenantId && (
            <span className="text-[10px] opacity-50 flex items-center gap-0.5">
              <IdCard className="h-2.5 w-2.5" />
              {counterpartIdentity.tenantId}
            </span>
          )}

          {senderType === 'tenant' && (
            <span className="text-[10px] opacity-60 truncate">
              {session?.protocol_number
                ? `Protocolo: ${session.protocol_number}`
                : ticketSubject ?? `Ticket #${ticketId.slice(0, 8)}`}
            </span>
          )}

          {senderType === 'agent' && !counterpartIdentity?.company && (
            <span className="text-[10px] opacity-60 truncate">
              {session?.protocol_number
                ? `Protocolo: ${session.protocol_number}`
                : ticketSubject ?? `Ticket #${ticketId.slice(0, 8)}`}
            </span>
          )}

          {/* Online/offline indicator text */}
          {!isTyping && (
            <span className={`text-[9px] ml-auto ${connected ? 'opacity-70' : 'opacity-40'}`}>
              {connected ? '● online' : '○ offline'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
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
        {onClose && !isClosed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
            title="Encerrar atendimento"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
