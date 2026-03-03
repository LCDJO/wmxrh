/**
 * ArchitectureDashboard — Main dashboard for Architecture Intelligence Center
 *
 * Shows: total SaaS/Tenant modules, modules in development, critical modules,
 * risky dependencies, and quick stats.
 */
import { useMemo } from 'react';
import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Server, Briefcase, Wrench, AlertTriangle, GitBranch,
  Shield, Activity, CheckCircle2, Clock, Boxes,
} from 'lucide-react';

export default function ArchitectureDashboard() {
  const engine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const modules = engine.getModules();
  const edges = engine.getDependencyEdges();
  const deliverables = engine.getDeliverables();
  const versions = engine.getVersionHistory();

  const saasModules = modules.filter(m => m.domain === 'saas');
  const tenantModules = modules.filter(m => m.domain === 'tenant');
  const devModules = modules.filter(m => m.lifecycle_status === 'development' || m.lifecycle_status === 'planning');
  const criticalModules = modules.filter(m => m.sla.tier === 'critical');
  const mandatoryEdges = edges.filter(e => e.is_mandatory);
  const optionalEdges = edges.filter(e => !e.is_mandatory);

  // Risky dependencies: modules with many mandatory dependants (high fan-in)
  const fanInMap = new Map<string, number>();
  for (const e of mandatoryEdges) {
    fanInMap.set(e.to, (fanInMap.get(e.to) ?? 0) + 1);
  }
  const riskyDeps = Array.from(fanInMap.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: modules.find(m => m.key === key)?.label ?? key,
      dependants: count,
      isCritical: modules.find(m => m.key === key)?.sla.tier === 'critical',
    }));

  const doneDeliverables = deliverables.filter(d => d.status === 'done').length;
  const pendingDeliverables = deliverables.length - doneDeliverables;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard icon={<Server className="h-4 w-4" />} label="Módulos SaaS" value={saasModules.length} accent="text-blue-400" />
        <KPICard icon={<Briefcase className="h-4 w-4" />} label="Módulos Tenant" value={tenantModules.length} accent="text-emerald-400" />
        <KPICard icon={<Wrench className="h-4 w-4" />} label="Em Desenvolvimento" value={devModules.length} accent="text-amber-400" />
        <KPICard icon={<Shield className="h-4 w-4" />} label="Módulos Críticos" value={criticalModules.length} accent="text-destructive" />
        <KPICard icon={<AlertTriangle className="h-4 w-4" />} label="Deps. com Risco" value={riskyDeps.length} accent="text-orange-400" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Critical Modules */}
        <div className="col-span-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                Módulos Críticos (SLA Critical)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {criticalModules.map(m => (
                <div key={m.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${m.status === 'healthy' ? 'bg-emerald-500' : m.status === 'degraded' ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
                    <span className="text-sm font-medium text-foreground">{m.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{m.domain}</Badge>
                    <Badge variant="outline" className="text-[10px]">{m.sla.uptime_target}</Badge>
                    <Badge variant="outline" className="text-[10px]">{m.version_tag}</Badge>
                  </div>
                </div>
              ))}
              {criticalModules.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum módulo crítico</p>}
            </CardContent>
          </Card>

          {/* Modules in Development */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-400" />
                Módulos em Desenvolvimento / Planejamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {devModules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Todos os módulos estão estáveis ✓</p>
              ) : (
                devModules.map(m => (
                  <div key={m.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                      <Badge variant="secondary" className="text-[10px]">{m.lifecycle_status}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{m.domain}</Badge>
                      <span className="text-xs text-muted-foreground">{m.owner}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="col-span-6 space-y-4">
          {/* Risky Dependencies */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                Dependências com Risco (Alto Fan-in)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {riskyDeps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma dependência de alto risco</p>
              ) : (
                riskyDeps.map(d => (
                  <div key={d.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{d.label}</span>
                      {d.isCritical && <Badge variant="destructive" className="text-[10px]">critical</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{d.dependants} módulos dependem</span>
                      <Badge variant={d.dependants >= 4 ? 'destructive' : 'secondary'} className="text-[10px]">
                        fan-in: {d.dependants}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <StatRow icon={<Boxes className="h-3.5 w-3.5" />} label="Total de Módulos" value={modules.length} />
                <StatRow icon={<GitBranch className="h-3.5 w-3.5" />} label="Total Dependências" value={edges.length} />
                <StatRow icon={<Shield className="h-3.5 w-3.5" />} label="Obrigatórias" value={mandatoryEdges.length} />
                <StatRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Opcionais" value={optionalEdges.length} />
                <StatRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Entregáveis Concluídos" value={doneDeliverables} />
                <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Entregáveis Pendentes" value={pendingDeliverables} />
              </div>
            </CardContent>
          </Card>

          {/* Latest version */}
          {versions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Última Versão Arquitetural
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const v = versions[versions.length - 1];
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs">{v.version_tag}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(v.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5 pl-2">
                        {v.structural_changes.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.impacted_modules.map(k => (
                          <Badge key={k} variant="outline" className="text-[10px]">
                            {modules.find(m => m.key === k)?.label ?? k}
                          </Badge>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className={`flex items-center gap-2 mb-1 ${accent}`}>
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/20">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
