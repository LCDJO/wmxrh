/**
 * LiveDisplayAdmin — Manage TV displays (DisplayBoard), generate QR codes for pairing.
 * Route: /live-display (tenant)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Monitor, Plus, QrCode, Trash2, Copy, Tv, AlertTriangle, CheckCircle2, WifiOff, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { DISPLAY_TIPOS } from '@/modules/live-display';
import type { DisplayBoardTipo } from '@/modules/live-display';
import type { Database } from '@/integrations/supabase/types';

type LiveDisplay = Database['public']['Tables']['live_displays']['Row'];

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  active: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500' },
  paused: { label: 'Pausado', icon: AlertTriangle, color: 'text-amber-500' },
  disconnected: { label: 'Desconectado', icon: WifiOff, color: 'text-muted-foreground' },
};

export default function LiveDisplayAdmin() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [displays, setDisplays] = useState<LiveDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showQR, setShowQR] = useState<{ display: LiveDisplay; token: string; url: string } | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<DisplayBoardTipo>('executivo');
  const [formCompanyId, setFormCompanyId] = useState<string>('');
  const [formDeptId, setFormDeptId] = useState<string>('');
  const [formRotacao, setFormRotacao] = useState(false);
  const [formIntervalo, setFormIntervalo] = useState(30);
  const [creating, setCreating] = useState(false);

  const tenantId = currentTenant?.id;

  const fetchDisplays = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('live_displays')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setDisplays(data ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    fetchDisplays();
    Promise.all([
      supabase.from('companies').select('id, name').eq('tenant_id', tenantId).is('deleted_at', null),
      supabase.from('departments').select('id, name').eq('tenant_id', tenantId),
    ]).then(([compRes, deptRes]) => {
      setCompanies(compRes.data ?? []);
      setDepartments(deptRes.data ?? []);
    });
  }, [tenantId, fetchDisplays]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('live-displays-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_displays', filter: `tenant_id=eq.${tenantId}` }, () => {
        fetchDisplays();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchDisplays]);

  const handleCreate = async () => {
    if (!tenantId || !formNome.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('live_displays').insert({
      tenant_id: tenantId,
      nome: formNome.trim(),
      tipo: formTipo,
      company_id: formCompanyId || null,
      department_id: formDeptId || null,
      rotacao_automatica: formRotacao,
      intervalo_rotacao: formIntervalo,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Display criado!' });
      setShowCreate(false);
      resetForm();
      fetchDisplays();
    }
    setCreating(false);
  };

  const resetForm = () => {
    setFormNome(''); setFormTipo('executivo'); setFormCompanyId(''); setFormDeptId('');
    setFormRotacao(false); setFormIntervalo(30);
  };

  const generateToken = async (display: LiveDisplay) => {
    if (!tenantId) return;
    const tokenValue = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('live_display_tokens').update({ status: 'expired' as const }).eq('display_id', display.id);
    const { error } = await supabase.from('live_display_tokens').insert({
      display_id: display.id, tenant_id: tenantId, token_temporario: tokenValue, expira_em: expiresAt, status: 'pending' as const,
    });
    if (error) {
      toast({ title: 'Erro ao gerar token', description: error.message, variant: 'destructive' });
      return;
    }
    const tvUrl = `${window.location.origin}/tv?token=${tokenValue}`;
    setShowQR({ display, token: tokenValue, url: tvUrl });
  };

  const deleteDisplay = async (id: string) => {
    await supabase.from('live_displays').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    toast({ title: 'Display removido' });
    fetchDisplays();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copiada!' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Tv className="h-6 w-6 text-primary" />
            Live Operations Display
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie displays para TVs e monitores corporativos com dados em tempo real.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Display
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-40" /></Card>)}
        </div>
      ) : displays.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Monitor className="h-12 w-12 opacity-40" />
            <p className="text-sm">Nenhum display configurado ainda.</p>
            <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar primeiro display
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displays.map(display => {
            const status = STATUS_MAP[display.status] ?? STATUS_MAP.disconnected;
            const StatusIcon = status.icon;
            const tipoInfo = DISPLAY_TIPOS[display.tipo as DisplayBoardTipo];

            return (
              <Card key={display.id} className="group hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{display.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{tipoInfo?.label ?? display.tipo}</Badge>
                    {display.rotacao_automatica && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <RotateCw className="h-3 w-3" /> {display.intervalo_rotacao}s
                      </Badge>
                    )}
                    {display.company_id && (
                      <Badge variant="outline" className="text-xs">
                        {companies.find(c => c.id === display.company_id)?.name ?? 'Empresa'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{tipoInfo?.description}</p>
                  {display.last_seen_at && (
                    <p className="text-xs text-muted-foreground">
                      Último sinal: {format(new Date(display.last_seen_at), 'dd/MM HH:mm')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => generateToken(display)}>
                      <QrCode className="h-3.5 w-3.5" /> QR Code
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteDisplay(display.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Display Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input placeholder="Ex: TV Recepção, Monitor Operações" value={formNome} onChange={e => setFormNome(e.target.value)} />
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
            <div>
              <Label>Empresa (opcional)</Label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as empresas</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento (opcional)</Label>
              <Select value={formDeptId} onValueChange={setFormDeptId}>
                <SelectTrigger><SelectValue placeholder="Todos os departamentos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os departamentos</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
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
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !formNome.trim()}>
              {creating ? 'Criando...' : 'Criar Display'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Parear Display: {showQR?.display.nome}
            </DialogTitle>
          </DialogHeader>
          {showQR && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG value={showQR.url} size={220} level="H" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Escaneie o QR Code com a TV ou abra a URL abaixo no navegador do monitor.
              </p>
              <div className="flex items-center gap-2 w-full">
                <Input readOnly value={showQR.url} className="text-xs" />
                <Button size="sm" variant="outline" onClick={() => copyUrl(showQR.url)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
