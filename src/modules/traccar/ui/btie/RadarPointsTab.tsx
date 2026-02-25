import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Gauge, Plus, Trash2, Edit2 } from 'lucide-react';
import { EnforcementMapPicker } from '../EnforcementMapPicker';

export function RadarPointsTab({ tenantId }: { tenantId: string }) {
  const [radars, setRadars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', latitude: '', longitude: '',
    speed_limit_kmh: 60, detection_radius_meters: 100,
    direction: '', road_name: '', radar_type: 'fixed',
  });

  const fetchRadars = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_radar_points')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    setRadars(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchRadars(); }, [fetchRadars]);

  const resetForm = () => {
    setForm({
      name: '', description: '', latitude: '', longitude: '',
      speed_limit_kmh: 60, detection_radius_meters: 100,
      direction: '', road_name: '', radar_type: 'fixed',
    });
    setEditing(null);
  };

  const openEdit = (r: any) => {
    setForm({
      name: r.name, description: r.description || '',
      latitude: String(r.latitude), longitude: String(r.longitude),
      speed_limit_kmh: r.speed_limit_kmh, detection_radius_meters: r.detection_radius_meters,
      direction: r.direction || '', road_name: r.road_name || '', radar_type: r.radar_type,
    });
    setEditing(r);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.latitude || !form.longitude) {
      toast.error('Preencha nome e localização');
      return;
    }
    const payload = {
      tenant_id: tenantId,
      name: form.name,
      description: form.description || null,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      speed_limit_kmh: form.speed_limit_kmh,
      detection_radius_meters: form.detection_radius_meters,
      direction: form.direction || null,
      road_name: form.road_name || null,
      radar_type: form.radar_type,
    };

    if (editing) {
      const { error } = await supabase.from('fleet_radar_points').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Radar atualizado');
    } else {
      const { error } = await supabase.from('fleet_radar_points').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Radar cadastrado');
    }

    setDialogOpen(false);
    resetForm();
    fetchRadars();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('fleet_radar_points').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Radar removido'); fetchRadars(); }
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando radares...</div>;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Pontos de Radar</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo Radar</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Radar' : 'Novo Ponto de Radar'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Via / Rodovia</Label><Input value={form.road_name} onChange={e => setForm(f => ({ ...f, road_name: e.target.value }))} /></div>
              </div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Limite (km/h) *</Label>
                  <Input type="number" value={form.speed_limit_kmh} onChange={e => setForm(f => ({ ...f, speed_limit_kmh: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Raio detecção (m)</Label>
                  <Input type="number" value={form.detection_radius_meters} onChange={e => setForm(f => ({ ...f, detection_radius_meters: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.radar_type} onValueChange={v => setForm(f => ({ ...f, radar_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixo</SelectItem>
                      <SelectItem value="mobile">Móvel</SelectItem>
                      <SelectItem value="average">Velocidade Média</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Sentido (ex: Norte → Sul)</Label><Input value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} /></div>
              <EnforcementMapPicker
                latitude={form.latitude ? parseFloat(form.latitude) : null}
                longitude={form.longitude ? parseFloat(form.longitude) : null}
                radiusMeters={form.detection_radius_meters}
                tenantId={tenantId}
                onLocationChange={(lat: number, lng: number) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleSave}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {radars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum radar cadastrado. Use o botão acima para adicionar.</p>
        ) : (
          <div className="space-y-2">
            {radars.map(r => (
              <div key={r.id} className="border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Gauge className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{r.name}</span>
                    <Badge variant="outline" className="text-[10px]">{r.speed_limit_kmh} km/h</Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.radar_type === 'fixed' ? 'Fixo' : r.radar_type === 'mobile' ? 'Móvel' : 'Vel. Média'}
                    </Badge>
                    {!r.is_active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.road_name && <span>{r.road_name} · </span>}
                    {r.direction && <span>{r.direction} · </span>}
                    <span>Raio: {r.detection_radius_meters}m</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
