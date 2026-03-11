/**
 * DisplayMapPanel — Cross-tenant display management matching tenant-side card layout.
 * Shows all displays across tenants with pairing, disconnect, preview, edit, delete.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  Monitor, Tv, Plus, Link2, Power, Eye, Pencil, Trash2,
  CheckCircle2, AlertTriangle, WifiOff, RotateCw, QrCode,
  RefreshCw, Building2, Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DISPLAY_TIPOS } from '@/modules/live-display';
import type { DisplayBoardTipo } from '@/modules/live-display';
import type { Database } from '@/integrations/supabase/types';
import LiveDisplayPreview from '@/components/tv/LiveDisplayPreview';

type LiveDisplay = Database['public']['Tables']['live_displays']['Row'];

interface DisplayWithTenant extends LiveDisplay {
  tenant_name?: string;
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  active: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500' },
  paused: { label: 'Pausado', icon: AlertTriangle, color: 'text-amber-500' },
  disconnected: { label: 'Desconectado', icon: WifiOff, color: 'text-muted-foreground' },
};

export default function DisplayMapPanel() {
  const { toast } = useToast();
  const [displays, setDisplays] = useState<DisplayWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');

  // Pairing dialog
  const [showPairing, setShowPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingDisplayId, setPairingDisplayId] = useState('');
  const [pairing, setPairing] = useState(false);

  // Preview
  const [previewDisplay, setPreviewDisplay] = useState<DisplayWithTenant | null>(null);

  // Edit
  const [editDisplay, setEditDisplay] = useState<DisplayWithTenant | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<DisplayBoardTipo>('executivo');
  const [formRotacao, setFormRotacao] = useState(false);
  const [formIntervalo, setFormIntervalo] = useState(30);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('live_displays')
      .select('*, tenants:tenant_id(name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[DisplayMapPanel]', error.message);
      setDisplays([]);
    } else {
      setDisplays(
        (data ?? []).map((d: any) => ({ ...d, tenant_name: d.tenants?.name ?? 'Sem tenant' }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('saas-live-displays')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_displays' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const tenantNames = [...new Set(displays.map(d => d.tenant_name ?? ''))].sort();

  const filtered = displays.filter(d => {
    if (filterTenant !== '__all__' && d.tenant_name !== filterTenant) return false;
    if (filterStatus !== '__all__' && d.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!d.nome.toLowerCase().includes(q) && !(d.tenant_name ?? '').toLowerCase().includes(q) && !d.tipo.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const disconnectDisplay = async (displayId: string) => {
    await supabase.from('live_display_tokens').update({ status: 'expired' }).eq('display_id', displayId).eq('status', 'active');
    await supabase.from('live_displays').update({ status: 'disconnected' }).eq('id', displayId);
    toast({ title: 'Display desconectado remotamente' });
    load();
  };

  const deleteDisplay = async (id: string) => {
    await supabase.from('live_displays').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setDisplays(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Display removido' });
  };

  const confirmPairing = async () => {
    if (!pairingCode.trim() || !pairingDisplayId) return;
    setPairing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('display-pair-confirm', {
        body: { pairing_code: pairingCode.toUpperCase(), display_id: pairingDisplayId },
      });
      if (error || result?.error) {
        toast({ title: 'Erro ao parear', description: result?.error ?? error?.message, variant: 'destructive' });
      } else {
        toast({ title: 'Display pareado com sucesso!' });
        setShowPairing(false);
        setPairingCode('');
        setPairingDisplayId('');
        load();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
    setPairing(false);
  };

  const openEdit = (d: DisplayWithTenant) => {
    setEditDisplay(d);
    setFormNome(d.nome);
    setFormTipo(d.tipo as DisplayBoardTipo);
    setFormRotacao(d.rotacao_automatica ?? false);
    setFormIntervalo(d.intervalo_rotacao ?? 30);
  };

  const handleEdit = async () => {
    if (!editDisplay || !formNome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('live_displays').update({
      nome: formNome.trim(),
      tipo: formTipo,
      rotacao_automatica: formRotacao,
      intervalo_rotacao: formIntervalo,
    }).eq('id', editDisplay.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Display atualizado!' });
      setEditDisplay(null);
      load();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">{displays.length} displays</Badge>
          <Badge variant="outline" className="text-xs text-emerald-500">{displays.filter(d => d.status === 'active').length} conectados</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPairing(true)} className="gap-2">
            <Link2 className="h-4 w-4" /> Parear Display
          </Button>
        </div>
      </div>

      {/* Pairing flow info */}
      <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
        <QrCode className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Fluxo de pareamento</p>
          <p className="text-xs text-muted-foreground mt-1">
            1. A TV acessa <span className="font-mono text-primary">/display</span> e exibe um QR Code com código de 6 dígitos.{' '}
            2. Escaneie o QR Code com seu celular ou insira o código aqui no painel.{' '}
            3. Selecione o display e confirme o pareamento.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar display..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterTenant} onValueChange={setFilterTenant}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Todos os tenants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os tenants</SelectItem>
            {tenantNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            <SelectItem value="active">Conectado</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="disconnected">Desconectado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Display grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-48" /></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Monitor className="h-12 w-12 opacity-40" />
            <p className="text-sm">Nenhum display encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(display => {
            const status = STATUS_MAP[display.status] ?? STATUS_MAP.disconnected;
            const StatusIcon = status.icon;
            const tipoInfo = DISPLAY_TIPOS[display.tipo as DisplayBoardTipo];

            return (
              <Card key={display.id} className="group hover:border-primary/30 transition-colors">
                <CardContent className="p-5 space-y-3">
                  {/* Header: name + status */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-foreground leading-tight">{display.nome}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                    </div>
                  </div>

                  {/* Tenant */}
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{display.tenant_name}</span>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{tipoInfo?.label ?? display.tipo}</Badge>
                    {display.rotacao_automatica && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <RotateCw className="h-3 w-3" /> {display.intervalo_rotacao}s
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground">{tipoInfo?.description ?? display.tipo}</p>

                  {/* Pairing date */}
                  {display.last_seen_at ? (
                    <p className="text-xs text-muted-foreground">
                      Pareado em: {format(new Date(display.last_seen_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-500">Não pareado</p>
                  )}

                  {/* Actions: Parear + Desconectar */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 flex-1"
                        onClick={() => { setPairingDisplayId(display.id); setShowPairing(true); }}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Parear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 flex-1 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                        onClick={() => disconnectDisplay(display.id)}
                        disabled={display.status === 'disconnected'}
                      >
                        <Power className="h-3.5 w-3.5" /> Desconectar
                      </Button>
                    </div>
                    <Separator />
                    <TooltipProvider delayDuration={200}>
                      <div className="flex items-center justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg hover:bg-accent hover:border-primary/30 transition-all" onClick={() => setPreviewDisplay(display)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Conteúdo</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg hover:bg-accent hover:border-primary/30 transition-all" onClick={() => openEdit(display)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Editar</p></TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Excluir</p></TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir display?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O display <strong>{display.nome}</strong> do tenant <strong>{display.tenant_name}</strong> será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteDisplay(display.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pairing Dialog */}
      <Dialog open={showPairing} onOpenChange={(v) => { setShowPairing(v); if (!v) { setPairingCode(''); setPairingDisplayId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Parear Display
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código de pareamento (6 dígitos)</Label>
              <Input
                placeholder="Ex: A3K7P2"
                value={pairingCode}
                onChange={e => setPairingCode(e.target.value.toUpperCase().slice(0, 6))}
                className="text-center text-lg font-mono tracking-widest"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">Exibido na tela da TV em /display</p>
            </div>
            <div>
              <Label>Selecione o Display</Label>
              <Select value={pairingDisplayId} onValueChange={setPairingDisplayId}>
                <SelectTrigger><SelectValue placeholder="Escolha um display" /></SelectTrigger>
                <SelectContent>
                  {displays.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.tenant_name} — {d.nome} ({DISPLAY_TIPOS[d.tipo as DisplayBoardTipo]?.label ?? d.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPairing(false)}>Cancelar</Button>
            <Button onClick={confirmPairing} disabled={pairing || pairingCode.length < 6 || !pairingDisplayId} className="gap-2">
              {pairing ? 'Pareando...' : 'Confirmar Pareamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDisplay} onOpenChange={(v) => { if (!v) setPreviewDisplay(null); }}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Pré-visualização — {previewDisplay?.nome}
              <Badge variant="secondary" className="ml-2 text-xs">
                {previewDisplay ? (DISPLAY_TIPOS[previewDisplay.tipo as DisplayBoardTipo]?.label ?? previewDisplay.tipo) : ''}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />{previewDisplay?.tenant_name}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full rounded-b-lg overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
            {previewDisplay && (
              <LiveDisplayPreview tipo={previewDisplay.tipo} displayName={previewDisplay.nome} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDisplay} onOpenChange={(v) => { if (!v) setEditDisplay(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Display
              <Badge variant="outline" className="text-xs ml-2">
                <Building2 className="h-3 w-3 mr-1" />{editDisplay?.tenant_name}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={formNome} onChange={e => setFormNome(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={formTipo} onValueChange={v => setFormTipo(v as DisplayBoardTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DISPLAY_TIPOS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label} — {val.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Rotação automática</Label>
                <p className="text-xs text-muted-foreground">Alterna entre painéis automaticamente</p>
              </div>
              <Switch checked={formRotacao} onCheckedChange={setFormRotacao} />
            </div>
            {formRotacao && (
              <div>
                <Label>Intervalo de rotação (segundos)</Label>
                <Input type="number" min={10} max={300} value={formIntervalo} onChange={e => setFormIntervalo(Number(e.target.value))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDisplay(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving || !formNome.trim()}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
