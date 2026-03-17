/**
 * PlatformAdsManagement — Full Ads Management Dashboard for SaaS platform.
 * 
 * Tabs: Overview, Campaigns, Creatives, Targeting, Metrics
 */
import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Megaphone, Image, Target, BarChart3, Plus, Pause, Play,
  Archive, Eye, MousePointer, TrendingUp, Loader2, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdsCampaigns, useAdsCreatives, useAdsTargeting, useAdsMetrics,
  type AdsCampaign,
  type AdsPlacement,
  type AdsSlotMetric,
} from '@/domains/ads';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

interface ManagedAdsSlot {
  name: string;
  label: string;
  surface: string;
  description: string;
  format: string;
}

const ADS_SLOT_CATALOG: ManagedAdsSlot[] = [
  { name: 'login_top_banner', label: 'Login — topo', surface: 'Autenticação', description: 'Faixa acima do cabeçalho do formulário de login.', format: 'Horizontal compacto' },
  { name: 'login_bottom_banner', label: 'Login — base', surface: 'Autenticação', description: 'Faixa logo abaixo do formulário de autenticação.', format: 'Horizontal compacto' },
  { name: 'site_home_banner', label: 'Site — home', surface: 'Site público', description: 'Banner principal entre hero e blocos da landing page.', format: 'Hero horizontal' },
  { name: 'site_footer', label: 'Site — rodapé', surface: 'Site público', description: 'Faixa promocional antes do rodapé do site.', format: 'Rodapé horizontal' },
  { name: 'saas_dashboard_top', label: 'SaaS — dashboard topo', surface: 'Plataforma', description: 'Anúncio principal acima do conteúdo do dashboard global.', format: 'Leaderboard' },
  { name: 'saas_dashboard_sidebar', label: 'SaaS — dashboard lateral', surface: 'Plataforma', description: 'Slot lateral exibido no painel administrativo global.', format: 'Sidebar vertical' },
  { name: 'tenant_dashboard_top', label: 'Tenant — dashboard topo', surface: 'Tenant', description: 'Banner de destaque no dashboard operacional do tenant.', format: 'Leaderboard' },
  { name: 'tenant_dashboard_widget', label: 'Tenant — widget lateral', surface: 'Tenant', description: 'Área lateral para promoções, upsell e campanhas contextuais.', format: 'Widget vertical' },
  { name: 'tenant_footer', label: 'Tenant — rodapé', surface: 'Tenant', description: 'Faixa persistente no rodapé das páginas do tenant.', format: 'Rodapé horizontal' },
  { name: 'module_top_banner', label: 'Módulo — topo', surface: 'Módulos internos', description: 'Banner contextual no topo das telas internas dos módulos.', format: 'Topo contextual' },
  { name: 'module_inline', label: 'Módulo — inline', surface: 'Módulos internos', description: 'Bloco inline entre conteúdos internos para campanhas inteligentes.', format: 'Inline responsivo' },
];

export default function PlatformAdsManagement() {
  const [tab, setTab] = useState('overview');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const { campaigns, placements, loading, refresh, createCampaign, updateCampaign, toggleCampaignStatus } = useAdsCampaigns();
  const { summary, daily, bySlot, loading: metricsLoading } = useAdsMetrics();

  // Totals
  const totalImpressions = useMemo(() => summary.reduce((s, m) => s + m.impressions, 0), [summary]);
  const totalClicks = useMemo(() => summary.reduce((s, m) => s + m.clicks, 0), [summary]);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Ads Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie anúncios internos, campanhas e métricas de performance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs gap-1">
            <Megaphone className="h-3.5 w-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="creatives" className="text-xs gap-1">
            <Image className="h-3.5 w-3.5" /> Criativos
          </TabsTrigger>
          <TabsTrigger value="targeting" className="text-xs gap-1">
            <Target className="h-3.5 w-3.5" /> Segmentação
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Métricas
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Megaphone} label="Campanhas Ativas" value={activeCampaigns} />
            <KPICard icon={Eye} label="Impressões" value={totalImpressions.toLocaleString('pt-BR')} />
            <KPICard icon={MousePointer} label="Cliques" value={totalClicks.toLocaleString('pt-BR')} />
            <KPICard icon={TrendingUp} label="CTR Médio" value={`${avgCtr}%`} />
          </div>

          <PlacementCatalogSection placements={placements} />

          {/* Daily chart */}
          {daily.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Impressões e Cliques por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* CTR by campaign */}
          {summary.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">CTR por Campanha</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={summary.slice(0, 10)}>
                    <XAxis dataKey="campaign_name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'CTR']} />
                    <Bar dataKey="ctr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns" className="space-y-4 mt-6">
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">{campaigns.length} campanhas</p>
            <CreateCampaignDialog onCreate={createCampaign} onRefresh={refresh} />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Criativos</TableHead>
                    <TableHead>Impressões</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map(c => {
                    const ctr = (c.impressions ?? 0) > 0
                      ? (((c.clicks ?? 0) / (c.impressions ?? 1)) * 100).toFixed(2)
                      : '0.00';
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground text-sm">{c.name}</p>
                            {c.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[c.status]}`}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.priority}</TableCell>
                        <TableCell className="text-sm">{c.creatives_count}</TableCell>
                        <TableCell className="text-sm font-mono">{(c.impressions ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm font-mono">{(c.clicks ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm font-mono">{ctr}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => {
                                toggleCampaignStatus(c.id, c.status);
                                toast.success(`Campanha ${c.status === 'active' ? 'pausada' : 'ativada'}`);
                              }}
                            >
                              {c.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => {
                                setSelectedCampaignId(c.id);
                                setTab('creatives');
                              }}
                            >
                              <Image className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => {
                                updateCampaign(c.id, { status: 'archived' });
                                toast.success('Campanha arquivada');
                              }}
                            >
                              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {campaigns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhuma campanha criada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CREATIVES TAB */}
        <TabsContent value="creatives" className="space-y-4 mt-6">
          <CreativesPanel
            campaigns={campaigns}
            placements={placements}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
          />
        </TabsContent>

        {/* TARGETING TAB */}
        <TabsContent value="targeting" className="space-y-4 mt-6">
          <TargetingPanel
            campaigns={campaigns}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
          />
        </TabsContent>

        {/* METRICS TAB */}
        <TabsContent value="metrics" className="space-y-4 mt-6">
          <MetricsPanel summary={summary} daily={daily} bySlot={bySlot} placements={placements} loading={metricsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function KPICard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlacementCatalogSection({ placements }: { placements: AdsPlacement[] }) {
  const placementMap = new Map(placements.map((placement) => [placement.name, placement]));
  const groupedSlots = ADS_SLOT_CATALOG.reduce<Record<string, ManagedAdsSlot[]>>((acc, slot) => {
    if (!acc[slot.surface]) acc[slot.surface] = [];
    acc[slot.surface].push(slot);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Catálogo de locais de anúncio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedSlots).map(([surface, slots]) => {
          const activeCount = slots.filter((slot) => placementMap.get(slot.name)?.is_active).length;

          return (
            <div key={surface} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{surface}</h3>
                  <p className="text-xs text-muted-foreground">{slots.length} locais mapeados nesta superfície</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {activeCount}/{slots.length} ativos
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot) => {
                  const placement = placementMap.get(slot.name);

                  return (
                    <div key={slot.name} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{slot.label}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{slot.name}</p>
                        </div>
                        <Badge variant={placement?.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {placement ? (placement.is_active ? 'Ativo' : 'Inativo') : 'Pendente'}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">{slot.description}</p>

                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{slot.format}</Badge>
                        {placement?.label && (
                          <Badge variant="secondary" className="text-[10px]">{placement.label}</Badge>
                        )}
                        {placement?.location_type && (
                          <Badge variant="secondary" className="text-[10px] capitalize">{placement.location_type}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CreateCampaignDialog({ onCreate, onRefresh }: { onCreate: (c: any) => Promise<void>; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('10');

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return; }
    try {
      await onCreate({ name: name.trim(), description: description.trim() || null, priority: parseInt(priority) });
      toast.success('Campanha criada com sucesso');
      setOpen(false);
      setName('');
      setDescription('');
    } catch {
      toast.error('Erro ao criar campanha');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova Campanha</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da campanha" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional" />
          </div>
          <div>
            <Label>Prioridade (menor = mais alta)</Label>
            <Input type="number" value={priority} onChange={e => setPriority(e.target.value)} />
          </div>
          <Button onClick={handleCreate} className="w-full">Criar Campanha</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreativesPanel({ campaigns, placements, selectedCampaignId, onSelectCampaign }: {
  campaigns: AdsCampaign[];
  placements: any[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
}) {
  const { creatives, createCreative } = useAdsCreatives(selectedCampaignId);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', type: 'banner', placement_id: '', image_url: '', html_content: '', cta_text: '', cta_url: '',
  });

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    try {
      await createCreative({
        ...form,
        placement_id: form.placement_id || null,
      });
      toast.success('Criativo adicionado');
      setShowCreate(false);
      setForm({ title: '', type: 'banner', placement_id: '', image_url: '', html_content: '', cta_text: '', cta_url: '' });
    } catch {
      toast.error('Erro ao criar criativo');
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Select value={selectedCampaignId ?? ''} onValueChange={v => onSelectCampaign(v || null)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCampaignId && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Criativo
          </Button>
        )}
      </div>

      {!selectedCampaignId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Selecione uma campanha</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>CTA</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creatives.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.title}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{c.type}</Badge></TableCell>
                    <TableCell className="text-sm">{c.placement_name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{c.cta_text ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={c.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {creatives.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum criativo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create creative dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Criativo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                    <SelectItem value="widget">Widget</SelectItem>
                    <SelectItem value="modal">Modal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placement</Label>
                <Select value={form.placement_id} onValueChange={v => setForm(f => ({ ...f, placement_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {placements.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex flex-col">
                          <span>{p.label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL da Imagem</Label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>HTML Content</Label>
              <Textarea value={form.html_content} onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))} placeholder="HTML do anúncio" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Texto do CTA</Label>
                <Input value={form.cta_text} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="Saiba mais" />
              </div>
              <div>
                <Label>URL do CTA</Label>
                <Input value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate}>Criar Criativo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TargetingPanel({ campaigns, selectedCampaignId, onSelectCampaign }: {
  campaigns: AdsCampaign[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
}) {
  const { rules, addRule, removeRule } = useAdsTargeting(selectedCampaignId);
  const [form, setForm] = useState({
    plan_name: '', user_role: '', country: '', device_type: '', exclude_premium: false,
  });

  const handleAdd = async () => {
    try {
      await addRule({
        plan_name: form.plan_name || null,
        user_role: form.user_role || null,
        country: form.country || null,
        device_type: form.device_type || null,
        exclude_premium: form.exclude_premium,
      });
      toast.success('Regra adicionada');
      setForm({ plan_name: '', user_role: '', country: '', device_type: '', exclude_premium: false });
    } catch {
      toast.error('Erro ao adicionar regra');
    }
  };

  return (
    <>
      <Select value={selectedCampaignId ?? ''} onValueChange={v => onSelectCampaign(v || null)}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Selecione uma campanha" />
        </SelectTrigger>
        <SelectContent>
          {campaigns.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!selectedCampaignId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Selecione uma campanha</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Existing rules */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Regras de Segmentação</CardTitle>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra — exibe para todos</p>
              ) : (
                <div className="space-y-2">
                  {rules.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 text-sm">
                      <div className="space-y-0.5">
                        {r.plan_name && <Badge variant="secondary" className="text-[10px] mr-1">Plano: {r.plan_name}</Badge>}
                        {r.user_role && <Badge variant="secondary" className="text-[10px] mr-1">Role: {r.user_role}</Badge>}
                        {r.country && <Badge variant="secondary" className="text-[10px] mr-1">País: {r.country}</Badge>}
                        {r.device_type && <Badge variant="secondary" className="text-[10px] mr-1">Device: {r.device_type}</Badge>}
                        {r.exclude_premium && <Badge variant="destructive" className="text-[10px]">Excluir Premium</Badge>}
                        {!r.plan_name && !r.user_role && !r.country && !r.device_type && (
                          <span className="text-muted-foreground">Todos</span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRule(r.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add rule */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Adicionar Regra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Plano</Label>
                <Select value={form.plan_name} onValueChange={v => setForm(f => ({ ...f, plan_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>País</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="BR, US, etc." />
              </div>
              <div>
                <Label>Dispositivo</Label>
                <Select value={form.device_type} onValueChange={v => setForm(f => ({ ...f, device_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.exclude_premium}
                  onChange={e => setForm(f => ({ ...f, exclude_premium: e.target.checked }))}
                  className="rounded border-border"
                />
                <Label className="text-sm">Excluir planos Premium/Enterprise</Label>
              </div>
              <Button className="w-full" onClick={handleAdd}>Adicionar Regra</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function MetricsPanel({ summary, daily, bySlot, placements, loading }: {
  summary: any[];
  daily: any[];
  bySlot: AdsSlotMetric[];
  placements: AdsPlacement[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const placementMap = new Map(placements.map((placement) => [placement.name, placement]));

  return (
    <div className="space-y-6">
      {/* Daily trend */}
      {daily.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Impressões por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="impressions" name="Impressões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name="Cliques" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {bySlot.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CTR por local</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySlot.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="slot_name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'CTR']} />
                <Bar dataKey="ctr" name="CTR" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance por Campanha</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Impressões</TableHead>
                  <TableHead>Cliques</TableHead>
                  <TableHead>CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map(s => (
                  <TableRow key={s.campaign_id}>
                    <TableCell className="font-medium text-sm">{s.campaign_name}</TableCell>
                    <TableCell className="font-mono text-sm">{s.impressions.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-sm">{s.clicks.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-sm">{s.ctr.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
                {summary.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados de métricas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance por Local</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local</TableHead>
                  <TableHead>Impressões</TableHead>
                  <TableHead>Cliques</TableHead>
                  <TableHead>CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySlot.map(slotMetric => {
                  const placement = placementMap.get(slotMetric.slot_name);
                  return (
                    <TableRow key={slotMetric.slot_name}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-foreground">{placement?.label ?? slotMetric.slot_name}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{slotMetric.slot_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{slotMetric.impressions.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{slotMetric.clicks.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{slotMetric.ctr.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
                {bySlot.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados por local ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
