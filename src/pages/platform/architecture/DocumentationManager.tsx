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
import { useState, useMemo, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileText, Edit3, CheckCircle, PlusCircle, BookOpen,
  Lightbulb, ClipboardList, Save, Search, Clock,
  RefreshCw, Tag, ArrowUpCircle, Pencil,
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

  // ── Batch update handler (from "Atualizar Documentação" button) ──
  const handleBatchUpdate = useCallback(async (update: {
    completedDeliverables: string[];
    progressNote: string;
    newVersionTag: string;
    moduleKey: string;
  }) => {
    const mod = modules.find(m => m.key === update.moduleKey);
    const modLabel = mod?.label ?? update.moduleKey;

    for (const dId of update.completedDeliverables) {
      const d = allDeliverables.find(x => x.id === dId);
      await addToChangelog('deliverable_completed', update.moduleKey, `Entregável "${d?.title ?? dId}" marcado como concluído`);
    }

    if (update.progressNote.trim()) {
      await addToChangelog('progress_registered', update.moduleKey, `Progresso: ${update.progressNote}`);
    }

    if (update.newVersionTag.trim()) {
      await addToChangelog('version_updated', update.moduleKey, `Versão arquitetural atualizada para ${update.newVersionTag} — ${modLabel}`);
    }

    toast.success(`Documentação de ${modLabel} atualizada com sucesso`);
  }, [modules, allDeliverables]);

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
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {localChangelog.length} alterações na sessão
          </Badge>
          <UpdateDocumentationDialog
            modules={modules}
            allDeliverables={allDeliverables}
            selectedModule={selectedModule}
            onApply={handleBatchUpdate}
          />
        </div>
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
  const [localUpdates, setLocalUpdates] = useState<Record<string, Partial<ArchDeliverable>>>({});
  const [localDeliverables, setLocalDeliverables] = useState<ArchDeliverable[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const allItems = [...deliverables, ...localDeliverables];

  const handleStatusChange = (id: string, newStatus: DeliverableStatus) => {
    setLocalUpdates(prev => ({ ...prev, [id]: { ...prev[id], status: newStatus } }));
    onUpdate(id, newStatus);
  };

  const handleOwnerChange = (id: string, owner: string) => {
    setLocalUpdates(prev => ({ ...prev, [id]: { ...prev[id], owner } }));
  };

  const handleDueDateChange = (id: string, due_date: string) => {
    setLocalUpdates(prev => ({ ...prev, [id]: { ...prev[id], due_date } }));
  };

  const handleAddDeliverable = () => {
    if (!newTitle.trim()) return;
    const d: ArchDeliverable = {
      id: `d-${crypto.randomUUID().slice(0, 8)}`,
      title: newTitle,
      description: newDesc || undefined,
      status: 'planned',
      module_key: moduleKey,
      owner: newOwner || undefined,
      due_date: newDueDate || undefined,
    };
    setLocalDeliverables(prev => [...prev, d]);
    onUpdate(d.id, 'planned');
    setNewTitle('');
    setNewDesc('');
    setNewOwner('');
    setNewDueDate('');
    setAddOpen(false);
    toast.success('Entregável adicionado');
  };

  const allStatuses: DeliverableStatus[] = ['planned', 'in_progress', 'done', 'blocked'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Entregáveis do Módulo</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><PlusCircle className="h-4 w-4 mr-1" /> Novo Entregável</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Entregável</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título do entregável" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <Textarea placeholder="Descrição (opcional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                  <Input placeholder="ex: security-team" value={newOwner} onChange={e => setNewOwner(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Data Prevista</label>
                  <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddDeliverable} disabled={!newTitle.trim()}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {allItems.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum entregável cadastrado</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {allItems.map(d => {
            const updates = localUpdates[d.id] ?? {};
            const currentStatus = (updates.status as DeliverableStatus) ?? d.status;
            const currentOwner = updates.owner ?? d.owner ?? '';
            const currentDueDate = updates.due_date ?? d.due_date ?? '';
            const isOverdue = currentDueDate && currentStatus !== 'done' && new Date(currentDueDate) < new Date();

            return (
              <Card key={d.id} className={isOverdue ? 'border-destructive/40' : ''}>
                <CardContent className="py-4 space-y-3">
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
                  <div className="flex items-center gap-4 pl-7">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Responsável:</span>
                      <Input
                        value={currentOwner}
                        onChange={e => handleOwnerChange(d.id, e.target.value)}
                        placeholder="Definir responsável"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Prazo:</span>
                      <Input
                        type="date"
                        value={currentDueDate}
                        onChange={e => handleDueDateChange(d.id, e.target.value)}
                        className="h-7 text-xs w-[140px]"
                      />
                      {isOverdue && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
                    </div>
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

// ── "Atualizar Documentação" structured editor dialog ──

interface UpdateDialogProps {
  modules: ArchModuleInfo[];
  allDeliverables: ArchDeliverable[];
  selectedModule: string;
  onApply: (update: {
    completedDeliverables: string[];
    progressNote: string;
    newVersionTag: string;
    moduleKey: string;
  }) => void;
}

function UpdateDocumentationDialog({ modules, allDeliverables, selectedModule, onApply }: UpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [moduleKey, setModuleKey] = useState(selectedModule);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [progressNote, setProgressNote] = useState('');
  const [newVersion, setNewVersion] = useState('');

  const moduleDeliverables = allDeliverables.filter(d => d.module_key === moduleKey);
  const pendingDeliverables = moduleDeliverables.filter(d => d.status !== 'done');
  const currentModule = modules.find(m => m.key === moduleKey);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setModuleKey(selectedModule);
      setCompletedIds(new Set());
      setProgressNote('');
      setNewVersion(currentModule?.version_tag ? bumpPatch(currentModule.version_tag) : '');
    }
  };

  const toggleDeliverable = (id: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    onApply({
      completedDeliverables: Array.from(completedIds),
      progressNote,
      newVersionTag: newVersion,
      moduleKey,
    });
    setOpen(false);
  };

  const hasChanges = completedIds.size > 0 || progressNote.trim() || newVersion.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar Documentação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Atualizar Documentação do Módulo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Module selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Módulo</label>
            <Select value={moduleKey} onValueChange={setModuleKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modules.map(m => (
                  <SelectItem key={m.key} value={m.key}>
                    <div className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <Badge variant="outline" className="text-[10px]">{m.domain}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Section 1: Mark deliverables as done */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Marcar Entregáveis como Concluídos</h3>
            </div>
            {pendingDeliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-6">Todos os entregáveis já estão concluídos ✓</p>
            ) : (
              <div className="space-y-2 pl-6">
                {pendingDeliverables.map(d => (
                  <label
                    key={d.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={completedIds.has(d.id)}
                      onCheckedChange={() => toggleDeliverable(d.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{d.title}</span>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      <Badge variant="outline" className="text-[10px] mt-1">{d.status}</Badge>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Section 2: Register progress */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Registrar Progresso</h3>
            </div>
            <Textarea
              placeholder="Descreva o progresso realizado, decisões tomadas ou observações relevantes..."
              value={progressNote}
              onChange={e => setProgressNote(e.target.value)}
              rows={4}
              className="ml-6"
            />
          </div>

          <Separator />

          {/* Section 3: Update architectural version */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Atualizar Versão Arquitetural</h3>
            </div>
            <div className="flex items-center gap-3 pl-6">
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Atual:</span>
                <Badge variant="outline">{currentModule?.version_tag ?? '—'}</Badge>
              </div>
              <span className="text-muted-foreground">→</span>
              <Input
                placeholder="ex: v1.1.0"
                value={newVersion}
                onChange={e => setNewVersion(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          {/* Summary */}
          {hasChanges && (
            <>
              <Separator />
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-3">
                  <h4 className="text-xs font-semibold text-primary mb-2">Resumo das Alterações</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {completedIds.size > 0 && (
                      <li>• {completedIds.size} entregável(is) marcado(s) como concluído(s)</li>
                    )}
                    {progressNote.trim() && <li>• Nota de progresso registrada</li>}
                    {newVersion.trim() && (
                      <li>• Versão atualizada: {currentModule?.version_tag ?? '—'} → {newVersion}</li>
                    )}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Todas as alterações serão registradas no ArchitectureChangeLog
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleApply} disabled={!hasChanges} className="gap-2">
            <Save className="h-4 w-4" />
            Aplicar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function bumpPatch(tag: string): string {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return tag;
  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
