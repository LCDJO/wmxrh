import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Megaphone,
  Image as ImageIcon,
  Target,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Eye,
  MousePointer,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  Loader2,
  LayoutTemplate,
  Monitor,
  Clapperboard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useAdsCampaigns,
  useAdsCreatives,
  useAdsMetrics,
  useAdsTargeting,
  type AdsCampaign,
  type AdsCreative,
  type AdsCreativeMetric,
  type AdsPlacement,
  type AdsSlotMetric,
} from '@/domains/ads';

interface ManagedAdsSlot {
  name: string;
  label: string;
  surface: string;
  description: string;
  format: string;
  dimensions: string;
}

const ADS_SLOT_CATALOG: ManagedAdsSlot[] = [
  { name: 'login_top_banner', label: 'Login — topo', surface: 'Autenticação', description: 'Faixa acima do cabeçalho do formulário de login.', format: 'Horizontal compacto', dimensions: '1440×280' },
  { name: 'login_bottom_banner', label: 'Login — base', surface: 'Autenticação', description: 'Faixa logo abaixo do formulário de autenticação.', format: 'Horizontal compacto', dimensions: '1440×280' },
  { name: 'site_home_banner', label: 'Site — home', surface: 'Site público', description: 'Banner principal entre hero e blocos da landing page.', format: 'Hero horizontal', dimensions: '1440×480' },
  { name: 'site_footer', label: 'Site — rodapé', surface: 'Site público', description: 'Faixa promocional antes do rodapé do site.', format: 'Rodapé horizontal', dimensions: '1440×240' },
  { name: 'saas_dashboard_top', label: 'SaaS — dashboard topo', surface: 'Plataforma', description: 'Anúncio principal acima do conteúdo do dashboard global.', format: 'Leaderboard', dimensions: '1200×320' },
  { name: 'saas_dashboard_sidebar', label: 'SaaS — dashboard lateral', surface: 'Plataforma', description: 'Slot lateral exibido no painel administrativo global.', format: 'Sidebar vertical', dimensions: '320×560' },
  { name: 'tenant_dashboard_top', label: 'Tenant — dashboard topo', surface: 'Tenant', description: 'Banner de destaque no dashboard operacional do tenant.', format: 'Leaderboard', dimensions: '1200×320' },
  { name: 'tenant_dashboard_widget', label: 'Tenant — widget lateral', surface: 'Tenant', description: 'Área lateral para promoções, upsell e campanhas contextuais.', format: 'Widget vertical', dimensions: '320×420' },
  { name: 'tenant_footer', label: 'Tenant — rodapé', surface: 'Tenant', description: 'Faixa persistente no rodapé das páginas do tenant.', format: 'Rodapé horizontal', dimensions: '1280×220' },
  { name: 'module_top_banner', label: 'Módulo — topo', surface: 'Módulos internos', description: 'Banner contextual no topo das telas internas dos módulos.', format: 'Topo contextual', dimensions: '1200×280' },
  { name: 'module_inline', label: 'Módulo — inline', surface: 'Módulos internos', description: 'Bloco inline entre conteúdos internos para campanhas inteligentes.', format: 'Inline responsivo', dimensions: '960×320' },
];

const PERIOD_OPTIONS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
];

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: 12,
};

const defaultCampaignForm = {
  name: '',
  description: '',
  priority: '10',
  status: 'active',
};

const defaultCreativeForm = {
  campaign_id: '',
  title: '',
  type: 'banner',
  placement_id: '',
  image_url: '',
  video_url: '',
  html_content: '',
  cta_text: '',
  cta_url: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
};

function fmt(value: number) {
  return value.toLocaleString('pt-BR');
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function metricDelta(current: number, previous: number) {
  if (!previous && !current) return '—';
  if (!previous) return 'Novo';
  const pct = ((current - previous) / previous) * 100;
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export default function PlatformAdsManagement() {
  const [tab, setTab] = useState('overview');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState('30');

  const {
    campaigns,
    placements,
    loading,
    refresh,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaignStatus,
  } = useAdsCampaigns();

  const {
    overview,
    summary,
    daily,
    bySlot,
    creativeMetrics,
    loading: metricsLoading,
  } = useAdsMetrics(Number(periodDays));

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const totalCreatives = campaigns.reduce((sum, campaign) => sum + (campaign.creatives_count ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold font-display text-foreground">
            <Megaphone className="h-6 w-6 text-primary" /> Gestão de banners e campanhas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD completo para campanhas, criativos, locais mapeados e analytics operacional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh}>Atualizar</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="creatives">Criativos</TabsTrigger>
          <TabsTrigger value="targeting">Segmentação</TabsTrigger>
          <TabsTrigger value="metrics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KPICard icon={Megaphone} label="Campanhas ativas" value={activeCampaigns} meta={`${campaigns.length} totais`} />
            <KPICard icon={Clapperboard} label="Criativos" value={totalCreatives} meta={`${placements.length} locais`} />
            <KPICard icon={Eye} label="Impressões" value={fmt(overview.impressions)} meta={metricDelta(overview.impressions, overview.previousImpressions)} />
            <KPICard icon={MousePointer} label="CTR" value={`${overview.ctr.toFixed(2)}%`} meta={`antes ${overview.previousCtr.toFixed(2)}%`} />
          </div>

          <PlacementCatalogSection placements={placements} bySlot={bySlot} />

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Evolução diária</CardTitle>
                <CardDescription>Impressões e cliques dos últimos {periodDays} dias.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="adsImpressionsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="adsClicksFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Area type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--primary))" fill="url(#adsImpressionsFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(var(--accent))" fill="url(#adsClicksFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top locais</CardTitle>
                <CardDescription>Locais com maior volume de entrega no período.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bySlot.slice(0, 8)} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="slot_name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={110} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="impressions" name="Impressões" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6 space-y-4">
          <CampaignsPanel
            campaigns={campaigns}
            onCreate={createCampaign}
            onUpdate={updateCampaign}
            onDelete={deleteCampaign}
            onToggleStatus={toggleCampaignStatus}
            onManageCreatives={(campaignId) => {
              setSelectedCampaignId(campaignId);
              setTab('creatives');
            }}
          />
        </TabsContent>

        <TabsContent value="creatives" className="mt-6 space-y-4">
          <CreativesPanel
            campaigns={campaigns}
            placements={placements}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
          />
        </TabsContent>

        <TabsContent value="targeting" className="mt-6 space-y-4">
          <TargetingPanel
            campaigns={campaigns}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
          />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6 space-y-4">
          <MetricsPanel
            summary={summary}
            daily={daily}
            bySlot={bySlot}
            creativeMetrics={creativeMetrics}
            placements={placements}
            overview={overview}
            loading={metricsLoading}
            periodDays={periodDays}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, meta }: { icon: any; label: string; value: string | number; meta: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{meta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlacementCatalogSection({ placements, bySlot }: { placements: AdsPlacement[]; bySlot: AdsSlotMetric[] }) {
  const placementMap = new Map(placements.map((placement) => [placement.name, placement]));
  const metricMap = new Map(bySlot.map((metric) => [metric.slot_name, metric]));
  const groupedSlots = ADS_SLOT_CATALOG.reduce<Record<string, ManagedAdsSlot[]>>((acc, slot) => {
    if (!acc[slot.surface]) acc[slot.surface] = [];
    acc[slot.surface].push(slot);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Catálogo de locais de banners</CardTitle>
        <CardDescription>Mesmo mapeamento visual do projeto de referência, agora conectado ao CRUD da plataforma.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedSlots).map(([surface, slots]) => (
          <div key={surface} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{surface}</h3>
                <p className="text-xs text-muted-foreground">{slots.length} locais padronizados</p>
              </div>
              <Badge variant="outline">{slots.filter((slot) => placementMap.get(slot.name)?.is_active).length}/{slots.length} ativos</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot) => {
                const placement = placementMap.get(slot.name);
                const metrics = metricMap.get(slot.name);
                return (
                  <div key={slot.name} className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{slot.label}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{slot.name}</p>
                      </div>
                      <Badge variant={placement?.is_active ? 'default' : 'secondary'}>
                        {placement ? (placement.is_active ? 'Ativo' : 'Inativo') : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{slot.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{slot.format}</Badge>
                      <Badge variant="secondary">{slot.dimensions}</Badge>
                      {placement?.label && <Badge variant="secondary">{placement.label}</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Impr.</p>
                        <p className="text-sm font-semibold text-foreground">{fmt(metrics?.impressions ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Cliques</p>
                        <p className="text-sm font-semibold text-foreground">{fmt(metrics?.clicks ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">CTR</p>
                        <p className="text-sm font-semibold text-foreground">{(metrics?.ctr ?? 0).toFixed(2)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CampaignsPanel({
  campaigns,
  onCreate,
  onUpdate,
  onDelete,
  onToggleStatus,
  onManageCreatives,
}: {
  campaigns: AdsCampaign[];
  onCreate: (campaign: Partial<AdsCampaign>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<AdsCampaign>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, currentStatus: string) => Promise<void>;
  onManageCreatives: (campaignId: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AdsCampaign | null>(null);
  const [form, setForm] = useState(defaultCampaignForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingCampaign(null);
    setForm(defaultCampaignForm);
    setDialogOpen(true);
  };

  const openEdit = (campaign: AdsCampaign) => {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description ?? '',
      priority: String(campaign.priority),
      status: campaign.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome da campanha');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        priority: Number(form.priority || 10),
        status: form.status,
      };

      if (editingCampaign) {
        await onUpdate(editingCampaign.id, payload);
        toast.success('Campanha atualizada');
      } else {
        await onCreate(payload);
        toast.success('Campanha criada');
      }

      setDialogOpen(false);
    } catch {
      toast.error('Não foi possível salvar a campanha');
    } finally {
      setSaving(false);
    }
  };

  const campaignToDelete = campaigns.find((campaign) => campaign.id === deleteId) ?? null;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{campaigns.length} campanhas cadastradas</p>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nova campanha</Button>
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
                <TableHead className="w-[70px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const ctr = (campaign.impressions ?? 0) > 0 ? (((campaign.clicks ?? 0) / (campaign.impressions ?? 1)) * 100).toFixed(2) : '0.00';
                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">{campaign.description || 'Sem descrição'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'paused' ? 'secondary' : 'outline'}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.priority}</TableCell>
                    <TableCell>{campaign.creatives_count ?? 0}</TableCell>
                    <TableCell>{fmt(campaign.impressions ?? 0)}</TableCell>
                    <TableCell>{fmt(campaign.clicks ?? 0)}</TableCell>
                    <TableCell>{ctr}%</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onManageCreatives(campaign.id)}>
                            <ImageIcon className="mr-2 h-4 w-4" /> Criativos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(campaign)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggleStatus(campaign.id, campaign.status)}>
                            {campaign.status === 'active' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                            {campaign.status === 'active' ? 'Pausar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(campaign.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma campanha criada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Editar campanha' : 'Nova campanha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCampaign ? 'Salvar alterações' : 'Criar campanha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToDelete?.name ? `Esta ação remove ${campaignToDelete.name}.` : 'Esta ação remove a campanha selecionada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try {
                  await onDelete(deleteId);
                  toast.success('Campanha excluída');
                } catch {
                  toast.error('Não foi possível excluir a campanha');
                } finally {
                  setDeleteId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreativesPanel({
  campaigns,
  placements,
  selectedCampaignId,
  onSelectCampaign,
}: {
  campaigns: AdsCampaign[];
  placements: AdsPlacement[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
}) {
  const { creatives, loading, createCreative, updateCreative, deleteCreative, toggleCreativeStatus } = useAdsCreatives(selectedCampaignId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewCreative, setPreviewCreative] = useState<AdsCreative | null>(null);
  const [editingCreative, setEditingCreative] = useState<AdsCreative | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [form, setForm] = useState(defaultCreativeForm);

  const filteredCreatives = useMemo(() => {
    if (!showActiveOnly) return creatives;
    return creatives.filter((creative) => creative.is_active);
  }, [creatives, showActiveOnly]);

  const openCreate = () => {
    setEditingCreative(null);
    setForm({ ...defaultCreativeForm, campaign_id: selectedCampaignId ?? '' });
    setDialogOpen(true);
  };

  const openEdit = (creative: AdsCreative) => {
    setEditingCreative(creative);
    setForm({
      campaign_id: creative.campaign_id,
      title: creative.title,
      type: creative.type,
      placement_id: creative.placement_id ?? '',
      image_url: creative.image_url ?? '',
      video_url: creative.video_url ?? '',
      html_content: creative.html_content ?? '',
      cta_text: creative.cta_text ?? '',
      cta_url: creative.cta_url ?? '',
      is_active: creative.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.campaign_id) {
      toast.error('Selecione a campanha');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Informe o título do criativo');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        campaign_id: form.campaign_id,
        title: form.title.trim(),
        type: form.type,
        placement_id: form.placement_id || null,
        image_url: form.image_url.trim() || null,
        video_url: form.video_url.trim() || null,
        html_content: form.html_content.trim() || null,
        cta_text: form.cta_text.trim() || null,
        cta_url: form.cta_url.trim() || null,
        is_active: form.is_active,
      };

      if (editingCreative) {
        await updateCreative(editingCreative.id, payload);
        toast.success('Criativo atualizado');
      } else {
        await createCreative(payload);
        toast.success('Criativo criado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Não foi possível salvar o criativo');
    } finally {
      setSaving(false);
    }
  };

  const creativeToDelete = creatives.find((creative) => creative.id === deleteId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={selectedCampaignId ?? 'all'} onValueChange={(value) => onSelectCampaign(value === 'all' ? null : value)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Todas as campanhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
            <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
            <span className="text-sm text-muted-foreground">Somente ativos</span>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Novo criativo</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criativo</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CTA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></TableCell></TableRow>
              ) : filteredCreatives.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhum criativo encontrado.</TableCell></TableRow>
              ) : filteredCreatives.map((creative) => {
                const campaign = campaigns.find((item) => item.id === creative.campaign_id);
                return (
                  <TableRow key={creative.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{creative.title}</p>
                        <p className="text-xs text-muted-foreground">{creative.image_url || creative.video_url || 'HTML inline'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{campaign?.name ?? '—'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground">{creative.placement_label ?? 'Sem local'}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{creative.placement_name ?? '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{creative.type}</Badge></TableCell>
                    <TableCell>{creative.cta_text ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={creative.is_active ? 'default' : 'secondary'}>{creative.is_active ? 'Ativo' : 'Inativo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPreviewCreative(creative)}>
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(creative)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleCreativeStatus(creative.id, creative.is_active)}>
                            {creative.is_active ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                            {creative.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(creative.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCreative ? 'Editar criativo' : 'Novo criativo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Campanha</Label>
              <Select value={form.campaign_id} onValueChange={(value) => setForm((current) => ({ ...current, campaign_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="popup">Popup</SelectItem>
                  <SelectItem value="widget">Widget</SelectItem>
                  <SelectItem value="modal">Modal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Local de exibição</Label>
              <Select value={form.placement_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, placement_id: value === 'none' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um local" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem local vinculado</SelectItem>
                  {placements.map((placement) => (
                    <SelectItem key={placement.id} value={placement.id}>{placement.label} · {placement.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>URL da imagem</Label>
              <Input value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>URL do vídeo</Label>
              <Input value={form.video_url} onChange={(event) => setForm((current) => ({ ...current, video_url: event.target.value }))} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <Label>HTML personalizado</Label>
              <Textarea value={form.html_content} onChange={(event) => setForm((current) => ({ ...current, html_content: event.target.value }))} rows={4} placeholder="Opcional para creatives inline." />
            </div>
            <div>
              <Label>Texto do CTA</Label>
              <Input value={form.cta_text} onChange={(event) => setForm((current) => ({ ...current, cta_text: event.target.value }))} />
            </div>
            <div>
              <Label>URL do CTA</Label>
              <Input value={form.cta_url} onChange={(event) => setForm((current) => ({ ...current, cta_url: event.target.value }))} placeholder="https://..." />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 rounded-lg border border-border/60 px-3 py-3">
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} />
              <span className="text-sm text-muted-foreground">Criativo ativo para entrega</span>
            </div>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCreative ? 'Salvar alterações' : 'Criar criativo'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewCreative} onOpenChange={(open) => !open && setPreviewCreative(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do criativo</DialogTitle>
          </DialogHeader>
          {previewCreative && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                {previewCreative.image_url ? (
                  <img src={previewCreative.image_url} alt={previewCreative.title} className="max-h-[360px] w-full rounded-lg object-contain" />
                ) : previewCreative.video_url ? (
                  <video src={previewCreative.video_url} controls className="max-h-[360px] w-full rounded-lg" />
                ) : previewCreative.html_content ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Visualização de HTML disponível no conteúdo inline.</div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Criativo sem mídia vinculada.</div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InfoLine label="Título" value={previewCreative.title} />
                <InfoLine label="Local" value={previewCreative.placement_label ?? previewCreative.placement_name ?? '—'} />
                <InfoLine label="CTA" value={previewCreative.cta_text ?? '—'} />
                <InfoLine label="URL CTA" value={previewCreative.cta_url ?? '—'} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir criativo?</AlertDialogTitle>
            <AlertDialogDescription>
              {creativeToDelete?.title ? `Esta ação remove ${creativeToDelete.title}.` : 'Esta ação remove o criativo selecionado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try {
                  await deleteCreative(deleteId);
                  toast.success('Criativo excluído');
                } catch {
                  toast.error('Não foi possível excluir o criativo');
                } finally {
                  setDeleteId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TargetingPanel({ campaigns, selectedCampaignId, onSelectCampaign }: {
  campaigns: AdsCampaign[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
}) {
  const { rules, addRule, removeRule } = useAdsTargeting(selectedCampaignId);
  const [form, setForm] = useState({ plan_name: '', user_role: '', country: '', device_type: '', exclude_premium: false, module_key: '' });

  const handleAdd = async () => {
    try {
      await addRule({
        plan_name: form.plan_name || null,
        user_role: form.user_role || null,
        country: form.country || null,
        device_type: form.device_type || null,
        exclude_premium: form.exclude_premium,
        module_key: form.module_key || null,
      });
      toast.success('Regra adicionada');
      setForm({ plan_name: '', user_role: '', country: '', device_type: '', exclude_premium: false, module_key: '' });
    } catch {
      toast.error('Não foi possível adicionar a regra');
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Escopo da campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedCampaignId ?? 'none'} onValueChange={(value) => onSelectCampaign(value === 'none' ? null : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!selectedCampaignId ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Escolha uma campanha para gerenciar as regras.</div>
          ) : (
            <div className="space-y-3">
              {rules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sem regras — entrega ampla para o público permitido.</div>
              ) : rules.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {rule.plan_name && <Badge variant="secondary">Plano: {rule.plan_name}</Badge>}
                    {rule.user_role && <Badge variant="secondary">Perfil: {rule.user_role}</Badge>}
                    {rule.country && <Badge variant="secondary">País: {rule.country}</Badge>}
                    {rule.device_type && <Badge variant="secondary">Device: {rule.device_type}</Badge>}
                    {rule.module_key && <Badge variant="outline">Módulo: {rule.module_key}</Badge>}
                    {rule.exclude_premium && <Badge variant="outline">Excluir premium</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nova regra de segmentação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Plano</Label>
              <Select value={form.plan_name || 'all'} onValueChange={(value) => setForm((current) => ({ ...current, plan_name: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer plano</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Perfil</Label>
              <Input value={form.user_role} onChange={(event) => setForm((current) => ({ ...current, user_role: event.target.value }))} placeholder="ex.: admin" />
            </div>
            <div>
              <Label>País</Label>
              <Input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder="BR" />
            </div>
            <div>
              <Label>Dispositivo</Label>
              <Select value={form.device_type || 'all'} onValueChange={(value) => setForm((current) => ({ ...current, device_type: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Módulo</Label>
              <Input value={form.module_key} onChange={(event) => setForm((current) => ({ ...current, module_key: event.target.value }))} placeholder="ex.: payroll" />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-3">
            <Checkbox checked={form.exclude_premium} onCheckedChange={(checked) => setForm((current) => ({ ...current, exclude_premium: checked === true }))} />
            <span className="text-sm text-muted-foreground">Excluir contas premium / enterprise</span>
          </div>
          <Button onClick={handleAdd} disabled={!selectedCampaignId} className="w-full gap-1.5">
            <Target className="h-4 w-4" /> Adicionar regra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricsPanel({
  summary,
  daily,
  bySlot,
  creativeMetrics,
  placements,
  overview,
  loading,
  periodDays,
}: {
  summary: any[];
  daily: any[];
  bySlot: AdsSlotMetric[];
  creativeMetrics: AdsCreativeMetric[];
  placements: AdsPlacement[];
  overview: { impressions: number; clicks: number; ctr: number; previousImpressions: number; previousClicks: number; previousCtr: number };
  loading: boolean;
  periodDays: string;
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard icon={Monitor} label="Impressões" value={fmt(overview.impressions)} meta={metricDelta(overview.impressions, overview.previousImpressions)} />
        <KPICard icon={MousePointer} label="Cliques" value={fmt(overview.clicks)} meta={metricDelta(overview.clicks, overview.previousClicks)} />
        <KPICard icon={TrendingUp} label="CTR médio" value={`${overview.ctr.toFixed(2)}%`} meta={`antes ${overview.previousCtr.toFixed(2)}%`} />
        <KPICard icon={LayoutTemplate} label="Locais com tráfego" value={bySlot.length} meta={`${periodDays} dias`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CTR por local</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bySlot.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="slot_name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(2)}%`, 'CTR']} />
                <Bar dataKey="ctr" name="CTR" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Impressões x Cliques</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance por campanha</CardTitle>
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
                {summary.map((item) => (
                  <TableRow key={item.campaign_id}>
                    <TableCell className="font-medium">{item.campaign_name}</TableCell>
                    <TableCell>{fmt(item.impressions)}</TableCell>
                    <TableCell>{fmt(item.clicks)}</TableCell>
                    <TableCell>{item.ctr.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
                {summary.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Sem dados de campanha.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance por local</CardTitle>
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
                {bySlot.map((item) => {
                  const placement = placementMap.get(item.slot_name);
                  return (
                    <TableRow key={item.slot_name}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{placement?.label ?? item.slot_name}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{item.slot_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{fmt(item.impressions)}</TableCell>
                      <TableCell>{fmt(item.clicks)}</TableCell>
                      <TableCell>{item.ctr.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
                {bySlot.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Sem dados por local.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top criativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criativo</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Impressões</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creativeMetrics.slice(0, 12).map((item) => (
                <TableRow key={item.creative_id}>
                  <TableCell className="font-medium">{item.creative_title}</TableCell>
                  <TableCell>{item.campaign_name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm text-foreground">{item.placement_label ?? item.placement_name ?? '—'}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{item.placement_name ?? '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{fmt(item.impressions)}</TableCell>
                  <TableCell>{fmt(item.clicks)}</TableCell>
                  <TableCell>{item.ctr.toFixed(2)}%</TableCell>
                </TableRow>
              ))}
              {creativeMetrics.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Sem dados por criativo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
