/**
 * TenantInfoSidebar — Full client identification panel for agent view.
 * Shows: user name, company, role, active plan, recent activity, previous tickets.
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  User, Building2, Briefcase, CreditCard, Clock, MessageSquare,
  Loader2, Package, Layers, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TenantInfoSidebarProps {
  tenantId: string;
  createdBy: string; // ticket creator user_id
  currentTicketId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'hsl(210 65% 50%)',
  awaiting_agent: 'hsl(35 80% 50%)',
  awaiting_customer: 'hsl(280 60% 55%)',
  in_progress: 'hsl(200 70% 50%)',
  resolved: 'hsl(145 60% 42%)',
  closed: 'hsl(0 0% 50%)',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  awaiting_agent: 'Aguardando',
  awaiting_customer: 'Resp. pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  trial: 'Trial',
};

interface ClientInfo {
  userName: string;
  userEmail: string | null;
  tenantName: string;
  memberRole: string;
  plan: string;
  planStatus: string;
  mrr: number | null;
  seatsUsed: number | null;
  seatsIncluded: number | null;
  modules: string[];
  ticketStats: { total: number; open: number; resolved: number };
  recentTickets: Array<{
    id: string;
    subject: string;
    status: string;
    created_at: string;
  }>;
}

export default function TenantInfoSidebar({ tenantId, createdBy, currentTicketId }: TenantInfoSidebarProps) {
  const [info, setInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [
          membershipRes,
          tenantRes,
          subRes,
          modulesRes,
          ticketsRes,
        ] = await Promise.all([
          supabase
            .from('tenant_memberships')
            .select('name, email, role')
            .eq('tenant_id', tenantId)
            .eq('user_id', createdBy)
            .maybeSingle(),
          supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
          supabase.from('tenant_subscriptions').select('plan, status, mrr, seats_used, seats_included').eq('tenant_id', tenantId).maybeSingle(),
          supabase.from('tenant_modules').select('module_key').eq('tenant_id', tenantId).eq('is_active', true),
          supabase
            .from('support_tickets')
            .select('id, subject, status, created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

        const tickets = ticketsRes.data ?? [];

        setInfo({
          userName: membershipRes.data?.name ?? 'Usuário',
          userEmail: membershipRes.data?.email ?? null,
          tenantName: tenantRes.data?.name ?? 'Desconhecido',
          memberRole: membershipRes.data?.role ?? '—',
          plan: (subRes.data?.plan as string) ?? 'Sem plano',
          planStatus: (subRes.data?.status as string) ?? '—',
          mrr: subRes.data?.mrr != null ? Number(subRes.data.mrr) : null,
          seatsUsed: subRes.data?.seats_used != null ? Number(subRes.data.seats_used) : null,
          seatsIncluded: subRes.data?.seats_included != null ? Number(subRes.data.seats_included) : null,
          modules: (modulesRes.data ?? []).map(m => m.module_key),
          ticketStats: {
            total: tickets.length,
            open: tickets.filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status)).length,
            resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
          },
          recentTickets: tickets.slice(0, 10),
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId, createdBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!info) return null;

  const ROLE_LABELS: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    superadmin: 'Super Admin',
    tenant_admin: 'Admin Tenant',
    member: 'Membro',
    viewer: 'Visualizador',
    rh: 'RH',
    gestor: 'Gestor',
    financeiro: 'Financeiro',
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* ── User Identity ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{info.userName}</p>
              {info.userEmail && (
                <p className="text-[10px] text-muted-foreground truncate">{info.userEmail}</p>
              )}
            </div>
          </div>

          {/* Company */}
          <InfoRow icon={Building2} label="Empresa" value={info.tenantName} />

          {/* Role */}
          <InfoRow icon={Briefcase} label="Cargo" value={ROLE_LABELS[info.memberRole] ?? info.memberRole} />
        </div>

        <Separator />

        {/* ── Subscription / Plan ── */}
        <div className="space-y-2">
          <SectionLabel icon={CreditCard} label="Plano Ativo" />
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {PLAN_LABELS[info.plan] ?? info.plan}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] capitalize',
                info.planStatus === 'active' && 'border-[hsl(145_60%_42%/0.4)] text-[hsl(145_60%_42%)]',
                info.planStatus === 'trial' && 'border-[hsl(35_80%_50%/0.4)] text-[hsl(35_80%_50%)]',
                info.planStatus === 'churned' && 'border-destructive/40 text-destructive',
              )}
            >
              {info.planStatus}
            </Badge>
          </div>
          {info.mrr != null && info.mrr > 0 && (
            <p className="text-[10px] text-muted-foreground">
              MRR: <span className="font-medium text-foreground">R$ {info.mrr.toFixed(2)}</span>
            </p>
          )}
          {info.seatsUsed != null && info.seatsIncluded != null && (
            <p className="text-[10px] text-muted-foreground">
              Assentos: <span className="font-medium text-foreground">{info.seatsUsed}/{info.seatsIncluded}</span>
            </p>
          )}
        </div>

        {/* Modules */}
        {info.modules.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <SectionLabel icon={Layers} label="Módulos Ativos" />
              <div className="flex flex-wrap gap-1">
                {info.modules.map(m => (
                  <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* ── Ticket Stats ── */}
        <div className="space-y-2">
          <SectionLabel icon={MessageSquare} label="Histórico de Tickets" />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total', value: info.ticketStats.total, color: 'hsl(210 65% 50%)' },
              { label: 'Abertos', value: info.ticketStats.open, color: 'hsl(35 80% 50%)' },
              { label: 'Resolv.', value: info.ticketStats.resolved, color: 'hsl(145 60% 42%)' },
            ].map(s => (
              <div key={s.label} className="text-center py-1.5 bg-muted/50 rounded-md">
                <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Recent Tickets ── */}
        <div className="space-y-2">
          <SectionLabel icon={Clock} label="Tickets Anteriores" />
          {info.recentTickets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum ticket anterior.</p>
          ) : (
            <div className="space-y-1.5">
              {info.recentTickets.map(ticket => {
                const isCurrent = ticket.id === currentTicketId;
                const statusColor = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open;
                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      'p-2 rounded-md border text-xs',
                      isCurrent
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card hover:bg-muted/30 transition-colors'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={cn('font-medium truncate flex-1', isCurrent && 'text-primary')}>
                        {ticket.subject}
                        {isCurrent && <span className="text-[9px] ml-1 opacity-60">(atual)</span>}
                      </p>
                      <span
                        className="h-2 w-2 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                      <span>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
                      <span>·</span>
                      <span style={{ color: statusColor }}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Helpers ──

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: typeof User; label: string }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
      <Icon className="h-3 w-3" /> {label}
    </p>
  );
}
