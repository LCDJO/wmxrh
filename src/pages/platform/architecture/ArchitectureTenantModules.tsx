/**
 * Architecture Intelligence — Tenant Feature Modules
 */
import { useMemo, useState } from 'react';
import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import type { ArchModuleInfo, DeliverableStatus } from '@/domains/architecture-intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Boxes, GitBranch, Activity, CheckCircle2, FileText,
  ArrowRight, Circle, Briefcase,
} from 'lucide-react';
import { ModuleCard, SummaryCard, statusColor, deliverableVariant } from './shared';

export default function ArchitectureTenantModules() {
  const engine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const allModules = useMemo(() => engine.getModules(), [engine]);
  const modules = useMemo(() => allModules.filter(m => m.category === 'domain'), [allModules]);
  const edges = useMemo(() => engine.getDependencyEdges().filter(e =>
    modules.some(m => m.key === e.from) || modules.some(m => m.key === e.to)
  ), [engine, modules]);
  const deliverables = useMemo(() => engine.getDeliverables().filter(d =>
    modules.some(m => m.key === d.module_key)
  ), [engine, modules]);

  const [selectedModule, setSelectedModule] = useState<ArchModuleInfo | null>(null);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Briefcase className="h-4 w-4" />} label="Tenant Modules" value={modules.length} sub="Módulos de domínio RH" />
        <SummaryCard icon={<GitBranch className="h-4 w-4" />} label="Dependências" value={edges.length} sub="Conexões entre módulos" />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Entregáveis" value={deliverables.length} sub={`${deliverables.filter(d => d.status === 'done').length} concluídos`} />
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="Health" value={modules.filter(m => m.status === 'healthy').length} sub={`de ${modules.length} módulos`} />
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="modules"><Boxes className="h-3.5 w-3.5 mr-1" />Módulos</TabsTrigger>
          <TabsTrigger value="dependencies"><GitBranch className="h-3.5 w-3.5 mr-1" />Dependências</TabsTrigger>
          <TabsTrigger value="health"><Activity className="h-3.5 w-3.5 mr-1" />Health</TabsTrigger>
          <TabsTrigger value="deliverables"><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Entregáveis</TabsTrigger>
        </TabsList>

        {/* Modules */}
        <TabsContent value="modules" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map(m => (
              <ModuleCard key={m.key} mod={m} onClick={() => setSelectedModule(m)} />
            ))}
          </div>
          {selectedModule && <ModuleDetailTenant mod={selectedModule} onClose={() => setSelectedModule(null)} />}
        </TabsContent>

        {/* Dependencies */}
        <TabsContent value="dependencies">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Dependências Tenant Modules</CardTitle></CardHeader>
            <CardContent>
              {edges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma dependência declarada.</p>
              ) : (
                <div className="space-y-2">
                  {edges.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Badge variant="outline">{e.from}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">{e.to}</Badge>
                      <Badge variant={e.is_mandatory ? 'default' : 'secondary'} className="text-xs ml-auto">
                        {e.is_mandatory ? 'Obrigatória' : 'Opcional'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health */}
        <TabsContent value="health">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Tenant Module Health</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {modules.map(m => (
                  <div key={m.key} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Circle className={`h-2.5 w-2.5 fill-current ${statusColor[m.status]} rounded-full`} />
                      <span className="font-medium">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{m.version_tag}</Badge>
                      <span className="text-xs text-muted-foreground capitalize">{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliverables */}
        <TabsContent value="deliverables">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Entregáveis Tenant</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deliverables.map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant={deliverableVariant[d.status]} className="text-xs min-w-[90px] justify-center">
                        {d.status === 'done' ? 'Concluído' : d.status === 'in_progress' ? 'Em Progresso' : d.status === 'planned' ? 'Planejado' : 'Bloqueado'}
                      </Badge>
                      <div>
                        <span className="font-medium">{d.title}</span>
                        {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{d.module_key}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModuleDetailTenant({ mod, onClose }: { mod: ArchModuleInfo; onClose: () => void }) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{mod.label}</CardTitle>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{mod.description}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{mod.version_tag}</Badge>
          <Badge variant="secondary">{mod.category}</Badge>
          <Badge className={`${statusColor[mod.status]} text-white`}>{mod.status}</Badge>
        </div>
        {mod.dependencies.length > 0 && (
          <div>
            <span className="font-medium">Dependências:</span>
            <ul className="mt-1 space-y-1">
              {mod.dependencies.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRight className="h-3 w-3" /> {d.required_module_id} ≥ v{d.required_version.major}.{d.required_version.minor}.{d.required_version.patch}
                </li>
              ))}
            </ul>
          </div>
        )}
        {mod.changelog_summary && (
          <div>
            <span className="font-medium">Changelog:</span>
            <p className="text-muted-foreground mt-1">{mod.changelog_summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
