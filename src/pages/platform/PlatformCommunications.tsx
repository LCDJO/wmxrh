/**
 * PlatformCommunications — SuperAdmin panel for TenantCommunicationCenter.
 * CRUD for TenantAnnouncements with alert_type/severity/blocking_level.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  announcementDispatcher,
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  BLOCKING_LEVEL_CONFIG,
  type TenantAnnouncement,
  type CreateAnnouncementInput,
  type AlertType,
  type Severity,
  type BlockingLevel,
} from '@/domains/announcements/announcement-hub';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Megaphone, Plus, Trash2, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PlatformCommunications() {
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm: CreateAnnouncementInput = {
    title: '',
    message: '',
    alert_type: 'system',
    severity: 'info',
    blocking_level: 'none',
    tenant_id: null,
    action_url: null,
    is_dismissible: true,
    start_at: new Date().toISOString().slice(0, 16),
    end_at: null,
  };
  const [form, setForm] = useState<CreateAnnouncementInput>(emptyForm);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['tenant_announcements', filterType, filterSeverity],
    queryFn: () =>
      announcementDispatcher.listAll({
        alert_type: filterType === 'all' ? undefined : filterType,
        severity: filterSeverity === 'all' ? undefined : filterSeverity,
      }),
  });

  const createMut = useMutation({
    mutationFn: (input: CreateAnnouncementInput) => announcementDispatcher.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_announcements'] });
      toast.success('Aviso criado com sucesso');
      setDialogOpen(false);
    },
    onError: () => toast.error('Erro ao criar aviso'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<CreateAnnouncementInput>) =>
      announcementDispatcher.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_announcements'] });
      toast.success('Aviso atualizado');
      setDialogOpen(false);
      setEditingId(null);
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => announcementDispatcher.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_announcements'] });
      toast.success('Aviso removido');
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: TenantAnnouncement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      message: a.message,
      alert_type: a.alert_type,
      severity: a.severity,
      blocking_level: a.blocking_level,
      tenant_id: a.tenant_id,
      action_url: a.action_url,
      is_dismissible: a.is_dismissible,
      start_at: a.start_at?.slice(0, 16),
      end_at: a.end_at?.slice(0, 16) ?? null,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.message) {
      toast.error('Título e mensagem são obrigatórios');
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...form });
    } else {
      createMut.mutate(form);
    }
  };

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
            Avisos institucionais e alertas do SaaS para tenants
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Aviso
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {Object.entries(ALERT_TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
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
              <TableHead>Tipo</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Bloqueio</TableHead>
              <TableHead>Targeting</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum aviso encontrado
                </TableCell>
              </TableRow>
            ) : announcements.map((a) => {
              const type = ALERT_TYPE_CONFIG[a.alert_type];
              const sev = SEVERITY_CONFIG[a.severity];
              const block = BLOCKING_LEVEL_CONFIG[a.blocking_level];
              const now = new Date();
              const isExpired = a.end_at && new Date(a.end_at) < now;
              const isActive = new Date(a.start_at) <= now && !isExpired;

              return (
                <TableRow key={a.id} className={cn(isExpired && 'opacity-50')}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{a.message}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', type.color)}>
                      {type.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', sev.color)}>
                      {sev.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{block.label}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">
                      {a.tenant_id ? 'Específico' : '🌐 Global'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-2 w-2 rounded-full', isActive ? 'bg-green-500' : 'bg-muted-foreground')} />
                        {format(new Date(a.start_at), "dd/MM/yy", { locale: ptBR })}
                        {a.end_at && ` → ${format(new Date(a.end_at), "dd/MM/yy", { locale: ptBR })}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteMut.mutate(a.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
            <DialogTitle>{editingId ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Manutenção programada dia 25/02"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem *</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Detalhes do aviso..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Alerta</Label>
                <Select
                  value={form.alert_type}
                  onValueChange={(v) => setForm({ ...form, alert_type: v as AlertType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ALERT_TYPE_CONFIG).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Severidade</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v as Severity })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_CONFIG).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Nível de Bloqueio</Label>
                <Select
                  value={form.blocking_level ?? 'none'}
                  onValueChange={(v) => setForm({ ...form, blocking_level: v as BlockingLevel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BLOCKING_LEVEL_CONFIG).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              <div className="space-y-1.5">
                <Label>URL de Ação (opcional)</Label>
                <Input
                  value={form.action_url ?? ''}
                  onChange={(e) => setForm({ ...form, action_url: e.target.value || null })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={form.start_at?.slice(0, 16) ?? ''}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fim (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={form.end_at?.slice(0, 16) ?? ''}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value || null })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={form.is_dismissible}
                onCheckedChange={(v) => setForm({ ...form, is_dismissible: v })}
              />
              <Label className="text-sm">Dispensável pelo usuário</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? 'Salvar' : 'Criar Aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
