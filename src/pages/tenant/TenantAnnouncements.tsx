/**
 * TenantAnnouncements — Dedicated tenant-facing page for platform announcements.
 * Route: /announcements
 * Filters by alert_type: billing | fiscal | system | security
 */

import { useState, useMemo } from 'react';
import { useAnnouncements } from '@/hooks/core/use-announcements';
import {
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  BLOCKING_LEVEL_CONFIG,
  type TenantAnnouncement,
  type AlertType,
} from '@/domains/announcements/announcement-hub';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Megaphone, CreditCard, FileText, Settings, ShieldAlert,
  X, ArrowRight, ExternalLink, Clock, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ICON_MAP: Record<string, React.ElementType> = {
  CreditCard, FileText, Settings, ShieldAlert,
};

const FILTER_TABS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'Todos', icon: Megaphone },
  { key: 'billing', label: 'Faturamento', icon: CreditCard },
  { key: 'fiscal', label: 'Fiscal', icon: FileText },
  { key: 'system', label: 'Sistema', icon: Settings },
  { key: 'security', label: 'Segurança', icon: ShieldAlert },
];

function AnnouncementCard({
  announcement: a,
  onDismiss,
}: {
  announcement: TenantAnnouncement;
  onDismiss: (id: string) => void;
}) {
  const type = ALERT_TYPE_CONFIG[a.alert_type];
  const sev = SEVERITY_CONFIG[a.severity];
  const block = BLOCKING_LEVEL_CONFIG[a.blocking_level];
  const Icon = ICON_MAP[type.icon] ?? Megaphone;

  return (
    <Card className={cn(
      'overflow-hidden transition-all border-l-4 hover:shadow-md',
      a.severity === 'critical' ? 'border-l-destructive' :
      a.severity === 'warning' ? 'border-l-warning' :
      'border-l-primary',
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
            type.bgColor, type.color,
          )}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
              <Badge variant="outline" className={cn('text-[10px]', type.color)}>
                {type.label}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', sev.color)}>
                {sev.label}
              </Badge>
              {a.blocking_level !== 'none' && (
                <Badge variant="destructive" className="text-[10px]">
                  {block.label}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {a.message}
            </p>

            <div className="flex items-center gap-4 mt-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(a.start_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                {a.end_at && (
                  <> — {format(new Date(a.end_at), "dd/MM/yyyy", { locale: ptBR })}</>
                )}
              </span>

              {a.action_url && (
                <Button
                  variant="link"
                  size="sm"
                  className={cn('h-auto p-0 text-xs gap-1', type.color)}
                  onClick={() => {
                    if (a.action_url!.startsWith('http')) {
                      window.open(a.action_url!, '_blank');
                    } else {
                      window.location.href = a.action_url!;
                    }
                  }}
                >
                  Ver mais <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Dismiss */}
          {a.is_dismissible && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onDismiss(a.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantAnnouncements() {
  const { announcements, dismiss, loading } = useAnnouncements();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return announcements;
    return announcements.filter(a => a.alert_type === activeFilter);
  }, [announcements, activeFilter]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = { all: announcements.length };
    for (const a of announcements) {
      counts[a.alert_type] = (counts[a.alert_type] ?? 0) + 1;
    }
    return counts;
  }, [announcements]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Comunicados da Plataforma
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avisos institucionais, alertas de faturamento, fiscais e de segurança
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {FILTER_TABS.map(tab => {
          const count = countByType[tab.key] ?? 0;
          const isActive = activeFilter === tab.key;
          const TabIcon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 text-xs gap-1.5 transition-all',
                isActive && 'shadow-sm',
              )}
              onClick={() => setActiveFilter(tab.key)}
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

      <Separator />

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando comunicados...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {activeFilter === 'all'
              ? 'Nenhum comunicado no momento'
              : `Nenhum comunicado de ${FILTER_TABS.find(t => t.key === activeFilter)?.label ?? activeFilter}`}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Novos avisos aparecerão automaticamente aqui
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <AnnouncementCard key={a.id} announcement={a} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
