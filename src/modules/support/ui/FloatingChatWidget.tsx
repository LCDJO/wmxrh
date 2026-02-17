import { useState, useCallback } from 'react';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { TicketService } from '@/domains/support/ticket-service';
import LiveChatWindow from './LiveChatWindow';

/**
 * FloatingChatWidget — Intercom-style floating chat bubble for tenant users.
 * Auto-creates a support ticket and opens LiveChatWindow in a floating panel.
 */
export default function FloatingChatWidget() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleOpen = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }

    if (!user || !currentTenant) {
      toast.error('Faça login para acessar o suporte.');
      return;
    }

    // If we already have a ticket, just reopen
    if (ticketId) {
      setOpen(true);
      return;
    }

    // Create a quick-chat ticket automatically
    try {
      setCreating(true);
      setOpen(true);
      const ticket = await TicketService.create({
        tenant_id: currentTenant.id,
        subject: 'Chat Rápido',
        description: 'Atendimento iniciado via chat rápido.',
        category: 'general',
        priority: 'medium',
      }, user.id);
      setTicketId(ticket.id);
    } catch {
      toast.error('Erro ao iniciar chat');
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }, [open, user, currentTenant, ticketId]);

  // Don't render for non-tenant users
  if (!user || !currentTenant) return null;

  return (
    <>
      {/* Floating panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[380px] h-[520px] rounded-2xl shadow-2xl border border-border bg-background overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Chat ao Vivo</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOpen(false); setTicketId(null); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            {creating || !ticketId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground">Iniciando atendimento...</p>
                </div>
              </div>
            ) : (
              <LiveChatWindow
                ticketId={ticketId}
                tenantId={currentTenant.id}
                userId={user.id}
                senderType="tenant"
                ticketSubject="Chat Rápido"
                embedded
              />
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center"
        aria-label="Abrir chat de suporte"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
