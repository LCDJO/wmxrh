/**
 * EventDetailPanel — Slide-in panel with full event details, driver history,
 * behavioral score, and quick actions.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  X, MapPin, Gauge, AlertTriangle, FileWarning, BookOpen,
  ShieldAlert, ClipboardList, User, TrendingDown, Clock,
  Navigation, Zap, Camera, History, Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──
export interface EventDetail {
  id: string;
  type: string;
  plate: string;
  driver: string;
  vehicleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  lat: number;
  lng: number;
  speed?: number;
  limit?: number;
  heading?: number;
}

interface DriverHistory {
  totalEvents: number;
  overspeedCount: number;
  harshBrakeCount: number;
  warningsIssued: number;
  lastWarningDate: Date | null;
  trainingsCompleted: number;
  activeBlocks: number;
}

interface EventDetailPanelProps {
  event: EventDetail | null;
  onClose: () => void;
  onAction?: (action: string, event: EventDetail) => void;
}

// ── Mock behavioral score & history ──
function mockBehavioralScore(driver: string): number {
  let hash = 0;
  for (let i = 0; i < driver.length; i++) hash = ((hash << 5) - hash + driver.charCodeAt(i)) | 0;
  return Math.max(20, Math.min(95, 50 + (hash % 45)));
}

function mockDriverHistory(driver: string): DriverHistory {
  const seed = driver.length * 7;
  return {
    totalEvents: 5 + (seed % 30),
    overspeedCount: 2 + (seed % 8),
    harshBrakeCount: 1 + (seed % 5),
    warningsIssued: seed % 4,
    lastWarningDate: seed % 3 === 0 ? new Date(Date.now() - (seed % 30) * 86400000) : null,
    trainingsCompleted: 1 + (seed % 3),
    activeBlocks: seed % 5 === 0 ? 1 : 0,
  };
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Crítico' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Alto' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Médio' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Baixo' },
};

const TYPE_LABELS: Record<string, string> = {
  overspeed: 'Excesso de Velocidade',
  harsh_brake: 'Frenagem Brusca',
  route_deviation: 'Desvio de Rota',
  geofence: 'Violação de Geofence',
  idle_excess: 'Ociosidade Excessiva',
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500';
  const bgColor = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 70 ? 'Bom' : score >= 40 ? 'Regular' : 'Crítico';

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 shrink-0">
        <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.5" fill="none"
            className={cn('transition-all duration-700', color.replace('text-', 'stroke-'))}
            strokeWidth="3"
            strokeDasharray={`${(score / 100) * 97.4} 97.4`}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold", color)}>
          {score}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Score Comportamental</p>
        <Badge variant="outline" className={cn("text-[10px] mt-0.5", bgColor.replace('bg-', 'border-') + '/30', color)}>
          {label}
        </Badge>
      </div>
    </div>
  );
}

export function EventDetailPanel({ event, onClose, onAction }: EventDetailPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!event) return null;

  const severity = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.low;
  const score = mockBehavioralScore(event.driver);
  const history = mockDriverHistory(event.driver);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    // Simulate async action
    await new Promise(r => setTimeout(r, 800));
    onAction?.(action, event);
    setActionLoading(null);
  };

  const mockEvidences = [
    { type: 'GPS', desc: `Coordenada registrada: ${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}` },
    ...(event.speed ? [{ type: 'Velocímetro', desc: `${event.speed} km/h (limite: ${event.limit ?? 80} km/h)` }] : []),
    { type: 'Timestamp', desc: event.timestamp.toLocaleString('pt-BR') },
    { type: 'Dispositivo', desc: `Tracker #${event.vehicleId}` },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className={cn("px-5 py-4 border-b border-border", severity.bg)}>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className={cn("text-xs gap-1", severity.text, `border-current`)}>
            <AlertTriangle className="h-3 w-3" />
            {severity.label}
          </Badge>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-bold text-foreground">{TYPE_LABELS[event.type] ?? event.type}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{event.message}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Location & Speed */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Coordenadas</p>
                <p className="text-xs font-mono font-semibold text-foreground">{event.lat.toFixed(5)}</p>
                <p className="text-xs font-mono font-semibold text-foreground">{event.lng.toFixed(5)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-3 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Velocidade</p>
                <p className={cn("text-xl font-bold", event.speed && event.speed > (event.limit ?? 80) ? 'text-destructive' : 'text-foreground')}>
                  {event.speed ?? '—'}<span className="text-xs ml-0.5">km/h</span>
                </p>
                {event.limit && <p className="text-[10px] text-muted-foreground">Limite: {event.limit} km/h</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Infraction Type */}
        <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border">
          <Zap className={cn("h-5 w-5 shrink-0", severity.text)} />
          <div>
            <p className="text-xs text-muted-foreground">Tipo de Infração</p>
            <p className="text-sm font-semibold text-foreground">{TYPE_LABELS[event.type] ?? event.type}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Horário</p>
            <p className="text-xs font-medium text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Evidences */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Evidências
          </h3>
          <div className="space-y-1.5">
            {mockEvidences.map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="secondary" className="text-[9px] shrink-0 mt-0.5">{ev.type}</Badge>
                <span className="text-muted-foreground">{ev.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Driver Info & Score */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Colaborador
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{event.driver}</p>
              <p className="text-xs text-muted-foreground">{event.plate}</p>
            </div>
          </div>
          <ScoreGauge score={score} />
        </div>

        <Separator />

        {/* Driver History */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Total de Eventos', value: history.totalEvents, icon: Zap },
              { label: 'Excessos Velocidade', value: history.overspeedCount, icon: Gauge },
              { label: 'Freadas Bruscas', value: history.harshBrakeCount, icon: TrendingDown },
              { label: 'Advertências', value: history.warningsIssued, icon: FileWarning },
              { label: 'Treinamentos', value: history.trainingsCompleted, icon: BookOpen },
              { label: 'Bloqueios Ativos', value: history.activeBlocks, icon: Ban },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{item.value}</p>
                  <p className="text-[9px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
          {history.lastWarningDate && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Última advertência: {history.lastWarningDate.toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-border p-4 space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações Rápidas</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'warning', label: 'Emitir Advertência', icon: FileWarning, variant: 'destructive' as const },
            { key: 'task', label: 'Criar Tarefa', icon: ClipboardList, variant: 'outline' as const },
            { key: 'training', label: 'Solicitar Treinamento', icon: BookOpen, variant: 'outline' as const },
            { key: 'block', label: 'Bloquear Operação', icon: ShieldAlert, variant: 'destructive' as const },
          ].map(action => (
            <Button
              key={action.key}
              variant={action.variant}
              size="sm"
              className="gap-1.5 text-xs h-9"
              disabled={actionLoading !== null}
              onClick={() => handleAction(action.key)}
            >
              {actionLoading === action.key ? (
                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <action.icon className="h-3.5 w-3.5" />
              )}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
