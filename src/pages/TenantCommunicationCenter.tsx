/**
 * TenantCommunicationCenter — Unified page for tenant communication.
 *
 * Tabs:
 *   1. Comunicados   — Platform announcements with filter by alert_type
 *   2. Notificações  — User notifications summary
 *   3. Restrições    — Active feature restrictions from announcements
 *
 * Integrations:
 *   - NotificationHub (via useNotifications)
 *   - FeatureFlagEngine (via restriction-bridge)
 *   - Realtime updates (via useAnnouncements)
 */

import { useState, useMemo } from 'react';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useNotifications } from '@/hooks/use-notifications';
import {
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  BLOCKING_LEVEL_CONFIG,
  type TenantAnnouncement,
  type AlertType,
} from '@/domains/announcements/announcement-hub';
import { getRestrictedFeatures } from '@/domains/announcements/restriction-bridge';
import { TYPE_CONFIG, type AppNotification } from '@/domains/notifications/notification-hub';
import { SystemAlertCard } from '@/components/announcements/SystemAlertCard';
import { SystemNoticeBadge } from '@/components/announcements/SystemNoticeBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Megaphone, CreditCard, FileText, Settings, ShieldAlert,
  Bell, Lock, CheckCircle, AlertTriangle, Info,
  TrendingUp, Shield, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ══════════════════════════════════════════════════════════════
// Filter tabs config
// ══════════════════════════════════════════════════════════════

const ALERT_FILTERS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'Todos', icon: Megaphone },
  { key: 'billing', label: 'Faturamento', icon: CreditCard },
  { key: 'fiscal', label: 'Fiscal', icon: FileText },
  { key: 'system', label: 'Sistema', icon: Settings },
  { key: 'security', label: 'Segurança', icon: ShieldAlert },
];

const NOTIF_TYPE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
};

// ══════════════════════════════════════════════════════════════
// Summary Cards — Top-level KPIs
// ══════════════════════════════════════════════════════════════

function SummaryCards({
  announcements,
  unreadNotifications,
  restrictedCount,
}: {
  announcements: TenantAnnouncement[];
  unreadNotifications: number;
  restrictedCount: number;
}) {
  const critical = announcements.filter(a => a.severity === 'critical').length;
  const warnings = announcements.filter(a => a.severity === 'warning').length;

  const cards = [
    {
      label: 'Comunicados Ativos',
      value: announcements.length,
      icon: Megaphone,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Alertas Críticos',
      value: critical,
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Notificações Pendentes',
      value: unreadNotifications,
      icon: Bell,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Recursos Restritos',
      value: restrictedCount,
      icon: Lock,
      color: restrictedCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      bg: restrictedCount > 0 ? 'bg-destructive/10' : 'bg-muted/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', c.bg)}>
                <c.icon className={cn('h-5 w-5', c.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{c.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{c.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab: Comunicados
// ══════════════════════════════════════════════════════════════

function AnnouncementsTab({
  announcements,
  dismiss,
  loading,
}: {
  announcements: TenantAnnouncement[];
  dismiss: (id: string) => void;
  loading: boolean;
}) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return announcements;
    return announcements.filter(a => a.alert_type === filter);
  }, [announcements, filter]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = { all: announcements.length };
    for (const a of announcements) {
      counts[a.alert_type] = (counts[a.alert_type] ?? 0) + 1;
    }
    return counts;
  }, [announcements]);

  return (
    <div className="space-y-4">
      {/* Sub-filters */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {ALERT_FILTERS.map(tab => {
          const count = countByType[tab.key] ?? 0;
          const isActive = filter === tab.key;
          const TabIcon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-8 text-xs gap-1.5', isActive && 'shadow-sm')}
              onClick={() => setFilter(tab.key)}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className="text-[9px] h-4 min-w-[16px] px-1"
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Carregando comunicados...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum comunicado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Novos avisos aparecerão automaticamente aqui
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <SystemAlertCard key={a.id} announcement={a} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab: Notificações (resumo integrado com NotificationHub)
// ══════════════════════════════════════════════════════════════

function NotificationsTab({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const unread = notifications.filter(n => !n.is_read);
  const recent = notifications.slice(0, 20);

  const byType = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    for (const n of unread) {
      const key = n.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    }
    return groups;
  }, [unread]);

  return (
    <div className="space-y-4">
      {/* Unread summary by type */}
      {unread.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Object.entries(byType).map(([type, items]) => {
              const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
              const Icon = NOTIF_TYPE_ICONS[type] ?? Info;
              return (
                <Badge
                  key={type}
                  variant="outline"
                  className={cn('text-xs gap-1', cfg?.color)}
                >
                  <Icon className="h-3 w-3" />
                  {items.length} {cfg?.label ?? type}
                </Badge>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onMarkAllRead}>
            <CheckCircle className="h-3 w-3 mr-1" />
            Marcar todas como lidas
          </Button>
        </div>
      )}

      {/* Notification list */}
      {recent.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma notificação</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2">
            {recent.map(n => {
              const cfg = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG];
              const Icon = NOTIF_TYPE_ICONS[n.type] ?? Info;
              return (
                <Card
                  key={n.id}
                  className={cn(
                    'transition-all cursor-pointer hover:shadow-sm',
                    !n.is_read && 'border-l-4 border-l-primary bg-primary/[0.02]',
                  )}
                  onClick={() => onMarkRead(n.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
                        cfg?.bgColor ?? 'bg-muted',
                      )}>
                        <Icon className={cn('h-4 w-4', cfg?.color ?? 'text-muted-foreground')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-xs truncate', !n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {n.description}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-1">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(n.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab: Restrições (integração com FeatureFlagEngine)
// ══════════════════════════════════════════════════════════════

function RestrictionsTab({
  announcements,
}: {
  announcements: TenantAnnouncement[];
}) {
  const restricted = announcements.filter(a => a.blocking_level === 'restricted_access');
  const restrictedFeatures = getRestrictedFeatures(announcements);

  if (restricted.length === 0) {
    return (
      <div className="text-center py-16">
        <Shield className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">Nenhuma restrição ativa</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Todos os módulos estão operando normalmente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Restricted features */}
      <Card className="border-destructive/30 bg-destructive/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <Lock className="h-4 w-4" />
            Módulos com acesso restrito
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {restrictedFeatures.map(feature => (
              <Badge key={feature} variant="destructive" className="text-xs gap-1">
                <Lock className="h-3 w-3" />
                {feature.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Estes módulos foram desabilitados automaticamente pelo FeatureFlagEngine
            com base nos avisos ativos abaixo.
          </p>
        </CardContent>
      </Card>

      {/* Source announcements */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Avisos causando restrição
        </p>
        {restricted.map(a => (
          <SystemAlertCard key={a.id} announcement={a} />
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

export default function TenantCommunicationCenter() {
  const { announcements, dismiss, loading } = useAnnouncements();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
  } = useNotifications();

  const restrictedFeatures = getRestrictedFeatures(announcements);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Central de Comunicação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comunicados, notificações e status de restrições da plataforma
        </p>
      </div>

      {/* Summary KPIs */}
      <SummaryCards
        announcements={announcements}
        unreadNotifications={unreadCount}
        restrictedCount={restrictedFeatures.length}
      />

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="announcements" className="space-y-4">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="announcements" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" />
            Comunicados
            <SystemNoticeBadge variant="dot" />
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" />
            Notificações
            {unreadCount > 0 && (
              <Badge variant="default" className="text-[9px] h-4 min-w-[16px] px-1">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="restrictions" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" />
            Restrições
            {restrictedFeatures.length > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 min-w-[16px] px-1">
                {restrictedFeatures.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements">
          <AnnouncementsTab
            announcements={announcements}
            dismiss={dismiss}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        </TabsContent>

        <TabsContent value="restrictions">
          <RestrictionsTab announcements={announcements} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
