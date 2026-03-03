/**
 * Architecture Intelligence — SaaS Core Modules
 */
import { useMemo, useState } from 'react';
import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import type { ArchModuleInfo, DeliverableStatus } from '@/domains/architecture-intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Boxes, GitBranch, Zap, Activity, CheckCircle2, FileText,
  History, Search, ArrowRight, Circle, Server,
} from 'lucide-react';
import { ModuleCard, SummaryCard, statusColor, deliverableVariant } from './shared';

export default function ArchitectureSaasCore() {
  const engine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const allModules = useMemo(() => engine.getModules(), [engine]);
  const modules = useMemo(() => allModules.filter(m => m.category === 'platform'), [allModules]);
  const edges = useMemo(() => engine.getDependencyEdges().filter(e =>
    modules.some(m => m.key === e.from) || modules.some(m => m.key === e.to)
  ), [engine, modules]);
  const allEvents = useMemo(() => engine.getEventMap(), [engine]);
  const deliverables = useMemo(() => engine.getDeliverables().filter(d =>
    modules.some(m => m.key === d.module_key)
  ), [engine, modules]);
  const docs = useMemo(() => engine.getDocs(), [engine]);
  const versions = useMemo(() => engine.getVersionHistory(), [engine]);

  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<ArchModuleInfo | null>(null);

  const filteredEvents = search
    ? allEvents.filter(e => e.event_name.toLowerCase().includes(search.toLowerCase()) || e.domain.toLowerCase().includes(search.toLowerCase()))
    : allEvents;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Server className="h-4 w-4" />} label="SaaS Modules" value={modules.length} sub="Infraestrutura da plataforma" />
        <SummaryCard icon={<Zap className="h-4 w-4" />} label="Eventos" value={allEvents.length} sub={`${new Set(allEvents.map(e => e.domain)).size} domínios`} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Entregáveis" value={deliverables.length} sub={`${deliverables.filter(d => d.status === 'done').length} concluídos`} />
        <SummaryCard icon={<History className="h-4 w-4" />} label="Versões" value={versions.length} sub={`Atual: ${versions[versions.length - 1]?.version_tag}`} />
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="modules"><Boxes className="h-3.5 w-3.5 mr-1" />Módulos</TabsTrigger>
          <TabsTrigger value="dependencies"><GitBranch className="h-3.5 w-3.5 mr-1" />Dependências</TabsTrigger>
          <TabsTrigger value="events"><Zap className="h-3.5 w-3.5 mr-1" />Eventos</TabsTrigger>
          <TabsTrigger value="health"><Activity className="h-3.5 w-3.5 mr-1" />Health</TabsTrigger>
          <TabsTrigger value="deliverables"><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Entregáveis</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="h-3.5 w-3.5 mr-1" />Docs</TabsTrigger>
          <TabsTrigger value="versions"><History className="h-3.5 w-3.5 mr-1" />Versões</TabsTrigger>
        </TabsList>

        {/* Modules */}
        <TabsContent value="modules" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map(m => (
              <ModuleCard key={m.key} mod={m} onClick={() => setSelectedModule(m)} />
            ))}
          </div>
          {selectedModule && <ModuleDetail mod={selectedModule} onClose={() => setSelectedModule(null)} />}
        </TabsContent>

        {/* Dependencies */}
        <TabsContent value="dependencies">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Dependências SaaS Core</CardTitle></CardHeader>
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

        {/* Events */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Event Bus — Kernel Events</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filtrar eventos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filteredEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/50 last:border-0">
                    <Badge variant="outline" className="text-xs min-w-[100px] justify-center">{ev.domain}</Badge>
                    <code className="text-xs font-mono text-primary flex-1">{ev.event_name}</code>
                    <span className="text-xs text-muted-foreground hidden md:inline">{ev.description}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">{filteredEvents.length} eventos</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health */}
        <TabsContent value="health">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Module Health Monitor</CardTitle></CardHeader>
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
            <CardHeader className="pb-3"><CardTitle className="text-base">Entregáveis SaaS Core</CardTitle></CardHeader>
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

        {/* Docs */}
        <TabsContent value="docs">
          <div className="grid md:grid-cols-2 gap-4">
            {docs.map(doc => (
              <Card key={doc.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {doc.title}
                    <Badge variant="outline" className="text-xs">{doc.module_key}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {doc.content_md.replace(/^#+ /gm, '').replace(/\n\n/g, '\n')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Atualizado: {doc.updated_at}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Versions */}
        <TabsContent value="versions">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Histórico de Versões</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...versions].reverse().map((v, i) => (
                  <div key={i} className="relative pl-6 pb-4 border-l-2 border-primary/20 last:border-0">
                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary" />
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="default">{v.version_tag}</Badge>
                      <span className="text-sm text-muted-foreground">{v.date}</span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {v.structural_changes.map((c, j) => (
                        <li key={j} className="text-muted-foreground">• {c}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.impacted_modules.map(m => (
                        <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                      ))}
                    </div>
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

function ModuleDetail({ mod, onClose }: { mod: ArchModuleInfo; onClose: () => void }) {
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
