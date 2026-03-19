import { useState } from 'react';
import {
  Brain, TrendingUp, Users, BarChart3, Download,
  Sparkles, ArrowUpRight, ArrowDownRight, Minus, Loader2,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSalaryIntelligence } from '@/hooks/core/use-salary-intelligence';
import { useExportReport } from '@/hooks/core/use-export-report';
import { useTenant } from '@/contexts/TenantContext';

export default function StrategicIntelligencePage() {
  const { currentTenant } = useTenant();
  const {
    loading, prediction, adjustments, benchmark, stats,
    runPrediction, runAdjustments, runBenchmark,
  } = useSalaryIntelligence();
  const { exportCSV } = useExportReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Preparação Estratégica
        </h1>
        <p className="text-muted-foreground mt-1">
          IA preditiva, sugestões de ajuste, benchmark e exportação — {currentTenant?.name}
        </p>
      </div>

      <Tabs defaultValue="predict" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="predict" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Previsão</TabsTrigger>
          <TabsTrigger value="adjustments" className="gap-1.5"><Sparkles className="h-4 w-4" /> Ajustes</TabsTrigger>
          <TabsTrigger value="benchmark" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Benchmark</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><Download className="h-4 w-4" /> Exportar</TabsTrigger>
        </TabsList>

        {/* ── Previsão Salarial ── */}
        <TabsContent value="predict" className="space-y-6">
          <div className="bg-card rounded-xl shadow-card p-6 border-t-4 border-t-primary/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold font-display text-card-foreground">IA Preditiva Salarial</h2>
                <p className="text-xs text-muted-foreground">Projeções baseadas em tendências históricas e contexto CLT</p>
              </div>
              <Button onClick={runPrediction} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
                Gerar Previsão
              </Button>
            </div>

            {prediction ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-secondary/50 p-4 text-center">
                    <p className="text-2xl font-bold font-display text-card-foreground">
                      R$ {(prediction.projected_avg_6m / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-muted-foreground">Média projetada (6m)</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-4 text-center">
                    <RiskBadge level={prediction.risk_level} />
                    <p className="text-xs text-muted-foreground mt-1">Nível de risco</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-4 text-center">
                    <p className="text-2xl font-bold font-display text-card-foreground">
                      {prediction.recommendations.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Recomendações</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border bg-secondary/20">
                  <p className="text-sm text-card-foreground leading-relaxed">{prediction.trend_summary}</p>
                </div>

                {prediction.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-card-foreground">Recomendações</h3>
                    {prediction.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-card">
                        <PriorityDot priority={r.priority} />
                        <div>
                          <p className="text-sm text-card-foreground">{r.description}</p>
                          {r.estimated_impact && (
                            <p className="text-xs text-muted-foreground mt-0.5">Impacto: {r.estimated_impact}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState text="Clique em 'Gerar Previsão' para análise preditiva com IA." />
            )}
          </div>
        </TabsContent>

        {/* ── Sugestões de Ajuste ── */}
        <TabsContent value="adjustments" className="space-y-6">
          <div className="bg-card rounded-xl shadow-card p-6 border-t-4 border-t-warning/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold font-display text-card-foreground">Sugestão de Ajustes</h2>
                <p className="text-xs text-muted-foreground">Reajustes automáticos baseados em defasagem, convenção e inflação</p>
              </div>
              <Button onClick={runAdjustments} disabled={loading} size="sm" variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Gerar Sugestões
              </Button>
            </div>

            {adjustments ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-border bg-secondary/20">
                  <p className="text-sm text-card-foreground">{adjustments.summary}</p>
                  {adjustments.total_estimated_cost != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Custo estimado total: <span className="font-semibold text-card-foreground">R$ {adjustments.total_estimated_cost.toLocaleString('pt-BR')}</span>
                    </p>
                  )}
                </div>

                {adjustments.suggestions.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Colaborador</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Atual</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Sugerido</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">%</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Prioridade</th>
                          <th className="py-2 font-medium text-muted-foreground">Justificativa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjustments.suggestions.map((s, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 pr-3 font-medium text-card-foreground">{s.employee_name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">R$ {s.current_salary.toLocaleString('pt-BR')}</td>
                            <td className="py-2 pr-3 text-card-foreground font-medium">R$ {s.suggested_salary.toLocaleString('pt-BR')}</td>
                            <td className="py-2 pr-3">
                              <span className={`text-xs font-semibold ${s.percentage > 0 ? 'text-primary' : 'text-destructive'}`}>
                                {s.percentage > 0 ? '+' : ''}{s.percentage.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 pr-3"><PriorityBadge priority={s.priority} /></td>
                            <td className="py-2 text-xs text-muted-foreground max-w-xs">{s.justification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState text="Clique em 'Gerar Sugestões' para análise automática de reajustes." />
            )}
          </div>
        </TabsContent>

        {/* ── Benchmark ── */}
        <TabsContent value="benchmark" className="space-y-6">
          <div className="bg-card rounded-xl shadow-card p-6 border-t-4 border-t-info/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold font-display text-card-foreground">Benchmark entre Empresas</h2>
                <p className="text-xs text-muted-foreground">Comparativo de métricas salariais entre unidades do tenant</p>
              </div>
              <Button onClick={runBenchmark} disabled={loading} size="sm" variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BarChart3 className="h-4 w-4 mr-1" />}
                Gerar Benchmark
              </Button>
            </div>

            {benchmark ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-border bg-secondary/20">
                  <p className="text-sm text-card-foreground">{benchmark.summary}</p>
                </div>

                {benchmark.rankings.length > 0 && (
                  <div className="space-y-3">
                    {benchmark.rankings.map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent shrink-0">
                          <span className="text-sm font-bold text-accent-foreground">#{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-card-foreground">{r.company_name}</p>
                          <p className="text-xs text-muted-foreground">{r.observation}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-card-foreground">R$ {r.avg_salary.toLocaleString('pt-BR')}</p>
                          <div className="flex items-center gap-1 justify-end">
                            <CompetitivenessBar score={r.competitiveness_score} />
                            <span className="text-xs text-muted-foreground">{r.competitiveness_score}/100</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {benchmark.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-card-foreground">Recomendações</h3>
                    {benchmark.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm text-card-foreground">{r}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState text="Clique em 'Gerar Benchmark' para comparar empresas do tenant." />
            )}
          </div>
        </TabsContent>

        {/* ── Exportação ── */}
        <TabsContent value="export" className="space-y-6">
          <div className="bg-card rounded-xl shadow-card p-6 border-t-4 border-t-primary/60">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <Download className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold font-display text-card-foreground">Exportação de Relatórios</h2>
                <p className="text-xs text-muted-foreground">Exporte dados estratégicos em CSV</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ExportCard
                title="Previsão Salarial"
                description="Tendências e recomendações da IA"
                disabled={!prediction}
                onExport={() => {
                  if (!prediction) return;
                  const rows = prediction.recommendations.map(r => ({
                    Descrição: r.description,
                    Prioridade: r.priority,
                    Impacto: r.estimated_impact || '',
                  }));
                  exportCSV(rows, 'previsao_salarial');
                }}
              />
              <ExportCard
                title="Sugestões de Ajuste"
                description="Lista de reajustes sugeridos por colaborador"
                disabled={!adjustments}
                onExport={() => {
                  if (!adjustments) return;
                  const rows = adjustments.suggestions.map(s => ({
                    Colaborador: s.employee_name,
                    'Salário Atual': s.current_salary,
                    'Salário Sugerido': s.suggested_salary,
                    'Percentual (%)': s.percentage,
                    Prioridade: s.priority,
                    Justificativa: s.justification,
                  }));
                  exportCSV(rows, 'sugestoes_ajuste');
                }}
              />
              <ExportCard
                title="Benchmark Empresas"
                description="Ranking e competitividade entre unidades"
                disabled={!benchmark}
                onExport={() => {
                  if (!benchmark) return;
                  const rows = benchmark.rankings.map((r, i) => ({
                    Posição: i + 1,
                    Empresa: r.company_name,
                    'Salário Médio': r.avg_salary,
                    'Score Competitividade': r.competitiveness_score,
                    Observação: r.observation,
                  }));
                  exportCSV(rows, 'benchmark_empresas');
                }}
              />
              <ExportCard
                title="Estatísticas Gerais"
                description="Dados resumidos por empresa"
                disabled={!stats}
                onExport={() => {
                  if (!stats) return;
                  const rows = stats.companies.map(c => ({
                    Empresa: c.company_name,
                    Colaboradores: c.employee_count,
                    'Salário Médio': c.avg_salary,
                    'Custo Total': c.total_cost,
                  }));
                  exportCSV(rows, 'estatisticas_gerais');
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Small Components ──

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Brain className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const config = {
    low: { label: 'Baixo', icon: CheckCircle2, className: 'text-primary' },
    medium: { label: 'Médio', icon: AlertTriangle, className: 'text-warning' },
    high: { label: 'Alto', icon: AlertTriangle, className: 'text-destructive' },
  }[level] || { label: level, icon: Minus, className: 'text-muted-foreground' };

  const Icon = config.icon;
  return (
    <div className={`flex items-center justify-center gap-1 ${config.className}`}>
      <Icon className="h-5 w-5" />
      <span className="text-lg font-bold font-display">{config.label}</span>
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color = {
    critical: 'bg-destructive',
    high: 'bg-destructive',
    medium: 'bg-warning',
    low: 'bg-primary',
  }[priority] || 'bg-muted-foreground';
  return <span className={`inline-block h-2 w-2 rounded-full mt-1.5 shrink-0 ${color}`} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = {
    critical: 'bg-destructive/10 text-destructive border-destructive/30',
    high: 'bg-destructive/10 text-destructive border-destructive/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    low: 'bg-accent text-accent-foreground border-border',
  }[priority] || 'bg-secondary text-muted-foreground border-border';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${config}`}>
      {priority}
    </span>
  );
}

function CompetitivenessBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-primary' : score >= 40 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function ExportCard({ title, description, disabled, onExport }: {
  title: string; description: string; disabled: boolean; onExport: () => void;
}) {
  return (
    <div className={`p-4 rounded-lg border ${disabled ? 'border-border/50 opacity-60' : 'border-border hover:border-primary/30'} transition-colors`}>
      <h3 className="font-semibold text-sm text-card-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">{description}</p>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onExport}>
        <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
      </Button>
    </div>
  );
}
