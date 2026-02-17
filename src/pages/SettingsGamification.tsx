/**
 * Settings > Gamification — CRUD Levels + Point Weight Config
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Trophy, Zap, Loader2, Save } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { GamificationLevel, GamificationPointWeight } from '@/domains/revenue-intelligence';

export default function SettingsGamification() {
  const engine = getRevenueIntelligenceEngine();

  const [levels, setLevels] = useState<GamificationLevel[]>([]);
  const [weights, setWeights] = useState<GamificationPointWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Level form
  const [levelDialog, setLevelDialog] = useState(false);
  const [editingLevel, setEditingLevel] = useState<GamificationLevel | null>(null);
  const [levelForm, setLevelForm] = useState({ name: '', slug: '', min_points: 0, color: '#CD7F32', sort_order: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, w] = await Promise.all([engine.gamification.getLevels(), engine.gamification.getPointWeights()]);
      setLevels(l);
      setWeights(w);
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => { load(); }, [load]);

  // ── Level CRUD ──
  const openCreateLevel = () => {
    setEditingLevel(null);
    setLevelForm({ name: '', slug: '', min_points: 0, color: '#CD7F32', sort_order: levels.length + 1 });
    setLevelDialog(true);
  };

  const openEditLevel = (level: GamificationLevel) => {
    setEditingLevel(level);
    setLevelForm({ name: level.name, slug: level.slug, min_points: level.min_points, color: level.color, sort_order: level.sort_order });
    setLevelDialog(true);
  };

  const saveLevel = async () => {
    setSaving(true);
    try {
      if (editingLevel) {
        await engine.gamification.updateLevel(editingLevel.id, levelForm);
        toast.success('Nível atualizado');
      } else {
        await engine.gamification.createLevel({ ...levelForm, icon: null, badge_label: null, is_active: true });
        toast.success('Nível criado');
      }
      setLevelDialog(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteLevel = async (id: string) => {
    try {
      await engine.gamification.deleteLevel(id);
      toast.success('Nível removido');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Weight update ──
  const updateWeight = async (id: string, points: number) => {
    try {
      await engine.gamification.updatePointWeight(id, { points });
      toast.success('Peso atualizado');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Gamificação</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure níveis e pesos de pontuação do sistema de gamificação.</p>
      </div>

      {/* ── Levels ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            Níveis (Levels)
          </CardTitle>
          <Dialog open={levelDialog} onOpenChange={setLevelDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateLevel}><Plus className="h-3.5 w-3.5 mr-1" /> Novo Nível</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLevel ? 'Editar Nível' : 'Novo Nível'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={levelForm.name} onChange={e => setLevelForm(f => ({ ...f, name: e.target.value }))} placeholder="Gold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug</Label>
                    <Input value={levelForm.slug} onChange={e => setLevelForm(f => ({ ...f, slug: e.target.value }))} placeholder="gold" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Pontos Mínimos</Label>
                    <Input type="number" value={levelForm.min_points} onChange={e => setLevelForm(f => ({ ...f, min_points: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cor</Label>
                    <div className="flex gap-2">
                      <input type="color" value={levelForm.color} onChange={e => setLevelForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-9 rounded border cursor-pointer" />
                      <Input value={levelForm.color} onChange={e => setLevelForm(f => ({ ...f, color: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ordem</Label>
                    <Input type="number" value={levelForm.sort_order} onChange={e => setLevelForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLevelDialog(false)}>Cancelar</Button>
                <Button onClick={saveLevel} disabled={saving || !levelForm.name || !levelForm.slug}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {levels.map(level => (
              <div key={level.id} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: level.color }} />
                  <span className="font-medium text-sm">{level.name}</span>
                  <Badge variant="secondary" className="text-xs">{level.min_points}+ pts</Badge>
                  <span className="text-xs text-muted-foreground">slug: {level.slug}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLevel(level)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLevel(level.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {levels.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum nível configurado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Point Weights ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Peso da Pontuação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weights.map(w => (
              <div key={w.id} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-card">
                <div className="flex-1">
                  <p className="text-sm font-medium">{w.action_label}</p>
                  {w.description && <p className="text-xs text-muted-foreground">{w.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    defaultValue={w.points}
                    className="w-24 h-8 text-sm text-right"
                    onBlur={e => {
                      const val = Number(e.target.value);
                      if (val !== w.points) updateWeight(w.id, val);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                  <Switch
                    checked={w.is_active}
                    onCheckedChange={async (checked) => {
                      await engine.gamification.updatePointWeight(w.id, { is_active: checked });
                      await load();
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
