/**
 * Architecture Risk Dashboard — Visual risk analysis for platform architecture
 */
import { useMemo, useState } from 'react';
import { createArchitectureRiskAnalyzer } from '@/domains/architecture-risk';
import type { ModuleRiskProfile, RiskLevel, CircularDependencyCycle, RefactorSuggestion, CouplingMetrics, DependencyRiskScore, BidirectionalDependency, CrossDomainViolation, CriticalityIndex, ChangeImpactPrediction } from '@/domains/architecture-risk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle, Shield, GitBranch, RotateCcw, Zap, Target,
  TrendingUp, Lightbulb, Activity, Server, Briefcase, ArrowRight,
  Radar, Users, Workflow, PlayCircle, RotateCw, CheckCircle2, XCircle, AlertCircle,
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
  const biDirDeps = useMemo(() => analyzer.getBidirectionalDependencies(), [analyzer]);
  const crossViolations = useMemo(() => analyzer.getCrossDomainViolations(), [analyzer]);
  const critIndexes = useMemo(() => analyzer.getCriticalityIndexes(), [analyzer]);
  const impactPredictions = useMemo(() => analyzer.getChangeImpactPredictions(), [analyzer]);
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
          <TabsTrigger value="criticality" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Criticality</TabsTrigger>
          <TabsTrigger value="impact" className="gap-1.5"><Radar className="h-3.5 w-3.5" />Impact Predictor</TabsTrigger>
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
          <CouplingTable metrics={couplingMetrics} profiles={profiles} biDirDeps={biDirDeps} crossViolations={crossViolations} />
        </TabsContent>

        {/* ── Circular Dependencies ── */}
        <TabsContent value="cycles">
          <CircularDependenciesView cycles={cycles} profiles={profiles} />
        </TabsContent>

        {/* ── Criticality Index ── */}
        <TabsContent value="criticality">
          <CriticalityView indexes={critIndexes} />
        </TabsContent>

        {/* ── Change Impact Predictor ── */}
        <TabsContent value="impact">
          <ChangeImpactView predictions={impactPredictions} />
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
  const level = value >= 81 ? 'critical' : value >= 61 ? 'high' : value >= 31 ? 'medium' : value >= 1 ? 'low' : 'none';
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

function CouplingTable({ metrics, profiles, biDirDeps, crossViolations }: {
  metrics: CouplingMetrics[]; profiles: ModuleRiskProfile[];
  biDirDeps: BidirectionalDependency[]; crossViolations: CrossDomainViolation[];
}) {
  const sorted = [...metrics].sort((a, b) => b.instability - a.instability);
  const excessiveCount = metrics.filter(m => m.is_excessively_connected).length;

  const ZONE_LABELS: Record<string, string> = {
    main_sequence: 'Main Seq.',
    zone_of_pain: 'Zona de Dor',
    zone_of_uselessness: 'Zona de Inutilidade',
    balanced: 'Balanceado',
  };
  const ZONE_COLORS: Record<string, string> = {
    main_sequence: RISK_COLORS.none,
    zone_of_pain: RISK_COLORS.critical,
    zone_of_uselessness: RISK_COLORS.high,
    balanced: RISK_COLORS.low,
  };

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="text-xs">Bidirecionais</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{biDirDeps.length}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${biDirDeps.length > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              {biDirDeps.length > 0 ? 'acoplamento mútuo' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs">Violações SaaS↔Tenant</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{crossViolations.length}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${crossViolations.length > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              {crossViolations.length > 0 ? 'isolamento quebrado' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Zap className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Excessivamente Conectados</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{excessiveCount}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${excessiveCount > 0 ? RISK_COLORS.high : RISK_COLORS.none}`}>
              {excessiveCount > 0 ? '≥6 conexões' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs">Na Main Sequence</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{metrics.filter(m => m.zone === 'main_sequence').length}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${RISK_COLORS.none}`}>ideal</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main coupling table */}
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
                  <th className="text-center py-2 px-2">Ca</th>
                  <th className="text-center py-2 px-2">Ce</th>
                  <th className="text-center py-2 px-2">I</th>
                  <th className="text-center py-2 px-2">A</th>
                  <th className="text-center py-2 px-2">D</th>
                  <th className="text-center py-2 px-2">Zona</th>
                  <th className="text-center py-2 px-2">BiDir</th>
                  <th className="text-center py-2 px-2">X-Dom</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(m => {
                  const profile = profiles.find(p => p.module_key === m.module_key);
                  return (
                    <tr key={m.module_key} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium text-foreground flex items-center gap-1.5">
                        {profile?.domain === 'saas'
                          ? <Server className="h-3 w-3 text-blue-400 shrink-0" />
                          : <Briefcase className="h-3 w-3 text-emerald-400 shrink-0" />}
                        {profile?.module_label ?? m.module_key}
                        {m.is_excessively_connected && <Zap className="h-3 w-3 text-orange-400 shrink-0" />}
                      </td>
                      <td className="py-2 px-2 text-center font-mono">{m.afferent_coupling}</td>
                      <td className="py-2 px-2 text-center font-mono">{m.efferent_coupling}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${m.instability > 0.7 ? RISK_COLORS.high : m.instability > 0.4 ? RISK_COLORS.medium : RISK_COLORS.none}`}>
                          {m.instability.toFixed(2)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center font-mono">{m.abstractness.toFixed(3)}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${m.distance_from_main_seq > 0.7 ? RISK_COLORS.high : m.distance_from_main_seq > 0.4 ? RISK_COLORS.medium : RISK_COLORS.none}`}>
                          {m.distance_from_main_seq.toFixed(2)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${ZONE_COLORS[m.zone]}`}>
                          {ZONE_LABELS[m.zone]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center font-mono">
                        {m.bidirectional_count > 0
                          ? <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>{m.bidirectional_count}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center font-mono">
                        {m.cross_domain_violation_count > 0
                          ? <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>{m.cross_domain_violation_count}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bidirectional dependencies */}
      {biDirDeps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-destructive" />
              Dependências Bidirecionais ({biDirDeps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {biDirDeps.map((b, i) => {
              const labelA = profiles.find(p => p.module_key === b.module_a)?.module_label ?? b.module_a;
              const labelB = profiles.find(p => p.module_key === b.module_b)?.module_label ?? b.module_b;
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-destructive/20 bg-destructive/5 text-xs">
                  <Badge variant="secondary" className="text-[10px]">{labelA}</Badge>
                  <span className="text-muted-foreground">↔</span>
                  <Badge variant="secondary" className="text-[10px]">{labelB}</Badge>
                  <span className="ml-auto text-muted-foreground">
                    {b.a_to_b_mandatory && b.b_to_a_mandatory ? 'ambas mandatórias' : 'parcialmente mandatória'}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Cross-domain violations */}
      {crossViolations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Violações de Isolamento SaaS ↔ Tenant ({crossViolations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {crossViolations.map((v, i) => (
              <div key={i} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>{v.direction}</Badge>
                  <Badge variant="outline" className="text-[10px]">{v.violation_type}</Badge>
                  {v.is_mandatory && <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.high}`}>mandatória</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{v.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function CircularDependenciesView({ cycles, profiles }: { cycles: CircularDependencyCycle[]; profiles: ModuleRiskProfile[] }) {
  const blockingCycles = cycles.filter(c => c.is_blocking);
  const nonBlockingCycles = cycles.filter(c => !c.is_blocking);

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
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <RotateCcw className="h-4 w-4 text-destructive" />
              <span className="text-xs">Total de Ciclos</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{cycles.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs">Bloqueantes</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{blockingCycles.length}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${blockingCycles.length > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              {blockingCycles.length > 0 ? 'ação necessária' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Zap className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Com Edge Mandatória</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{cycles.filter(c => c.has_mandatory_edge).length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="text-xs">Cross-Domain</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{cycles.filter(c => c.is_cross_domain).length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Blocking cycles */}
      {blockingCycles.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Ciclos Bloqueantes ({blockingCycles.length})
              <Badge variant="outline" className={`text-[10px] ml-auto ${RISK_COLORS.critical}`}>BLOQUEADO</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockingCycles.map((c, i) => (
              <CycleCard key={i} cycle={c} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Non-blocking cycles */}
      {nonBlockingCycles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              Ciclos Monitorados ({nonBlockingCycles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nonBlockingCycles.map((c, i) => (
              <CycleCard key={i} cycle={c} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CycleCard({ cycle: c }: { cycle: CircularDependencyCycle }) {
  return (
    <div className={`p-3 rounded-lg border space-y-2 ${c.is_blocking ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/20'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={RISK_COLORS[c.severity]}>{c.severity}</Badge>
        <span className="text-xs text-muted-foreground">Ciclo de {c.depth} módulos</span>
        {c.has_mandatory_edge && (
          <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.high}`}>mandatória</Badge>
        )}
        {c.is_cross_domain && (
          <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>cross-domain</Badge>
        )}
        {c.is_blocking && (
          <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>⛔ BLOQUEANTE</Badge>
        )}
        <div className="ml-auto flex gap-1">
          {c.domains_involved.map(d => (
            <Badge key={d} variant="secondary" className="text-[10px]">
              {d === 'saas' ? '🔵 SaaS' : '🟢 Tenant'}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {c.cycle_labels.map((label, j) => (
          <span key={j} className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px]">{label}</Badge>
            {j < c.cycle_labels.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{c.blocking_reason}</p>
    </div>
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

// ── Criticality Index View ──

function CriticalityView({ indexes }: { indexes: CriticalityIndex[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedIdx = selected ? indexes.find(i => i.module_key === selected) : null;

  const criticalModules = indexes.filter(i => i.risk_level === 'critical' || i.risk_level === 'high');
  const withIncidents = indexes.filter(i => i.incident_count_30d > 0);
  const spofModules = indexes.filter(i => i.transitive_dependents >= 4);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Shield className="h-4 w-4 text-destructive" />
              <span className="text-xs">Módulos Críticos</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{criticalModules.length}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${criticalModules.length > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              criticality ≥ high
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Com Incidentes (30d)</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{withIncidents.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs">Alto Impacto (≥4 dep.)</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{spofModules.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Sev1 Total (30d)</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{indexes.reduce((s, i) => s + i.sev1_count, 0)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Table + Detail */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Criticality Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2">Módulo</th>
                      <th className="text-center py-2 px-2">Index</th>
                      <th className="text-center py-2 px-2">SLA</th>
                      <th className="text-center py-2 px-2">Central.</th>
                      <th className="text-center py-2 px-2">Incid.</th>
                      <th className="text-center py-2 px-2">Uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.map(idx => (
                      <tr
                        key={idx.module_key}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${selected === idx.module_key ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                        onClick={() => setSelected(prev => prev === idx.module_key ? null : idx.module_key)}
                      >
                        <td className="py-2 px-2 font-medium text-foreground flex items-center gap-1.5">
                          {idx.domain === 'saas'
                            ? <Server className="h-3 w-3 text-blue-400 shrink-0" />
                            : <Briefcase className="h-3 w-3 text-emerald-400 shrink-0" />}
                          {idx.module_label}
                          {idx.has_recent_critical_incident && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[idx.risk_level]}`}>
                            {idx.criticality_index}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{idx.sla_score}</td>
                        <td className="py-2 px-2 text-center font-mono">{idx.centrality_score}</td>
                        <td className="py-2 px-2 text-center font-mono">{idx.incident_score}</td>
                        <td className="py-2 px-2 text-center font-mono">{idx.usage_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-5">
          {selectedIdx ? (
            <CriticalityDetail idx={selectedIdx} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Selecione um módulo para ver o criticality_index detalhado</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CriticalityDetail({ idx }: { idx: CriticalityIndex }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {idx.module_label}
          <Badge variant="outline" className={`text-[10px] ml-auto ${RISK_COLORS[idx.risk_level]}`}>
            criticality_index: {idx.criticality_index}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score breakdown bars */}
        <div className="space-y-2">
          <RiskBar label="SLA (0–40)" value={idx.sla_score * 2.5} />
          <RiskBar label="Centralidade (0–25)" value={idx.centrality_score * 4} />
          <RiskBar label="Incidentes (0–20)" value={idx.incident_score * 5} />
          <RiskBar label="Uso/Domain (0–15)" value={idx.usage_score * 6.67} />
        </div>

        <Separator />

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">SLA Tier</span>
            <p className="text-sm font-bold text-foreground uppercase">{idx.sla_tier}</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Fan-In Direto</span>
            <p className="text-sm font-bold text-foreground">{idx.fan_in}</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Dep. Transitivos</span>
            <p className="text-sm font-bold text-foreground">{idx.transitive_dependents}</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Event Surface</span>
            <p className="text-sm font-bold text-foreground">{idx.event_surface} eventos</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Incidentes (30d)</span>
            <p className="text-sm font-bold text-foreground">{idx.incident_count_30d}</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">Sev1 / Sev2</span>
            <p className="text-sm font-bold text-foreground">{idx.sev1_count} / {idx.sev2_count}</p>
          </div>
        </div>

        {/* Flags */}
        <div className="flex gap-2 flex-wrap">
          {idx.is_saas_core && (
            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.medium}`}>🔵 SaaS Core</Badge>
          )}
          {idx.has_recent_critical_incident && (
            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.critical}`}>🔥 Incidente Crítico Recente</Badge>
          )}
          {idx.transitive_dependents >= 4 && (
            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.high}`}>⚠ Alto Impacto Transitivo</Badge>
          )}
        </div>

        <Separator />

        {/* Risk Factors */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fatores de Criticidade</p>
          {idx.factors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum fator de criticidade elevado ✓</p>
          ) : (
            idx.factors.map((f, i) => (
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

// ── Change Impact Predictor View ──

const PREFLIGHT_ICONS: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  fail: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  warn: <AlertCircle className="h-3.5 w-3.5 text-amber-400" />,
};

const WORKFLOW_ICONS: Record<string, React.ReactNode> = {
  onboarding: <Users className="h-3 w-3 text-blue-400" />,
  offboarding: <Users className="h-3 w-3 text-orange-400" />,
  payroll: <Briefcase className="h-3 w-3 text-emerald-400" />,
  compliance: <Shield className="h-3 w-3 text-purple-400" />,
  approval: <CheckCircle2 className="h-3 w-3 text-primary" />,
  automation: <Zap className="h-3 w-3 text-amber-400" />,
};

function ChangeImpactView({ predictions }: { predictions: ChangeImpactPrediction[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedPred = selected ? predictions.find(p => p.module_key === selected) : null;

  const sandboxCount = predictions.filter(p => p.sandbox_recommended).length;
  const rollbackCount = predictions.filter(p => p.rollback_required).length;
  const criticalCount = predictions.filter(p => p.risk_level === 'critical' || p.risk_level === 'high').length;
  const totalWorkflowBreaks = predictions.reduce((s, p) => s + p.affected_workflows.filter(w => w.will_break).length, 0);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Radar className="h-4 w-4 text-destructive" />
              <span className="text-xs">Alto Impacto</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{criticalCount}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${criticalCount > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              {criticalCount > 0 ? 'blast radius alto' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <PlayCircle className="h-4 w-4 text-amber-400" />
              <span className="text-xs">Sandbox Recomendado</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{sandboxCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <RotateCw className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Rollback Obrigatório</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{rollbackCount}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${rollbackCount > 0 ? RISK_COLORS.high : RISK_COLORS.none}`}>
              {rollbackCount > 0 ? 'plano necessário' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Workflow className="h-4 w-4 text-destructive" />
              <span className="text-xs">Workflows Quebrados</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{totalWorkflowBreaks}</span>
            <Badge variant="outline" className={`text-[10px] mt-1 ml-2 ${totalWorkflowBreaks > 0 ? RISK_COLORS.critical : RISK_COLORS.none}`}>
              {totalWorkflowBreaks > 0 ? 'ação necessária' : 'ok'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Module list + Detail */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                Change Impact Predictor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
              {predictions.map(p => (
                <div
                  key={p.module_key}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border text-xs ${
                    selected === p.module_key ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/30'
                  }`}
                  onClick={() => setSelected(prev => prev === p.module_key ? null : p.module_key)}
                >
                  {p.domain === 'saas'
                    ? <Server className="h-3 w-3 text-blue-400 shrink-0" />
                    : <Briefcase className="h-3 w-3 text-emerald-400 shrink-0" />}
                  <span className="font-medium text-foreground truncate flex-1">{p.module_label}</span>
                  <Badge variant="outline" className={`text-[9px] ${RISK_COLORS[p.risk_level]}`}>
                    {p.blast_radius_score}
                  </Badge>
                  {p.sandbox_recommended && <PlayCircle className="h-3 w-3 text-amber-400 shrink-0" />}
                  {p.rollback_required && <RotateCw className="h-3 w-3 text-orange-400 shrink-0" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-7">
          {selectedPred ? (
            <ChangeImpactDetail prediction={selectedPred} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Radar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Selecione um módulo para ver a predição de impacto</p>
                <p className="text-xs text-muted-foreground mt-1">Inclui módulos, tenants, workflows e recomendações de sandbox/rollback</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeImpactDetail({ prediction: p }: { prediction: ChangeImpactPrediction }) {
  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            {p.module_label}
            <Badge variant="outline" className={`text-[10px] ml-auto ${RISK_COLORS[p.risk_level]}`}>
              blast_radius: {p.blast_radius_score}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Strategy badges */}
          <div className="flex gap-2 flex-wrap mb-4">
            {p.sandbox_recommended && (
              <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.medium}`}>
                <PlayCircle className="h-3 w-3 mr-1" />
                Sandbox Recomendado
              </Badge>
            )}
            {p.rollback_required && (
              <Badge variant="outline" className={`text-[10px] ${RISK_COLORS.high}`}>
                <RotateCw className="h-3 w-3 mr-1" />
                Rollback Obrigatório
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] ${p.rollback_strategy === 'immediate' ? RISK_COLORS.critical : p.rollback_strategy === 'phased' ? RISK_COLORS.high : RISK_COLORS.medium}`}>
              Estratégia: {p.rollback_strategy}
            </Badge>
          </div>

          {/* Preflight checks */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pre-Flight Checks</p>
            {p.preflight_checks.map(check => (
              <div key={check.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                {PREFLIGHT_ICONS[check.status]}
                <span className="font-medium text-foreground">{check.label}</span>
                <span className="text-muted-foreground ml-auto">{check.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Impacted Modules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Módulos Impactados ({p.impacted_modules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {p.impacted_modules.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum módulo impactado ✓</p>
          ) : (
            <div className="space-y-1">
              {p.impacted_modules.map(m => (
                <div key={m.module_key} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/20">
                  {m.domain === 'saas'
                    ? <Server className="h-3 w-3 text-blue-400 shrink-0" />
                    : <Briefcase className="h-3 w-3 text-emerald-400 shrink-0" />}
                  <span className="font-medium text-foreground">{m.module_label}</span>
                  <Badge variant="outline" className={`text-[9px] ${m.impact_type === 'direct' ? RISK_COLORS.high : RISK_COLORS.low}`}>
                    {m.impact_type} (d={m.depth})
                  </Badge>
                  {m.is_mandatory && (
                    <Badge variant="outline" className={`text-[9px] ${RISK_COLORS.critical}`}>mandatória</Badge>
                  )}
                  <Badge variant="outline" className={`text-[9px] ml-auto ${RISK_COLORS[m.risk_level]}`}>{m.risk_level}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affected Tenants */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Tenants Afetados ({p.affected_tenants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {p.affected_tenants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum tenant afetado ✓</p>
          ) : (
            <div className="space-y-1">
              {p.affected_tenants.map(t => (
                <div key={t.tenant_id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/20">
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t.tenant_name}</span>
                  <Badge variant="outline" className="text-[9px]">{t.plan_tier}</Badge>
                  <Badge variant="outline" className={`text-[9px] ${RISK_COLORS[t.impact_severity]}`}>{t.impact_severity}</Badge>
                  {t.has_active_sandbox && (
                    <Badge variant="outline" className={`text-[9px] ${RISK_COLORS.medium}`}>
                      <PlayCircle className="h-2.5 w-2.5 mr-0.5" />sandbox ativo
                    </Badge>
                  )}
                  <span className="ml-auto text-muted-foreground">{t.affected_modules.length} módulo(s)</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affected Workflows */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            Workflows Afetados ({p.affected_workflows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {p.affected_workflows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum workflow afetado ✓</p>
          ) : (
            <div className="space-y-1">
              {p.affected_workflows.map(wf => (
                <div key={wf.workflow_id} className={`flex items-center gap-2 text-xs p-2 rounded ${wf.will_break ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/20'}`}>
                  {WORKFLOW_ICONS[wf.workflow_type] ?? <Workflow className="h-3 w-3 text-muted-foreground" />}
                  <span className="font-medium text-foreground">{wf.workflow_name}</span>
                  <Badge variant="outline" className="text-[9px]">{wf.workflow_type}</Badge>
                  <Badge variant="outline" className={`text-[9px] ${RISK_COLORS[wf.impact_severity]}`}>{wf.impact_severity}</Badge>
                  {wf.will_break && (
                    <Badge variant="outline" className={`text-[9px] ${RISK_COLORS.critical}`}>
                      <XCircle className="h-2.5 w-2.5 mr-0.5" />vai quebrar
                    </Badge>
                  )}
                  <span className="ml-auto text-muted-foreground">{wf.depends_on_modules.length} deps</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
