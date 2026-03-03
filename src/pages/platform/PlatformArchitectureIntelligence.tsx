/**
 * Platform Architecture Intelligence Center
 *
 * Tabs: Modules | Dependencies | Events | Health | Deliverables | Docs | Versions
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
  History, Search, ArrowRight, Shield, Circle,
} from 'lucide-react';

const statusColor: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
};

const deliverableVariant: Record<DeliverableStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  done: 'default',
  in_progress: 'secondary',
  planned: 'outline',
  blocked: 'destructive',
};

export default function PlatformArchitectureIntelligence() {
  const engine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const modules = useMemo(() => engine.getModules(), [engine]);
  const edges = useMemo(() => engine.getDependencyEdges(), [engine]);
  const events = useMemo(() => engine.getEventMap(), [engine]);
  const deliverables = useMemo(() => engine.getDeliverables(), [engine]);
  const docs = useMemo(() => engine.getDocs(), [engine]);
  const versions = useMemo(() => engine.getVersionHistory(), [engine]);

  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<ArchModuleInfo | null>(null);

  const saasModules = modules.filter(m => m.category === 'platform');
  const tenantModules = modules.filter(m => m.category === 'domain');

  const filteredEvents = search
    ? events.filter(e => e.event_name.toLowerCase().includes(search.toLowerCase()) || e.domain.toLowerCase().includes(search.toLowerCase()))
    : events;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
          Architecture Intelligence Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão arquitetural, dependências, eventos, monitoramento e documentação viva da plataforma
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Boxes className="h-4 w-4" />} label="Módulos" value={modules.length} sub={`${saasModules.length} SaaS · ${tenantModules.length} Tenant`} />
        <SummaryCard icon={<Zap className="h-4 w-4" />} label="Eventos" value={events.length} sub={`${new Set(events.map(e => e.domain)).size} domínios`} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Entregáveis" value={deliverables.length} sub={`${deliverables.filter(d => d.status === 'done').length} concluídos`} />
        <SummaryCard icon={<History className="h-4 w-4" />} label="Versões Arquit." value={versions.length} sub={`Atual: ${versions[versions.length - 1]?.version_tag}`} />
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

        {/* ── Modules Tab ── */}
        <TabsContent value="modules" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" /> SaaS Core Modules
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {saasModules.map(m => (
                <ModuleCard key={m.key} mod={m} onClick={() => setSelectedModule(m)} />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Boxes className="h-4 w-4" /> Tenant Feature Modules
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tenantModules.map(m => (
                <ModuleCard key={m.key} mod={m} onClick={() => setSelectedModule(m)} />
              ))}
            </div>
          </div>

          {/* Module Detail */}
          {selectedModule && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedModule.label}</CardTitle>
                  <button onClick={() => setSelectedModule(null)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{selectedModule.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedModule.version_tag}</Badge>
                  <Badge variant="secondary">{selectedModule.category}</Badge>
                  <Badge className={`${statusColor[selectedModule.status]} text-white`}>{selectedModule.status}</Badge>
                </div>
                {selectedModule.dependencies.length > 0 && (
                  <div>
                    <span className="font-medium">Dependências:</span>
                    <ul className="mt-1 space-y-1">
                      {selectedModule.dependencies.map((d, i) => (
                        <li key={i} className="flex items-center gap-2 text-muted-foreground">
                          <ArrowRight className="h-3 w-3" /> {d.required_module_id} ≥ v{d.required_version.major}.{d.required_version.minor}.{d.required_version.patch}
                          {d.compatibility_note && <span className="text-xs">({d.compatibility_note})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedModule.deliverables.length > 0 && (
                  <div>
                    <span className="font-medium">Entregáveis:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedModule.deliverables.map(d => (
                        <Badge key={d.id} variant={deliverableVariant[d.status]}>{d.title}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedModule.changelog_summary && (
                  <div>
                    <span className="font-medium">Changelog:</span>
                    <p className="text-muted-foreground mt-1">{selectedModule.changelog_summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Dependencies Tab ── */}
        <TabsContent value="dependencies">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grafo de Dependências</CardTitle>
            </CardHeader>
            <CardContent>
              {edges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma dependência declarada entre módulos.</p>
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
                      {e.note && <span className="text-xs text-muted-foreground hidden lg:inline">{e.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Events Tab ── */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Event Bus — Kernel Events</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar eventos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
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
              <p className="text-xs text-muted-foreground mt-3">{filteredEvents.length} eventos de {events.length} total</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Health Tab ── */}
        <TabsContent value="health">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Module Health Monitor</CardTitle>
            </CardHeader>
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

        {/* ── Deliverables Tab ── */}
        <TabsContent value="deliverables">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Entregáveis Esperados</CardTitle>
            </CardHeader>
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

        {/* ── Docs Tab ── */}
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
                  <p className="text-xs text-muted-foreground mt-3">
                    Atualizado: {doc.updated_at} {doc.author && `por ${doc.author}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Versions Tab ── */}
        <TabsContent value="versions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Versões Arquiteturais</CardTitle>
            </CardHeader>
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

// ── Sub-components ──

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ModuleCard({ mod, onClick }: { mod: ArchModuleInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-accent/5 transition-colors w-full"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{mod.label}</span>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${statusColor[mod.status]}`} />
          <Badge variant="outline" className="text-xs">{mod.version_tag}</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{mod.description}</p>
    </button>
  );
}
