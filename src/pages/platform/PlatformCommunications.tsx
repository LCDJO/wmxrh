/**
 * PlatformCommunications — SuperAdmin panel for managing TenantCommunicationCenter.
 * CRUD for platform announcements with category/subcategory taxonomy.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  announcementDispatcher,
  CATEGORY_CONFIG,
  SUBCATEGORY_CONFIG,
  PRIORITY_CONFIG,
  SOURCE_CONFIG,
  SUBCATEGORIES_BY_CATEGORY,
  type PlatformAnnouncement,
  type CreateAnnouncementInput,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementSubcategory,
} from '@/domains/announcements/announcement-hub';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Megaphone,
  Plus,
  Power,
  PowerOff,
  Pencil,
  Bot,
  PenLine,
  Server,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Filters ──
type FilterCategory = 'all' | string;
type FilterSource = 'all' | string;
type FilterStatus = 'all' | 'active' | 'inactive';

const SOURCE_ICONS: Record<string, React.ElementType> = {
  manual: PenLine,
  automatic: Bot,
  system: Server,
};

export default function PlatformCommunications() {
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState<FilterCategory>('all');
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Default form
  const emptyForm: CreateAnnouncementInput = {
    title: '',
    description: '',
    category: 'system' as AnnouncementCategory,
    subcategory: null,
    priority: 'medium' as AnnouncementPriority,
    source: 'manual',
    tenant_id: null,
    action_url: null,
    action_label: null,
    is_dismissible: true,
    show_banner: false,
    starts_at: new Date().toISOString().slice(0, 16),
    expires_at: null,
    target_roles: [],
  };
  const [form, setForm] = useState<CreateAnnouncementInput>(emptyForm);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['platform_announcements', filterCat, filterSource, filterStatus],
    queryFn: () =>
      announcementDispatcher.listAll({
        category: filterCat === 'all' ? undefined : filterCat,
        source: filterSource === 'all' ? undefined : filterSource,
        isActive: filterStatus === 'all' ? undefined : filterStatus === 'active',
      }),
  });

  const createMut = useMutation({
    mutationFn: (input: CreateAnnouncementInput) => announcementDispatcher.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform_announcements'] });
      toast.success('Aviso criado com sucesso');
      setDialogOpen(false);
    },
    onError: () => toast.error('Erro ao criar aviso'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<CreateAnnouncementInput>) =>
      announcementDispatcher.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform_announcements'] });
      toast.success('Aviso atualizado');
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? announcementDispatcher.update(id, { is_active: true } as any) : announcementDispatcher.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform_announcements'] });
      toast.success('Status alterado');
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: PlatformAnnouncement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      description: a.description,
      category: a.category,
      subcategory: a.subcategory,
      priority: a.priority,
      source: a.source,
      tenant_id: a.tenant_id,
      action_url: a.action_url,
      action_label: a.action_label,
      is_dismissible: a.is_dismissible,
      show_banner: a.show_banner,
      starts_at: a.starts_at?.slice(0, 16),
      expires_at: a.expires_at?.slice(0, 16) ?? null,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.description) {
      toast.error('Título e descrição são obrigatórios');
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const availableSubs = SUBCATEGORIES_BY_CATEGORY[form.category] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Comunicação com Tenants
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie avisos institucionais, alertas de billing e notificações do sistema
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Aviso
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Origens</SelectItem>
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="ml-auto">
          {announcements.length} aviso(s)
        </Badge>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Targeting</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum aviso encontrado
                </TableCell>
              </TableRow>
            ) : announcements.map((a) => {
              const cat = CATEGORY_CONFIG[a.category] ?? CATEGORY_CONFIG.general;
              const pri = PRIORITY_CONFIG[a.priority];
              const sub = a.subcategory ? SUBCATEGORY_CONFIG[a.subcategory] : null;
              const SrcIcon = SOURCE_ICONS[a.source] ?? PenLine;

              return (
                <TableRow key={a.id} className={cn(!a.is_active && 'opacity-50')}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline" className={cn('text-[10px]', cat.color)}>
                        {cat.label}
                      </Badge>
                      {sub && (
                        <p className="text-[10px] text-muted-foreground">{sub.label}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', pri.color)}>
                      {pri.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <SrcIcon className="h-3 w-3" />
                      {SOURCE_CONFIG[a.source]?.label ?? a.source}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">
                      {a.tenant_id ? 'Específico' : 'Global'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', a.is_active ? 'bg-green-500' : 'bg-muted-foreground')} />
                      <span className="text-xs">{a.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => toggleMut.mutate({ id: a.id, active: !a.is_active })}
                      >
                        {a.is_active ? <PowerOff className="h-3.5 w-3.5 text-destructive" /> : <Power className="h-3.5 w-3.5 text-green-600" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Aviso' : 'Novo Aviso Institucional'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Manutenção programada dia 25/02"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes do aviso..."
                rows={3}
              />
            </div>

            {/* Category + Subcategory */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as AnnouncementCategory, subcategory: null })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['billing', 'fiscal', 'system', 'security', 'compliance', 'general'].map(k => (
                      <SelectItem key={k} value={k}>{CATEGORY_CONFIG[k]?.label ?? k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Subcategoria</Label>
                <Select
                  value={form.subcategory ?? 'none'}
                  onValueChange={(v) => setForm({ ...form, subcategory: v === 'none' ? null : v as AnnouncementSubcategory })}
                  disabled={availableSubs.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {availableSubs.map(s => (
                      <SelectItem key={s!} value={s!}>{SUBCATEGORY_CONFIG[s!]?.label ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as AnnouncementPriority })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Targeting</Label>
                <Select
                  value={form.tenant_id ?? 'global'}
                  onValueChange={(v) => setForm({ ...form, tenant_id: v === 'global' ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">🌐 Global (todos os tenants)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action URL */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>URL de Ação (opcional)</Label>
                <Input
                  value={form.action_url ?? ''}
                  onChange={(e) => setForm({ ...form, action_url: e.target.value || null })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Label do Botão</Label>
                <Input
                  value={form.action_label ?? ''}
                  onChange={(e) => setForm({ ...form, action_label: e.target.value || null })}
                  placeholder="Ver mais"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at?.slice(0, 16) ?? ''}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiração (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at?.slice(0, 16) ?? ''}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value || null })}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.show_banner}
                  onCheckedChange={(v) => setForm({ ...form, show_banner: v })}
                />
                <Label className="text-sm">Mostrar Banner</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_dismissible}
                  onCheckedChange={(v) => setForm({ ...form, is_dismissible: v })}
                />
                <Label className="text-sm">Dispensável</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? 'Salvar' : 'Criar Aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
