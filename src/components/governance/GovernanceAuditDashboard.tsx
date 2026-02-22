/**
 * GovernanceAuditDashboard — Visual audit of the UGE graph.
 *
 * Features:
 * - Capture new audit snapshots
 * - View historical snapshots with comparison
 * - AI-powered change analysis
 * - Risk signal summary cards
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye, Camera, GitCompare, AlertTriangle, Shield,
  TrendingUp, TrendingDown, Minus, Loader2, Users, Key, Network,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  captureAuditSnapshot,
  fetchAuditSnapshots,
  compareSnapshots,
} from '@/domains/governance';
import type { AuditSnapshot, AuditComparisonResult } from '@/domains/governance';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  tenantId: string;
  className?: string;
}

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export function GovernanceAuditDashboard({ tenantId, className }: Props) {
  const queryClient = useQueryClient();
  const [comparison, setComparison] = useState<AuditComparisonResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['audit-snapshots', tenantId],
    queryFn: () => fetchAuditSnapshots(tenantId),
  });

  const captureMutation = useMutation({
    mutationFn: () => captureAuditSnapshot(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-snapshots', tenantId] });
      toast.success('Snapshot de auditoria capturado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const latest = snapshots?.[0];
  const previous = snapshots?.[1];

  const handleCompare = () => {
    if (latest && previous) {
      const result = compareSnapshots(previous, latest);
      setComparison(result);
    }
  };

  const handleAIAnalysis = async () => {
    if (!comparison) return;
    setAnalyzingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('governance-ai', {
        body: {
          action: 'analyze_audit',
          tenant_id: tenantId,
          audit_data: comparison,
        },
      });
      if (error) throw error;
      setAiAnalysis(data?.analysis);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na análise AI.');
    } finally {
      setAnalyzingAI(false);
    }
  };

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Auditoria Visual Global</h2>
        </div>
        <div className="flex gap-2">
          {latest && previous && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCompare}>
              <GitCompare className="h-3.5 w-3.5" />
              Comparar
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => captureMutation.mutate()}
            disabled={captureMutation.isPending}
          >
            {captureMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Capturar Snapshot
          </Button>
        </div>
      </div>

      {/* Current State Cards */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Network className="h-4 w-4" />} label="Nós" value={latest.node_count} />
          <StatCard icon={<Key className="h-4 w-4" />} label="Permissões" value={latest.permission_count} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Usuários" value={latest.user_count} />
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Risco</p>
                <Badge variant="outline" className={`text-xs ${RISK_COLORS[latest.risk_level]}`}>
                  {latest.risk_level.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk Signals */}
      {latest && latest.risk_signals.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Sinais de Risco ({latest.risk_signals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-48">
              <div className="space-y-1.5">
                {latest.risk_signals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/20">
                    <Badge variant="outline" className={`text-[8px] px-1 shrink-0 ${RISK_COLORS[signal.level]}`}>
                      {signal.level}
                    </Badge>
                    <div>
                      <span className="font-medium">{signal.title}</span>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{signal.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Comparison */}
      {comparison && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <GitCompare className="h-4 w-4 text-primary" />
                Comparação de Snapshots
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleAIAnalysis}
                disabled={analyzingAI}
              >
                {analyzingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : '🤖'}
                Análise AI
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <DeltaChip label="Nós" delta={comparison.deltas.node_count} />
              <DeltaChip label="Permissões" delta={comparison.deltas.permission_count} />
              <DeltaChip label="Usuários" delta={comparison.deltas.user_count} />
            </div>

            {comparison.deltas.new_anomalies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-400 mb-1">Novas Anomalias:</p>
                {comparison.deltas.new_anomalies.map((a, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">• {a.title}</p>
                ))}
              </div>
            )}

            {comparison.deltas.resolved_anomalies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-400 mb-1">Anomalias Resolvidas:</p>
                {comparison.deltas.resolved_anomalies.map((a, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">• {a.title}</p>
                ))}
              </div>
            )}

            {/* AI Analysis */}
            {aiAnalysis && (
              <div className="border-t border-border/30 pt-2 space-y-2">
                <p className="text-xs font-medium">🤖 Análise AI:</p>
                <p className="text-[11px] text-muted-foreground">{aiAnalysis.summary}</p>
                {aiAnalysis.significant_changes?.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px]">
                    <Badge variant="outline" className={`text-[8px] px-1 ${RISK_COLORS[c.severity] ?? ''}`}>
                      {c.severity}
                    </Badge>
                    <span>{c.description}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {snapshots && snapshots.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico ({snapshots.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-40">
              <div className="space-y-1">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/20">
                    <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString('pt-BR')}</span>
                    <div className="flex items-center gap-2">
                      <span>{s.node_count} nós</span>
                      <Badge variant="outline" className={`text-[8px] px-1 ${RISK_COLORS[s.risk_level]}`}>
                        {s.risk_level}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3 flex items-center gap-2">
        {icon}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaChip({ label, delta }: { label: string; delta: number }) {
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color = delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-green-400' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-1 text-xs">
      <Icon className={`h-3 w-3 ${color}`} />
      <span className="text-muted-foreground">{label}:</span>
      <span className={color}>{delta > 0 ? '+' : ''}{delta}</span>
    </div>
  );
}
