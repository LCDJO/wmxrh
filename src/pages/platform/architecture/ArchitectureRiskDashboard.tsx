/**
 * Architecture Risk Dashboard — Visual risk analysis for platform architecture
 */
import { useMemo, useState } from 'react';
import { createArchitectureRiskAnalyzer } from '@/domains/architecture-risk';
import type { ModuleRiskProfile, RiskLevel, CircularDependencyCycle, RefactorSuggestion, CouplingMetrics, DependencyRiskScore } from '@/domains/architecture-risk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle, Shield, GitBranch, RotateCcw, Zap, Target,
  TrendingUp, Lightbulb, Activity, Server, Briefcase, ArrowRight,
} from 'lucide-react';

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  none: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const RISK_BAR_COLORS: Record<RiskLevel, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
  none: 'bg-emerald-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function ArchitectureRiskDashboard() {
  const analyzer = useMemo(() => createArchitectureRiskAnalyzer(), []);
  const summary = useMemo(() => analyzer.analyze(), [analyzer]);
  const profiles = useMemo(() => analyzer.getAllProfiles(), [analyzer]);
  const couplingMetrics = useMemo(() => analyzer.getCouplingMetrics(), [analyzer]);
  const cycles = useMemo(() => analyzer.getCircularDependencies(), [analyzer]);
  const depScores = useMemo(() => analyzer.getDependencyRiskScores(), [analyzer]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const selectedProfile = selectedModule ? profiles.find(p => p.module_key === selectedModule) : null;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <RiskKPI
          icon={<Shield className="h-4 w-4" />}
          label="Score Geral"
          value={summary.overall_score}
          suffix="/100"
          level={summary.overall_level}
        />
        <RiskKPI
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Em Risco"
          value={summary.modules_at_risk}
          suffix={`/${summary.total_modules}`}
          level={summary.modules_at_risk > 0 ? 'high' : 'none'}
        />
        <RiskKPI
          icon={<Zap className="h-4 w-4 text-red-400" />}
          label="Críticos"
          value={summary.critical_count}
          level={summary.critical_count > 0 ? 'critical' : 'none'}
        />
        <RiskKPI
          icon={<TrendingUp className="h-4 w-4 text-orange-400" />}
          label="Alto Risco"
          value={summary.high_count}
          level={summary.high_count > 0 ? 'high' : 'none'}
        />
        <RiskKPI
          icon={<RotateCcw className="h-4 w-4 text-amber-400" />}
          label="Ciclos"
          value={cycles.length}
          level={cycles.length > 0 ? 'critical' : 'none'}
        />
        <RiskKPI
          icon={<Lightbulb className="h-4 w-4 text-primary" />}
          label="Sugestões"
          value={summary.suggestions.length}
          level="none"
        />
      </div>

      <Tabs defaultValue="dependency-risk" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dependency-risk" className="gap-1.5"><GitBranch className="h-3.5 w-3.5" />Dependency Risk</TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5"><Target className="h-3.5 w-3.5" />Risk Ranking</TabsTrigger>
          <TabsTrigger value="coupling" className="gap-1.5"><GitBranch className="h-3.5 w-3.5" />Coupling</TabsTrigger>
          <TabsTrigger value="cycles" className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" />Ciclos</TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5"><Lightbulb className="h-3.5 w-3.5" />Refactoring</TabsTrigger>
        </TabsList>

        {/* ── Dependency Risk Scanner ── */}
        <TabsContent value="dependency-risk">
          <DependencyRiskView scores={depScores} />
        </TabsContent>

        {/* ── Risk Ranking ── */}
        <TabsContent value="ranking">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-7 space-y-2">
              {profiles.map(p => (
                <RiskRow
                  key={p.module_key}
                  profile={p}
                  selected={selectedModule === p.module_key}
                  onClick={() => setSelectedModule(prev => prev === p.module_key ? null : p.module_key)}
                />
              ))}
            </div>
            <div className="col-span-5">
              {selectedProfile ? (
                <ModuleRiskDetail profile={selectedProfile} />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Target className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Selecione um módulo para ver detalhes do risco</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Coupling Analysis ── */}
        <TabsContent value="coupling">
          <CouplingTable metrics={couplingMetrics} profiles={profiles} />
        </TabsContent>

        {/* ── Circular Dependencies ── */}
        <TabsContent value="cycles">
          <CircularDependenciesView cycles={cycles} profiles={profiles} />
        </TabsContent>

        {/* ── Refactor Suggestions ── */}
        <TabsContent value="suggestions">
          <SuggestionsView suggestions={summary.suggestions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function RiskKPI({ icon, label, value, suffix, level }: {
  icon: React.ReactNode; label: string; value: number; suffix?: string; level: RiskLevel;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
        <Badge variant="outline" className={`text-[10px] mt-1 ${RISK_COLORS[level]}`}>{level}</Badge>
      </CardContent>
    </Card>
  );
}

function RiskRow({ profile, selected, onClick }: {
  profile: ModuleRiskProfile; selected: boolean; onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
        selected ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/30 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-[180px]">
        {profile.domain === 'saas'
          ? <Server className="h-3.5 w-3.5 text-blue-400" />
          : <Briefcase className="h-3.5 w-3.5 text-emerald-400" />}
        <span className="text-sm font-medium text-foreground truncate">{profile.module_label}</span>
      </div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${RISK_BAR_COLORS[profile.risk_level]}`}
            style={{ width: `${profile.risk_score}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground w-8 text-right">{profile.risk_score}</span>
      </div>

      <Badge variant="outline" className={`text-[10px] min-w-[60px] justify-center ${RISK_COLORS[profile.risk_level]}`}>
        {profile.risk_level}
      </Badge>

      {profile.suggestions.length > 0 && (
        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
      )}
    </div>
  );
}

function ModuleRiskDetail({ profile }: { profile: ModuleRiskProfile }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {profile.module_label}
          <Badge variant="outline" className={`text-[10px] ml-auto ${RISK_COLORS[profile.risk_level]}`}>
            Score: {profile.risk_score}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Breakdown bars */}
        <div className="space-y-2">
          <RiskBar label="Dependência" value={profile.dependency_risk} />
          <RiskBar label="Acoplamento" value={profile.coupling_risk} />
          <RiskBar label="Circular" value={profile.circular_risk} />
          <RiskBar label="Criticidade" value={profile.criticality_score} />
          <RiskBar label="Blast Radius" value={Math.min(100, profile.change_impact_radius * 12)} />
        </div>

        <Separator />

        {/* Risk Factors */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fatores de Risco</p>
          {profile.factors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum fator de risco identificado ✓</p>
          ) : (
            profile.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={`text-[9px] shrink-0 ${RISK_COLORS[f.severity]}`}>{f.severity}</Badge>
                <span className="text-muted-foreground">{f.description}</span>
              </div>
            ))
          )}
        </div>

        {profile.suggestions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sugestões</p>
              {profile.suggestions.map(s => (
                <div key={s.id} className="p-2 rounded bg-muted/30 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${PRIORITY_COLORS[s.priority]}`}>{s.priority}</Badge>
                    <span className="text-xs font-medium text-foreground">{s.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.description}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RiskBar({ label, value }: { label: string; value: number }) {
  const level = value >= 80 ? 'critical' : value >= 60 ? 'high' : value >= 40 ? 'medium' : value >= 20 ? 'low' : 'none';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${RISK_BAR_COLORS[level]}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

function CouplingTable({ metrics, profiles }: { metrics: CouplingMetrics[]; profiles: ModuleRiskProfile[] }) {
  const sorted = [...metrics].sort((a, b) => b.instability - a.instability);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Análise de Acoplamento (Robert C. Martin)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">Módulo</th>
                <th className="text-center py-2 px-2">Ca (Aferente)</th>
                <th className="text-center py-2 px-2">Ce (Eferente)</th>
                <th className="text-center py-2 px-2">Instabilidade</th>
                <th className="text-center py-2 px-2">Abstração</th>
                <th className="text-center py-2 px-2">Dist. Main Seq.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => {
                const profile = profiles.find(p => p.module_key === m.module_key);
                const distance = Math.abs(m.instability + m.abstractness - 1);
                return (
                  <tr key={m.module_key} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium text-foreground">{profile?.module_label ?? m.module_key}</td>
                    <td className="py-2 px-2 text-center">{m.afferent_coupling}</td>
                    <td className="py-2 px-2 text-center">{m.efferent_coupling}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={`text-[10px] ${m.instability > 0.7 ? RISK_COLORS.high : m.instability > 0.4 ? RISK_COLORS.medium : RISK_COLORS.none}`}>
                        {m.instability.toFixed(2)}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center">{m.abstractness.toFixed(3)}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={`text-[10px] ${distance > 0.7 ? RISK_COLORS.high : distance > 0.4 ? RISK_COLORS.medium : RISK_COLORS.none}`}>
                        {distance.toFixed(2)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CircularDependenciesView({ cycles, profiles }: { cycles: CircularDependencyCycle[]; profiles: ModuleRiskProfile[] }) {
  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RotateCcw className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhuma dependência circular detectada</p>
          <p className="text-xs text-muted-foreground mt-1">A arquitetura está livre de ciclos ✓</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-red-400" />
          Dependências Circulares ({cycles.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cycles.map((c, i) => (
          <div key={i} className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={RISK_COLORS[c.severity]}>{c.severity}</Badge>
              <span className="text-xs text-muted-foreground">Ciclo de {c.cycle.length - 1} módulos</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {c.cycle.map((k, j) => {
                const p = profiles.find(pr => pr.module_key === k);
                return (
                  <span key={j} className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">{p?.module_label ?? k}</Badge>
                    {j < c.cycle.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SuggestionsView({ suggestions }: { suggestions: RefactorSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lightbulb className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhuma sugestão de refactoring</p>
          <p className="text-xs text-muted-foreground mt-1">A arquitetura está em bom estado ✓</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Sugestões de Refactoring ({suggestions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map(s => (
          <div key={s.id} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[s.priority]}`}>{s.priority}</Badge>
              <span className="text-sm font-medium text-foreground">{s.title}</span>
              <Badge variant="outline" className="text-[10px] ml-auto">{s.effort_estimate}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{s.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Dependency Risk Scanner View ──

function DependencyRiskView({ scores }: { scores: DependencyRiskScore[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedScore = selected ? scores.find(s => s.module_key === selected) : null;

  const spofCount = scores.filter(s => s.is_single_point_of_failure).length;
  const fragileCount = scores.filter(s => s.is_fragile).length;
  const highCentrality = scores.filter(s => s.centrality_index >= 0.05).length;

  return (
    <div className="space-y-4">
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs">Pontos Únicos de Falha</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{spofCount}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${spofCount > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              {spofCount > 0 ? 'atenção' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Zap className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Módulos Frágeis</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{fragileCount}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${fragileCount > 0 ? RISK_COLORS.high : RISK_COLORS.none}`}>
              {fragileCount > 0 ? 'fan-out alto' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs">Hub Central</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{highCentrality}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${RISK_COLORS.medium}`}>centralidade ≥ 5%</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs">Módulos Seguros</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{scores.filter(s => s.risk_level === 'none' || s.risk_level === 'low').length}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${RISK_COLORS.none}`}>risco baixo</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Table + Detail */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                Dependency Risk Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2">Módulo</th>
                      <th className="text-center py-2 px-2">Score</th>
                      <th className="text-center py-2 px-2">Fan-In</th>
                      <th className="text-center py-2 px-2">Fan-Out</th>
                      <th className="text-center py-2 px-2">Central.</th>
                      <th className="text-center py-2 px-2">SPOF</th>
                      <th className="text-center py-2 px-2">Frágil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map(s => (
                      <tr
                        key={s.module_key}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${selected === s.module_key ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                        onClick={() => setSelected(prev => prev === s.module_key ? null : s.module_key)}
                      >
                        <td className="py-2 px-2 font-medium text-foreground flex items-center gap-1.5">
                          {s.domain === 'saas'
                            ? <Server className="h-3 w-3 text-blue-400 shrink-0" />
                            : <Briefcase className="h-3 w-3 text-emerald-400 shrink-0" />}
                          {s.module_label}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[s.risk_level]}`}>
                            {s.dependency_risk_score}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{s.fan_in}</td>
                        <td className="py-2 px-2 text-center font-mono">{s.fan_out}</td>
                        <td className="py-2 px-2 text-center font-mono">{(s.centrality_index * 100).toFixed(1)}%</td>
                        <td className="py-2 px-2 text-center">
                          {s.is_single_point_of_failure
                            ? <AlertTriangle className="h-3.5 w-3.5 text-destructive mx-auto" />
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {s.is_fragile
                            ? <Zap className="h-3.5 w-3.5 text-orange-400 mx-auto" />
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-5">
          {selectedScore ? (
            <DependencyRiskDetail score={selectedScore} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <GitBranch className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Selecione um módulo para ver o detalhamento de dependency risk</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DependencyRiskDetail({ score }: { score: DependencyRiskScore }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {score.module_label}
          <Badge variant="outline" className={`text-[10px] ml-auto ${RISK_COLORS[score.risk_level]}`}>
            dependency_risk_score: {score.dependency_risk_score}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Fan-In (Ca)</span>
            <p className="text-lg font-bold text-foreground">{score.fan_in}</p>
            <span className="text-[10px] text-muted-foreground">({score.mandatory_fan_in} mandatórias)</span>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Fan-Out (Ce)</span>
            <p className="text-lg font-bold text-foreground">{score.fan_out}</p>
            <span className="text-[10px] text-muted-foreground">({score.mandatory_fan_out} mandatórias)</span>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Centralidade</span>
            <p className="text-lg font-bold text-foreground">{(score.centrality_index * 100).toFixed(1)}%</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Total Diretas</span>
            <p className="text-lg font-bold text-foreground">{score.total_direct_dependencies}</p>
          </div>
        </div>

        {/* Flags */}
        <div className="flex gap-2 flex-wrap">
          {score.is_single_point_of_failure && (
            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>
              ⚠ Ponto Único de Falha
            </Badge>
          )}
          {score.is_fragile && (
            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.high}`}>
              ⚡ Módulo Frágil
            </Badge>
          )}
          {score.centrality_index >= 0.05 && (
            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.medium}`}>
              🎯 Hub Central
            </Badge>
          )}
        </div>

        <Separator />

        {/* Dependents */}
        {score.dependents.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dependentes ({score.dependents.length})</p>
            <div className="flex flex-wrap gap-1">
              {score.dependents.map(d => (
                <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {score.dependencies.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Depende de ({score.dependencies.length})</p>
            <div className="flex flex-wrap gap-1">
              {score.dependencies.map(d => (
                <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Risk Factors */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fatores de Risco</p>
          {score.factors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum fator de risco de dependência ✓</p>
          ) : (
            score.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={`text-[9px] shrink-0 ${RISK_COLORS[f.severity]}`}>{f.severity}</Badge>
                <span className="text-muted-foreground">{f.description}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
