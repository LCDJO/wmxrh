/**
 * DocumentationManager — Living Documentation for Architecture Intelligence Center
 *
 * Features:
 * - Edit module descriptions
 * - Register architectural decisions (ADRs)
 * - Update deliverables status
 * - Add technical notes
 * - All changes generate ArchitectureChangeLog entries
 */
import { useState, useMemo } from 'react';
import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import { ChangeLogger } from '@/domains/platform-versioning/change-logger';
import type { ArchModuleInfo, ArchDeliverable, ArchDocEntry, DeliverableStatus } from '@/domains/architecture-intelligence/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, Edit3, CheckCircle, PlusCircle, BookOpen,
  Lightbulb, ClipboardList, Save, Search, Clock,
} from 'lucide-react';

const STATUS_COLORS: Record<DeliverableStatus, string> = {
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  planned: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  blocked: 'bg-red-500/10 text-red-400 border-red-500/30',
};

interface ChangeLogItem {
  id: string;
  type: string;
  module: string;
  description: string;
  timestamp: string;
  author: string;
}

export default function DocumentationManager() {
  const engine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const changeLogger = useMemo(() => new ChangeLogger(), []);
  const modules = engine.getModules();
  const allDocs = engine.getDocs();
  const allDeliverables = engine.getDeliverables();

  const [selectedModule, setSelectedModule] = useState<string>(modules[0]?.key ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [localChangelog, setLocalChangelog] = useState<ChangeLogItem[]>([]);

  // ── Filtered data ──
  const currentModule = modules.find(m => m.key === selectedModule) ?? null;
  const moduleDocs = allDocs.filter(d => d.module_key === selectedModule || d.module_key === '__platform__');
  const moduleDeliverables = allDeliverables.filter(d => d.module_key === selectedModule);

  const filteredModules = modules.filter(m =>
    m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Changelog helper ──
  const addToChangelog = async (type: string, moduleKey: string, description: string) => {
    const entry: ChangeLogItem = {
      id: crypto.randomUUID(),
      type,
      module: moduleKey,
      description,
      timestamp: new Date().toISOString(),
      author: 'platform-architect',
    };
    setLocalChangelog(prev => [entry, ...prev]);

    try {
      await changeLogger.log({
        module_id: moduleKey,
        entity_type: 'architecture_doc',
        entity_id: entry.id,
        change_type: 'updated',
        version_tag: currentModule?.version_tag ?? 'v1.0.0',
        payload_diff: { type, description },
        changed_by: 'platform-architect',
      });
    } catch {
      // Silent — local changelog still works
    }

    toast.success('Alteração registrada no changelog');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Documentação Viva</h2>
            <p className="text-sm text-muted-foreground">
              Edite descrições, registre decisões, atualize entregáveis e notas técnicas
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {localChangelog.length} alterações na sessão
        </Badge>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Module selector sidebar */}
        <div className="col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar módulo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {filteredModules.map(m => (
              <button
                key={m.key}
                onClick={() => setSelectedModule(m.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedModule === m.key
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{m.label}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {m.domain}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-9">
          {currentModule ? (
            <Tabs defaultValue="description" className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="description" className="gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" /> Descrição
                </TabsTrigger>
                <TabsTrigger value="decisions" className="gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Decisões
                </TabsTrigger>
                <TabsTrigger value="deliverables" className="gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Entregáveis
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Notas
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Description ── */}
              <TabsContent value="description">
                <ModuleDescriptionEditor
                  module={currentModule}
                  onSave={(desc) => addToChangelog('description_update', currentModule.key, `Descrição atualizada: ${desc.substring(0, 80)}...`)}
                />
              </TabsContent>

              {/* ── Tab: Architectural Decisions ── */}
              <TabsContent value="decisions">
                <ArchitecturalDecisions
                  module={currentModule}
                  docs={moduleDocs}
                  onAdd={(title) => addToChangelog('adr_added', currentModule.key, `ADR registrada: ${title}`)}
                />
              </TabsContent>

              {/* ── Tab: Deliverables ── */}
              <TabsContent value="deliverables">
                <DeliverableManager
                  deliverables={moduleDeliverables}
                  moduleKey={currentModule.key}
                  onUpdate={(id, status) => addToChangelog('deliverable_updated', currentModule.key, `Entregável "${id}" → ${status}`)}
                />
              </TabsContent>

              {/* ── Tab: Technical Notes ── */}
              <TabsContent value="notes">
                <TechnicalNotes
                  module={currentModule}
                  onAdd={(title) => addToChangelog('note_added', currentModule.key, `Nota técnica: ${title}`)}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um módulo</CardContent></Card>
          )}
        </div>
      </div>

      {/* Changelog panel */}
      {localChangelog.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              ArchitectureChangeLog — Sessão Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {localChangelog.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 text-sm border-l-2 border-primary/30 pl-3 py-1">
                  <Badge variant="outline" className="text-[10px] shrink-0">{entry.type}</Badge>
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{entry.description}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {entry.module} · {new Date(entry.timestamp).toLocaleTimeString('pt-BR')} · {entry.author}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ──

function ModuleDescriptionEditor({ module, onSave }: { module: ArchModuleInfo; onSave: (desc: string) => void }) {
  const [description, setDescription] = useState(module.architecture_description);
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onSave(description);
    setEditing(false);
    toast.success('Descrição salva');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Descrição Arquitetural — {module.label}</CardTitle>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">Domain:</span> <Badge variant="outline">{module.domain}</Badge></div>
          <div><span className="text-muted-foreground">Version:</span> <Badge variant="outline">{module.version_tag}</Badge></div>
          <div><span className="text-muted-foreground">Owner:</span> <Badge variant="outline">{module.owner}</Badge></div>
          <div><span className="text-muted-foreground">SLA Tier:</span> <Badge variant="outline">{module.sla.tier}</Badge></div>
          <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{module.lifecycle_status}</Badge></div>
          <div><span className="text-muted-foreground">Uptime:</span> <Badge variant="outline">{module.sla.uptime_target}</Badge></div>
        </div>
        {editing ? (
          <div className="space-y-3">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDescription(module.architecture_description); }}>Cancelar</Button>
              <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ArchitecturalDecisions({ module, docs, onAdd }: { module: ArchModuleInfo; docs: ArchDocEntry[]; onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [localDocs, setLocalDocs] = useState<ArchDocEntry[]>([]);

  const allDocs = [...docs, ...localDocs];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newDoc: ArchDocEntry = {
      id: `adr-${crypto.randomUUID().slice(0, 8)}`,
      title,
      module_key: module.key,
      content_md: content,
      updated_at: new Date().toISOString(),
      author: 'platform-architect',
    };
    setLocalDocs(prev => [newDoc, ...prev]);
    onAdd(title);
    setTitle('');
    setContent('');
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Decisões Arquiteturais (ADRs)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1" /> Nova ADR</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Decisão Arquitetural</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título da decisão" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Contexto, decisão e consequências (Markdown)" value={content} onChange={e => setContent(e.target.value)} rows={8} className="font-mono text-sm" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={!title.trim()}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-3">
        {allDocs.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma decisão registrada para este módulo</CardContent></Card>
        ) : (
          allDocs.map(doc => (
            <Card key={doc.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span className="font-medium text-sm text-foreground">{doc.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {doc.content_md && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-3 max-h-40 overflow-y-auto">{doc.content_md}</pre>
                )}
                {doc.author && <span className="text-xs text-muted-foreground">por {doc.author}</span>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function DeliverableManager({ deliverables, moduleKey, onUpdate }: { deliverables: ArchDeliverable[]; moduleKey: string; onUpdate: (id: string, status: DeliverableStatus) => void }) {
  const [localUpdates, setLocalUpdates] = useState<Record<string, DeliverableStatus>>({});

  const handleStatusChange = (id: string, newStatus: DeliverableStatus) => {
    setLocalUpdates(prev => ({ ...prev, [id]: newStatus }));
    onUpdate(id, newStatus);
  };

  const allStatuses: DeliverableStatus[] = ['planned', 'in_progress', 'done', 'blocked'];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">Entregáveis do Módulo</h3>
      {deliverables.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum entregável cadastrado</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {deliverables.map(d => {
            const currentStatus = localUpdates[d.id] ?? d.status;
            return (
              <Card key={d.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className={`h-4 w-4 ${currentStatus === 'done' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                      <div>
                        <span className="text-sm font-medium text-foreground">{d.title}</span>
                        {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      </div>
                    </div>
                    <Select value={currentStatus} onValueChange={(v) => handleStatusChange(d.id, v as DeliverableStatus)}>
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allStatuses.map(s => (
                          <SelectItem key={s} value={s}>
                            <Badge className={`${STATUS_COLORS[s]} text-[10px]`}>{s}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TechnicalNotes({ module, onAdd }: { module: ArchModuleInfo; onAdd: (title: string) => void }) {
  const [notes, setNotes] = useState<Array<{ id: string; title: string; content: string; created_at: string }>>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    setNotes(prev => [{
      id: crypto.randomUUID().slice(0, 8),
      title,
      content,
      created_at: new Date().toISOString(),
    }, ...prev]);
    onAdd(title);
    setTitle('');
    setContent('');
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Notas Técnicas</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1" /> Nova Nota</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Nota Técnica</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título da nota" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Conteúdo técnico (Markdown)" value={content} onChange={e => setContent(e.target.value)} rows={6} className="font-mono text-sm" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={!title.trim()}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {notes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma nota técnica registrada nesta sessão</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <Card key={n.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm text-foreground">{n.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleTimeString('pt-BR')}</span>
                </div>
                {n.content && <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-3">{n.content}</pre>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
