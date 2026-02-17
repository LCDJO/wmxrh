import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, X, Building2, IdCard, Download, FileText, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { ChatTranscriptArchive } from '@/domains/support/chat-transcript-archive';
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

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0 shadow-sm">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-primary-foreground hover:bg-primary-foreground/10 -ml-2 h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}

      {/* Avatar with presence */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center ring-2 ring-primary-foreground/10">
          <span className="text-sm font-bold">{headerName[0]?.toUpperCase()}</span>
        </div>
        <span
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-primary transition-colors duration-300"
          style={{ backgroundColor: connected ? 'hsl(145 60% 50%)' : 'hsl(0 0% 55%)' }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{headerName}</p>
          {session && (
            <Badge
              variant="secondary"
              className="text-[8px] px-1.5 py-0 shrink-0"
              style={{
                backgroundColor: isClosed ? 'hsla(0,0%,100%,0.1)' : 'hsla(145,60%,50%,0.2)',
                color: isClosed ? 'hsla(0,0%,100%,0.5)' : 'hsl(145 60% 80%)',
              }}
            >
              {isClosed ? 'Encerrado' : 'Ao Vivo'}
            </Badge>
          )}
        </div>

        {/* Status line */}
        <p className={`text-[11px] truncate transition-all duration-200 ${isTyping ? 'text-green-300' : 'opacity-70'}`}>
          {isTyping ? (
            <span className="italic">digitando...</span>
          ) : (
            <>
              {headerRole}
              {senderType === 'agent' && counterpartIdentity?.company && (
                <span className="opacity-60 ml-1.5 inline-flex items-center gap-0.5">
                  <Building2 className="h-2.5 w-2.5 inline" />
                  {counterpartIdentity.company}
                </span>
              )}
            </>
          )}
        </p>

        {/* Protocol / tenant info */}
        <div className="flex items-center gap-2 mt-0.5">
          {senderType === 'agent' && counterpartIdentity?.tenantId && (
            <span className="text-[9px] opacity-40 flex items-center gap-0.5">
              <IdCard className="h-2.5 w-2.5" />
              {counterpartIdentity.tenantId}
            </span>
          )}
          {session?.protocol_number && (
            <span className="text-[9px] opacity-50">
              {session.protocol_number}
            </span>
          )}
          {!session?.protocol_number && ticketSubject && (
            <span className="text-[9px] opacity-50 truncate">{ticketSubject}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
                title="Exportar histórico"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const text = await ChatTranscriptArchive.exportAsText(session.id);
                    ChatTranscriptArchive.downloadFile(text, `transcript-${session.protocol_number}.txt`, 'text/plain');
                    toast.success('Transcrição exportada');
                  } catch { toast.error('Erro ao exportar'); }
                }}
                className="gap-2"
              >
                <FileText className="h-4 w-4" /> Exportar TXT
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const json = await ChatTranscriptArchive.exportAsJSON(session.id);
                    ChatTranscriptArchive.downloadFile(json, `transcript-${session.protocol_number}.json`, 'application/json');
                    toast.success('Transcrição exportada');
                  } catch { toast.error('Erro ao exportar'); }
                }}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" /> Exportar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onClose && !isClosed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-primary-foreground hover:bg-red-500/20 h-8 w-8"
            title="Encerrar atendimento"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
