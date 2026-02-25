/**
 * FleetPolicies — Dedicated page for fleet compliance policies management.
 * Covers: Speed Zones, Enforcement Zones, Disciplinary Escalation Rules
 */
import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Gauge, MapPin, Shield, Plus, Pencil, Trash2, Loader2, AlertTriangle,
  Camera, Navigation, ArrowUpDown
} from 'lucide-react';
import { ZoneMapPicker } from '@/modules/traccar/ui/ZoneMapPicker';
import { EnforcementMapPicker } from '@/modules/traccar/ui/EnforcementMapPicker';

/* ─── Types ─── */
interface SpeedZone {
  id: string;
  name: string;
  description: string | null;
  zone_type: string;
  speed_limit_kmh: number;
  tolerance_kmh: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  is_active: boolean;
}

interface EnforcementZone {
  id: string;
  name: string;
  description: string | null;
  enforcement_type: string;
  speed_limit_kmh: number | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  alert_distance_meters: number | null;
  direction: string | null;
  road_name: string | null;
  is_active: boolean;
}

interface DisciplinaryRule {
  id: string;
  name: string;
  infraction_type: string;
  description: string | null;
  severity: string;
  escalation_steps: any[];
  points_per_infraction: number;
  auto_generate_task: boolean;
  is_active: boolean;
}

const ZONE_TYPES: Record<string, string> = {
  urban: 'Urbana', highway: 'Rodovia', rural: 'Rural',
  school: 'Zona Escolar', construction: 'Obra', custom: 'Personalizado'
};

const ENFORCEMENT_TYPES: Record<string, string> = {
  speed_camera: 'Radar', red_light: 'Semáforo', toll: 'Pedágio',
  weigh_station: 'Balança', checkpoint: 'Posto', custom: 'Personalizado'
};

const INFRACTION_TYPES: Record<string, string> = {
  speeding: 'Excesso de Velocidade', harsh_braking: 'Frenagem Brusca',
  harsh_acceleration: 'Aceleração Brusca', unauthorized_stop: 'Parada Não Autorizada',
  route_deviation: 'Desvio de Rota', geofence_violation: 'Violação de Geofence',
  fatigue: 'Fadiga', phone_usage: 'Uso de Celular', custom: 'Personalizado'
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function FleetPolicies() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Políticas de Frota</h1>
        <p className="text-sm text-muted-foreground">
          Configure limites de velocidade, zonas de fiscalização e regras de escalonamento disciplinar
        </p>
      </div>

      <Tabs defaultValue="speed_zones" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="speed_zones" className="gap-1.5 text-xs">
            <Gauge className="h-3.5 w-3.5" /> Limites de Velocidade
          </TabsTrigger>
          <TabsTrigger value="enforcement" className="gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" /> Zonas de Fiscalização
          </TabsTrigger>
          <TabsTrigger value="disciplinary" className="gap-1.5 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5" /> Escalonamento Disciplinar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="speed_zones">
          {tenantId && <SpeedZonesTab tenantId={tenantId} />}
        </TabsContent>
        <TabsContent value="enforcement">
          {tenantId && <EnforcementZonesTab tenantId={tenantId} />}
        </TabsContent>
        <TabsContent value="disciplinary">
          {tenantId && <DisciplinaryTab tenantId={tenantId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* Speed Zones Tab                                           */
/* ═══════════════════════════════════════════════════════════ */
function SpeedZonesTab({ tenantId }: { tenantId: string }) {
  const [zones, setZones] = useState<SpeedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SpeedZone | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', zone_type: 'urban', speed_limit_kmh: 60,
    tolerance_kmh: 7, latitude: '', longitude: '', radius_meters: 500, is_active: true,
  });

  const fetchZones = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_speed_zones')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    setZones((data as any[]) ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', zone_type: 'urban', speed_limit_kmh: 60, tolerance_kmh: 7, latitude: '', longitude: '', radius_meters: 500, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (z: SpeedZone) => {
    setEditing(z);
    setForm({
      name: z.name, description: z.description || '', zone_type: z.zone_type,
      speed_limit_kmh: z.speed_limit_kmh, tolerance_kmh: z.tolerance_kmh,
      latitude: z.latitude?.toString() || '', longitude: z.longitude?.toString() || '',
      radius_meters: z.radius_meters || 500, is_active: z.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = {
      tenant_id: tenantId, name: form.name, description: form.description || null,
      zone_type: form.zone_type, speed_limit_kmh: form.speed_limit_kmh,
      tolerance_kmh: form.tolerance_kmh,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      radius_meters: form.radius_meters, is_active: form.is_active,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('fleet_speed_zones').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Zona atualizada');
      } else {
        const { error } = await supabase.from('fleet_speed_zones').insert(payload);
        if (error) throw error;
        toast.success('Zona criada');
      }
      setDialogOpen(false);
      fetchZones();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('fleet_speed_zones').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Zona removida'); fetchZones(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" /> Limites de Velocidade por Zona</CardTitle>
            <CardDescription>Defina zonas geográficas com limites máximos de velocidade e tolerância</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Nova Zona</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Zona de Velocidade</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Zona Urbana Centro" /></div>
                <div className="space-y-2"><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Zona</Label>
                    <Select value={form.zone_type} onValueChange={v => setForm(f => ({ ...f, zone_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ZONE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Limite (km/h)</Label><Input type="number" value={form.speed_limit_kmh} onChange={e => setForm(f => ({ ...f, speed_limit_kmh: parseInt(e.target.value) || 0 }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Tolerância (km/h)</Label><Input type="number" value={form.tolerance_kmh} onChange={e => setForm(f => ({ ...f, tolerance_kmh: parseInt(e.target.value) || 0 }))} /></div>
                  <div className="space-y-2"><Label>Raio (metros)</Label><Input type="number" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: parseInt(e.target.value) || 500 }))} /></div>
                  <div className="space-y-2 flex items-end gap-2"><Label>Ativa</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
                </div>
                {/* Map Picker */}
                <ZoneMapPicker
                  latitude={form.latitude ? parseFloat(form.latitude) : null}
                  longitude={form.longitude ? parseFloat(form.longitude) : null}
                  radiusMeters={form.radius_meters}
                  onLocationChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Latitude</Label><Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-23.55" readOnly className="bg-muted/50 font-mono text-xs" /></div>
                  <div className="space-y-2"><Label>Longitude</Label><Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-46.63" readOnly className="bg-muted/50 font-mono text-xs" /></div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : zones.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma zona configurada. Clique em "Nova Zona" para começar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Tolerância</TableHead>
                <TableHead>Raio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map(z => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{ZONE_TYPES[z.zone_type] || z.zone_type}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{z.speed_limit_kmh} km/h</TableCell>
                  <TableCell className="text-sm">{z.tolerance_kmh} km/h</TableCell>
                  <TableCell className="text-sm">{z.radius_meters}m</TableCell>
                  <TableCell><Badge variant={z.is_active ? 'default' : 'secondary'} className="text-xs">{z.is_active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(z)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(z.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* Enforcement Zones Tab                                     */
/* ═══════════════════════════════════════════════════════════ */
function EnforcementZonesTab({ tenantId }: { tenantId: string }) {
  const [zones, setZones] = useState<EnforcementZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EnforcementZone | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', enforcement_type: 'speed_camera', speed_limit_kmh: '',
    latitude: '', longitude: '', radius_meters: 200, alert_distance_meters: 500,
    direction: '', road_name: '', is_active: true,
  });

  const fetchZones = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('fleet_enforcement_zones').select('*').eq('tenant_id', tenantId).order('name');
    setZones((data as any[]) ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', enforcement_type: 'speed_camera', speed_limit_kmh: '', latitude: '', longitude: '', radius_meters: 200, alert_distance_meters: 500, direction: '', road_name: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (z: EnforcementZone) => {
    setEditing(z);
    setForm({
      name: z.name, description: z.description || '', enforcement_type: z.enforcement_type,
      speed_limit_kmh: z.speed_limit_kmh?.toString() || '', latitude: z.latitude.toString(),
      longitude: z.longitude.toString(), radius_meters: z.radius_meters,
      alert_distance_meters: z.alert_distance_meters || 500,
      direction: z.direction || '', road_name: z.road_name || '', is_active: z.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.latitude || !form.longitude) { toast.error('Nome, latitude e longitude são obrigatórios'); return; }
    setSaving(true);
    const payload = {
      tenant_id: tenantId, name: form.name, description: form.description || null,
      enforcement_type: form.enforcement_type,
      speed_limit_kmh: form.speed_limit_kmh ? parseInt(form.speed_limit_kmh) : null,
      latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude),
      radius_meters: form.radius_meters, alert_distance_meters: form.alert_distance_meters,
      direction: form.direction || null, road_name: form.road_name || null, is_active: form.is_active,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('fleet_enforcement_zones').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Ponto atualizado');
      } else {
        const { error } = await supabase.from('fleet_enforcement_zones').insert(payload);
        if (error) throw error;
        toast.success('Ponto criado');
      }
      setDialogOpen(false);
      fetchZones();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('fleet_enforcement_zones').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Ponto removido'); fetchZones(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Zonas de Fiscalização</CardTitle>
            <CardDescription>Cadastre pontos de radar, semáforos e postos de fiscalização eletrônica</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Novo Ponto</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Ponto de Fiscalização</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Radar Av. Paulista km 2" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.enforcement_type} onValueChange={v => setForm(f => ({ ...f, enforcement_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ENFORCEMENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Limite (km/h)</Label><Input type="number" value={form.speed_limit_kmh} onChange={e => setForm(f => ({ ...f, speed_limit_kmh: e.target.value }))} placeholder="60" /></div>
                </div>
                <EnforcementMapPicker
                  latitude={form.latitude ? parseFloat(form.latitude) : null}
                  longitude={form.longitude ? parseFloat(form.longitude) : null}
                  radiusMeters={form.radius_meters}
                  onLocationChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Latitude *</Label><Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-23.5611" /></div>
                  <div className="space-y-2"><Label>Longitude *</Label><Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-46.6560" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Raio (m)</Label><Input type="number" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: parseInt(e.target.value) || 200 }))} /></div>
                  <div className="space-y-2"><Label>Distância alerta (m)</Label><Input type="number" value={form.alert_distance_meters} onChange={e => setForm(f => ({ ...f, alert_distance_meters: parseInt(e.target.value) || 500 }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Via / Rodovia</Label><Input value={form.road_name} onChange={e => setForm(f => ({ ...f, road_name: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Sentido</Label><Input value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} placeholder="Norte-Sul" /></div>
                </div>
                <div className="flex items-center gap-2"><Label>Ativo</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : zones.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum ponto de fiscalização cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Via</TableHead>
                <TableHead>Coordenadas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map(z => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{ENFORCEMENT_TYPES[z.enforcement_type] || z.enforcement_type}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{z.speed_limit_kmh ? `${z.speed_limit_kmh} km/h` : '—'}</TableCell>
                  <TableCell className="text-sm">{z.road_name || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{z.latitude.toFixed(4)}, {z.longitude.toFixed(4)}</TableCell>
                  <TableCell><Badge variant={z.is_active ? 'default' : 'secondary'} className="text-xs">{z.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(z)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(z.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* Disciplinary Escalation Tab                                */
/* ═══════════════════════════════════════════════════════════ */
function DisciplinaryTab({ tenantId }: { tenantId: string }) {
  const [rules, setRules] = useState<DisciplinaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DisciplinaryRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', infraction_type: 'speeding', description: '', severity: 'medium',
    points_per_infraction: 5, auto_generate_task: true, is_active: true,
    steps: [
      { step: 1, action: 'verbal_warning', label: 'Advertência Verbal', days_window: 30 },
      { step: 2, action: 'written_warning', label: 'Advertência Escrita', days_window: 60 },
      { step: 3, action: 'suspension', label: 'Suspensão', days_window: 90, suspension_days: 3 },
      { step: 4, action: 'termination', label: 'Desligamento por Justa Causa', days_window: 180 },
    ] as any[],
  });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('fleet_disciplinary_rules').select('*').eq('tenant_id', tenantId).order('infraction_type');
    setRules((data as any[]) ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: '', infraction_type: 'speeding', description: '', severity: 'medium',
      points_per_infraction: 5, auto_generate_task: true, is_active: true,
      steps: [
        { step: 1, action: 'verbal_warning', label: 'Advertência Verbal', days_window: 30 },
        { step: 2, action: 'written_warning', label: 'Advertência Escrita', days_window: 60 },
        { step: 3, action: 'suspension', label: 'Suspensão', days_window: 90, suspension_days: 3 },
        { step: 4, action: 'termination', label: 'Desligamento por Justa Causa', days_window: 180 },
      ],
    });
    setDialogOpen(true);
  };

  const openEdit = (r: DisciplinaryRule) => {
    setEditing(r);
    setForm({
      name: r.name, infraction_type: r.infraction_type, description: r.description || '',
      severity: r.severity, points_per_infraction: r.points_per_infraction,
      auto_generate_task: r.auto_generate_task, is_active: r.is_active,
      steps: Array.isArray(r.escalation_steps) ? r.escalation_steps : [],
    });
    setDialogOpen(true);
  };

  const updateStep = (idx: number, field: string, value: any) => {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = {
      tenant_id: tenantId, name: form.name, infraction_type: form.infraction_type,
      description: form.description || null, severity: form.severity,
      escalation_steps: form.steps, points_per_infraction: form.points_per_infraction,
      auto_generate_task: form.auto_generate_task, is_active: form.is_active,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('fleet_disciplinary_rules').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Regra atualizada');
      } else {
        const { error } = await supabase.from('fleet_disciplinary_rules').insert(payload);
        if (error) throw error;
        toast.success('Regra criada');
      }
      setDialogOpen(false);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('fleet_disciplinary_rules').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Regra removida'); fetchRules(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ArrowUpDown className="h-5 w-5" /> Escalonamento Disciplinar</CardTitle>
            <CardDescription>Escada progressiva de penalidades por tipo de infração</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Nova Regra</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Regra Disciplinar</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Excesso de Velocidade Urbana" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Infração</Label>
                    <Select value={form.infraction_type} onValueChange={v => setForm(f => ({ ...f, infraction_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(INFRACTION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Severidade</Label>
                    <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Pontos por infração</Label><Input type="number" value={form.points_per_infraction} onChange={e => setForm(f => ({ ...f, points_per_infraction: parseInt(e.target.value) || 0 }))} /></div>
                  <div className="flex items-end gap-4">
                    <div className="space-y-2 flex items-center gap-2"><Label>Gerar tarefa</Label><Switch checked={form.auto_generate_task} onCheckedChange={v => setForm(f => ({ ...f, auto_generate_task: v }))} /></div>
                    <div className="space-y-2 flex items-center gap-2"><Label>Ativa</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
                  </div>
                </div>

                <Separator />
                <Label className="text-sm font-semibold">Escada de Escalonamento</Label>
                <div className="space-y-3">
                  {form.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <Badge variant="outline" className="shrink-0">{step.step}º</Badge>
                      <Input value={step.label} onChange={e => updateStep(idx, 'label', e.target.value)} className="flex-1" placeholder="Ação" />
                      <div className="flex items-center gap-1 shrink-0">
                        <Input type="number" value={step.days_window} onChange={e => updateStep(idx, 'days_window', parseInt(e.target.value) || 0)} className="w-20" />
                        <span className="text-xs text-muted-foreground">dias</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma regra disciplinar configurada.</p>
        ) : (
          <div className="space-y-4">
            {rules.map(r => (
              <div key={r.id} className="p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[r.severity] || ''}`}>{r.severity}</Badge>
                    <Badge variant="outline" className="text-xs">{INFRACTION_TYPES[r.infraction_type] || r.infraction_type}</Badge>
                    <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-xs">{r.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(Array.isArray(r.escalation_steps) ? r.escalation_steps : []).map((step: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs">
                        <span className="font-semibold">{step.step}º</span>
                        <span>{step.label}</span>
                        <span className="text-muted-foreground">({step.days_window}d)</span>
                      </div>
                      {idx < (r.escalation_steps as any[]).length - 1 && <span className="text-muted-foreground">→</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {r.points_per_infraction} pts/infração • {r.auto_generate_task ? 'Gera tarefa automática' : 'Sem tarefa automática'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
