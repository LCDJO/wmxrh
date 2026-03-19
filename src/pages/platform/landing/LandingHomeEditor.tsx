/**
 * LandingHomeEditor — Editor visual da landing page pública (rota /).
 *
 * Workflow:
 *   draft        → editar → "Salvar Rascunho" | "Submeter para Aprovação"
 *   pending_review → (diretor) "Aprovar" | "Rejeitar" | (criador) aguardando
 *   approved     → (diretor) "Publicar no Site"
 *   published    → "Criar Nova Versão" para reeditar
 *
 * Permissões:
 *   landing.submit_for_review → submeter
 *   landing.approve / landing.reject → aprovar/rejeitar
 *   landing.publish → publicar
 *
 * Versionamento: cada publicação gera snapshot imutável via LandingVersionService.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { landingPageBuilder } from '@/domains/platform-growth/landing-page-builder';
import { landingPageGovernance } from '@/domains/platform-growth/landing-page-governance';
import { landingVersionService, type LandingVersion } from '@/domains/platform-growth/landing-version-service';
import { getStatusLabel, getStatusVariant } from '@/domains/platform-growth/landing-page-status-machine';
import type { LandingPage } from '@/domains/platform-growth/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Save, Send, CheckCircle2, Globe, Plus, Trash2,
  History, Home, XCircle, RefreshCw, Clock, ExternalLink, Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/core/use-toast';

// ─── Tipos de conteúdo da home ────────────────────────────────────────────────

export interface HomeContent {
  hero: { badge: string; heading: string; subheading: string; cta1: string; cta2: string };
  stats: Array<{ value: string; label: string }>;
  features: { sectionTitle: string; sectionSubtitle: string; items: Array<{ title: string; description: string }> };
  compliance: { sectionTitle: string; sectionSubtitle: string; items: Array<{ label: string; desc: string }> };
  highlights: { sectionTitle: string; body: string; bullets: string[]; cards: Array<{ label: string }> };
  cta: { heading: string; subheading: string; buttonText: string };
}

const HOME_SLUG = 'home';

const DEFAULT_CONTENT: HomeContent = {
  hero: {
    badge: 'Plataforma completa de RH para empresas brasileiras',
    heading: 'Gestão de RH inteligente, 100% em conformidade',
    subheading: 'Da admissão ao desligamento, passando por eSocial, folha de pagamento, segurança do trabalho e inteligência estratégica — tudo em uma única plataforma.',
    cta1: 'Acessar plataforma',
    cta2: 'Ver funcionalidades',
  },
  stats: [
    { value: '100%', label: 'Conformidade eSocial' },
    { value: 'LGPD', label: 'Totalmente adequado' },
    { value: 'Multi', label: 'Empresas por tenant' },
    { value: 'Real-time', label: 'Dados ao vivo' },
  ],
  features: {
    sectionTitle: 'Tudo que o RH moderno precisa',
    sectionSubtitle: 'Módulos integrados que cobrem desde a operação diária até a estratégia de pessoas.',
    items: [
      { title: 'Gestão de Pessoas', description: 'Controle total do ciclo de vida do colaborador: admissão, férias, promoções e desligamento.' },
      { title: 'Folha de Pagamento', description: 'Simulação e processamento de folha com cálculo automático de encargos e verbas trabalhistas.' },
      { title: 'eSocial & Conformidade', description: 'Geração e envio automático de eventos eSocial, LGPD, NR e PCMSO totalmente integrados.' },
      { title: 'Segurança do Trabalho', description: 'Gestão completa de EPIs, laudos, NRs e controle de conformidade ocupacional.' },
      { title: 'Gestão de Frota', description: 'Rastreamento GPS em tempo real via Traccar, análise de comportamento e conformidade de motoristas.' },
      { title: 'Inteligência Estratégica', description: 'Dashboards executivos com IA para decisões de RH baseadas em dados e predições de risco.' },
      { title: 'Automação de Processos', description: 'Workflow designer visual para automatizar fluxos de RH sem necessidade de código.' },
      { title: 'Acordos & Documentos', description: 'Gestão de contratos digitais com assinatura eletrônica integrada (Autentique, ClickSign, Zapsign).' },
    ],
  },
  compliance: {
    sectionTitle: 'Segurança jurídica em cada processo',
    sectionSubtitle: 'Desenhado para o mercado brasileiro com suporte nativo a todas as exigências regulatórias.',
    items: [
      { label: 'eSocial', desc: 'Geração e transmissão automática de todos os eventos' },
      { label: 'LGPD', desc: 'Gestão de consentimentos, anonimização e relatórios de conformidade' },
      { label: 'NR-01 a NR-36', desc: 'Controle de laudos, treinamentos e conformidade por NR' },
      { label: 'PCMSO', desc: 'Gestão de exames e saúde ocupacional integrada' },
      { label: 'PCCS', desc: 'Conservação auditiva e plano de cargos e salários' },
      { label: 'CIPA', desc: 'Controle de eleições, atas e conformidade de comissão' },
    ],
  },
  highlights: {
    sectionTitle: 'Multi-empresa, multi-usuário, tempo real',
    body: 'Gerencie múltiplas empresas em um único painel com isolamento total de dados, controle granular de permissões e atualizações em tempo real via Supabase Realtime.',
    bullets: [
      'Controle de acesso por roles e permissões',
      'SSO, SAML e autenticação federada',
      'Workflow designer visual sem código',
      'Integrações com Telegram, GPS e assinatura digital',
      'Dashboards executivos com IA generativa',
    ],
    cards: [
      { label: 'Multi-tenant' },
      { label: 'Segurança LGPD' },
      { label: 'Analytics em tempo real' },
      { label: 'Automações com IA' },
    ],
  },
  cta: {
    heading: 'Pronto para modernizar o RH da sua empresa?',
    subheading: 'Acesse agora e descubra como a WMX RH pode transformar a gestão de pessoas da sua organização.',
    buttonText: 'Acessar a plataforma',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function blocksToContent(blocks: LandingPage['blocks']): HomeContent {
  const homeBlock = blocks.find(b => b.id === 'home-content');
  if (homeBlock?.content) return homeBlock.content as unknown as HomeContent;
  return DEFAULT_CONTENT;
}

function contentToBlocks(content: HomeContent): LandingPage['blocks'] {
  return [{
    id: 'home-content',
    type: 'custom',
    order: 0,
    fab: { feature: '', advantage: '', benefit: '' },
    content: content as unknown as Record<string, unknown>,
  }];
}

// ─── Subcomponentes de edição ──────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

// ─── Painel de histórico de versões ───────────────────────────────────────────

function VersionHistoryPanel({ pageId }: { pageId: string }) {
  const [versions, setVersions] = useState<LandingVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    landingVersionService.getVersions(pageId).then(v => { setVersions(v); setLoading(false); });
  }, [pageId]);

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!versions.length) return <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma versão registrada ainda.</p>;

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {versions.map(v => (
        <div key={v.id} className="flex items-start justify-between rounded-lg border bg-card p-3 text-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold">v{v.version_number}</span>
              <Badge variant={v.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                {v.status === 'published' ? 'Publicada' : v.status === 'approved' ? 'Aprovada' : 'Rascunho'}
              </Badge>
            </div>
            {v.change_notes && <p className="text-xs text-muted-foreground">{v.change_notes}</p>}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
            {new Date(v.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function LandingHomeEditor() {
  const { identity, hasRole } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const isSuperAdmin = hasRole('platform_super_admin');
  const { toast } = useToast();

  const [page, setPage] = useState<LandingPage | null>(null);
  const [content, setContent] = useState<HomeContent>(DEFAULT_CONTENT);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadPage = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('slug', HOME_SLUG)
      .maybeSingle();

    if (data) {
      const lp = data as unknown as LandingPage;
      setPage(lp);
      setContent(blocksToContent(lp.blocks ?? []));

      // Find any pending approval request
      const { data: reqs } = await (supabase
        .from('landing_page_approval_requests') as any)
        .select('id, status')
        .eq('landing_page_id', lp.id)
        .in('status', ['pending_review', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1);

      setPendingRequestId(reqs?.[0]?.id ?? null);
    } else {
      setPage(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPage(); }, [loadPage]);

  // ── Criar página home se ainda não existe ─────────────────────────────────

  const handleCreate = async () => {
    setSaving(true);
    const created = await landingPageBuilder.create({
      name: 'Landing Page Principal',
      slug: HOME_SLUG,
      blocks: contentToBlocks(DEFAULT_CONTENT),
    });
    if (created) {
      toast({ title: 'Página criada!', description: 'Landing page home pronta para edição.' });
      await loadPage();
    } else {
      toast({ title: 'Erro', description: 'Não foi possível criar a página.', variant: 'destructive' });
    }
    setSaving(false);
  };

  // ── Salvar rascunho ───────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    const updated = await landingPageBuilder.update(page.id, { blocks: contentToBlocks(content) });
    if (updated) {
      setPage(updated);
      toast({ title: 'Rascunho salvo!' });
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
    setSaving(false);
  };

  // ── Submeter para aprovação ───────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!page || !identity) return;
    setActing(true);
    try {
      await landingPageGovernance.submit(page.id, { userId: identity.id, email: identity.email, role: identity.role });
      toast({ title: 'Submetida para aprovação!', description: 'O diretor será notificado.' });
      await loadPage();
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
    setActing(false);
  };

  // ── Aprovar ───────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!pendingRequestId || !identity) return;
    setActing(true);
    try {
      await landingPageGovernance.approve(pendingRequestId, { userId: identity.id, email: identity.email, role: identity.role }, 'Aprovado via editor da home.');
      toast({ title: 'Aprovada!', description: 'Clique em "Publicar no Site" para colocar a página no ar.' });
      await loadPage();
    } catch (e: unknown) {
      toast({ title: 'Erro ao aprovar', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
    setActing(false);
  };

  // ── Publicar (step explícito após aprovação) ──────────────────────────────

  const handlePublish = async () => {
    if (!page || !identity) return;
    setActing(true);
    try {
      // Busca o request aprovado mais recente para esta página
      const { data: reqs } = await (supabase
        .from('landing_page_approval_requests') as any)
        .select('id')
        .eq('landing_page_id', page.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);
      const reqId = reqs?.[0]?.id;
      if (!reqId) throw new Error('Nenhuma aprovação encontrada para publicar.');
      await landingPageGovernance.publish(reqId, { userId: identity.id, email: identity.email, role: identity.role }, 'Publicado via editor da home.');
      toast({ title: 'Publicada!', description: 'A landing page está no ar em /.' });
      await loadPage();
    } catch (e: unknown) {
      toast({ title: 'Erro ao publicar', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
    setActing(false);
  };

  // ── Rejeitar ──────────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!pendingRequestId || !identity) return;
    const reason = window.prompt('Motivo da rejeição (obrigatório):');
    if (!reason?.trim()) return;
    setActing(true);
    try {
      await landingPageGovernance.reject(pendingRequestId, { userId: identity.id, email: identity.email, role: identity.role }, reason);
      toast({ title: 'Rejeitada', description: 'A página voltou para rascunho.' });
      await loadPage();
    } catch (e: unknown) {
      toast({ title: 'Erro ao rejeitar', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
    setActing(false);
  };

  // ── Criar nova versão (após publicado) ────────────────────────────────────

  const handleNewVersion = async () => {
    if (!page) return;
    setSaving(true);
    await supabase.from('landing_pages').update({ status: 'draft' }).eq('id', page.id);
    toast({ title: 'Nova versão iniciada', description: 'Edite e submeta quando estiver pronto.' });
    await loadPage();
    setSaving(false);
  };

  // ── Publicação direta (sem fluxo de aprovação) ───────────────────────────

  const handleDirectPublish = async () => {
    if (!page) return;
    setActing(true);
    try {
      const { error } = await supabase
        .from('landing_pages')
        .update({ blocks: contentToBlocks(content) as any, status: 'published' })
        .eq('id', page.id);
      if (error) throw new Error(error.message);
      toast({ title: 'Publicada!', description: 'A landing page está no ar em /.' });
      await loadPage();
    } catch (e: unknown) {
      toast({ title: 'Erro ao publicar', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
    setActing(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="space-y-6 animate-fade-in max-w-lg mx-auto pt-20 text-center">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Home className="h-7 w-7 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display">Landing Page não configurada</h1>
          <p className="text-muted-foreground text-sm">
            A página pública da plataforma ainda não foi criada no CMS. Clique abaixo para inicializar com o conteúdo padrão.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar Landing Page Home
        </Button>
      </div>
    );
  }

  const status = (page.status ?? 'draft') as string;
  const canSubmit = can('landing.submit_for_review') && status === 'draft';
  const canApprove = can('landing.approve') && status === 'pending_review' && !!pendingRequestId;
  const canReject = can('landing.reject') && status === 'pending_review' && !!pendingRequestId;
  const canPublish = can('landing.publish') && status === 'approved';
  const canPublishNew = status === 'published' && (can('landing.submit_for_review') || isSuperAdmin);
  const canDirectPublish = isSuperAdmin && status !== 'published';
  const isEditable = status === 'draft' || isSuperAdmin;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Home className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Editor — Landing Page Home</h1>
            <p className="text-sm text-muted-foreground">Página pública em <code className="text-xs bg-muted px-1 rounded">/</code></p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getStatusVariant(status as any)}>
            {getStatusLabel(status as any)}
          </Badge>
          <Button variant="ghost" size="sm" className="gap-1.5" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Ver ao vivo
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowHistory(h => !h)}>
            <History className="h-4 w-4" /> Histórico
          </Button>
          {isEditable && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Rascunho
            </Button>
          )}
          {canDirectPublish && (
            <Button size="sm" className="gap-1.5" onClick={handleDirectPublish} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Publicar Agora
            </Button>
          )}
          {canSubmit && !canDirectPublish && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSubmit} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submeter para Aprovação
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleApprove} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aprovar
            </Button>
          )}
          {canPublish && (
            <Button size="sm" className="gap-1.5" onClick={handlePublish} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Publicar no Site
            </Button>
          )}
          {canReject && (
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleReject} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Rejeitar
            </Button>
          )}
          {canPublishNew && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleNewVersion} disabled={saving}>
              <RefreshCw className="h-4 w-4" /> Criar Nova Versão
            </Button>
          )}
        </div>
      </div>

      {/* ── Aviso de status não-editável ──────────────────────────────────── */}
      {status === 'pending_review' && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Esta versão está <strong>aguardando aprovação</strong>. Para editar, um diretor deve rejeitar primeiro.
              {canApprove && ' Como diretor, você pode aprovar e publicar diretamente acima.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'approved' && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Esta versão foi <strong>aprovada</strong>.
              {canPublish ? ' Clique em "Publicar no Site" para colocá-la no ar.' : ' Aguardando publicação pelo diretor.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'published' && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-4 flex items-center gap-3">
            <Globe className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-200">
              Página <strong>publicada e no ar</strong>.
              {canPublishNew && ' Clique em "Criar Nova Versão" para iniciar uma nova edição.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Histórico de versões ──────────────────────────────────────────── */}
      {showHistory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Versões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VersionHistoryPanel pageId={page.id} />
          </CardContent>
        </Card>
      )}

      {/* ── Editor de seções ──────────────────────────────────────────────── */}
      <Tabs defaultValue="hero">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="features">Módulos</TabsTrigger>
          <TabsTrigger value="compliance">Conformidade</TabsTrigger>
          <TabsTrigger value="highlights">Destaques</TabsTrigger>
          <TabsTrigger value="cta">CTA</TabsTrigger>
        </TabsList>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <TabsContent value="hero">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FieldRow label="Badge (texto acima do título)">
                <Input value={content.hero.badge} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, badge: e.target.value } }))} />
              </FieldRow>
              <FieldRow label="Título principal">
                <Textarea rows={2} value={content.hero.heading} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, heading: e.target.value } }))} />
              </FieldRow>
              <FieldRow label="Subtítulo">
                <Textarea rows={3} value={content.hero.subheading} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, subheading: e.target.value } }))} />
              </FieldRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Botão primário (CTA 1)">
                  <Input value={content.hero.cta1} disabled={!isEditable}
                    onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, cta1: e.target.value } }))} />
                </FieldRow>
                <FieldRow label="Botão secundário (CTA 2)">
                  <Input value={content.hero.cta2} disabled={!isEditable}
                    onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, cta2: e.target.value } }))} />
                </FieldRow>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <TabsContent value="stats">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {content.stats.map((stat, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 items-center">
                  <FieldRow label={`Valor ${i + 1}`}>
                    <Input value={stat.value} disabled={!isEditable}
                      onChange={e => setContent(c => { const s = [...c.stats]; s[i] = { ...s[i], value: e.target.value }; return { ...c, stats: s }; })} />
                  </FieldRow>
                  <FieldRow label="Rótulo">
                    <Input value={stat.label} disabled={!isEditable}
                      onChange={e => setContent(c => { const s = [...c.stats]; s[i] = { ...s[i], label: e.target.value }; return { ...c, stats: s }; })} />
                  </FieldRow>
                </div>
              ))}
              {isEditable && (
                <Button variant="outline" size="sm" className="gap-1.5 mt-2"
                  onClick={() => setContent(c => ({ ...c, stats: [...c.stats, { value: '', label: '' }] }))}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar estatística
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Features ──────────────────────────────────────────────────── */}
        <TabsContent value="features">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Título da seção">
                  <Input value={content.features.sectionTitle} disabled={!isEditable}
                    onChange={e => setContent(c => ({ ...c, features: { ...c.features, sectionTitle: e.target.value } }))} />
                </FieldRow>
                <FieldRow label="Subtítulo da seção">
                  <Input value={content.features.sectionSubtitle} disabled={!isEditable}
                    onChange={e => setContent(c => ({ ...c, features: { ...c.features, sectionSubtitle: e.target.value } }))} />
                </FieldRow>
              </div>
              <Separator />
              <div className="space-y-4">
                {content.features.items.map((item, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Módulo {i + 1}</span>
                      {isEditable && (
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => setContent(c => { const items = c.features.items.filter((_, j) => j !== i); return { ...c, features: { ...c.features, items } }; })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <FieldRow label="Título">
                      <Input value={item.title} disabled={!isEditable}
                        onChange={e => setContent(c => { const items = [...c.features.items]; items[i] = { ...items[i], title: e.target.value }; return { ...c, features: { ...c.features, items } }; })} />
                    </FieldRow>
                    <FieldRow label="Descrição">
                      <Textarea rows={2} value={item.description} disabled={!isEditable}
                        onChange={e => setContent(c => { const items = [...c.features.items]; items[i] = { ...items[i], description: e.target.value }; return { ...c, features: { ...c.features, items } }; })} />
                    </FieldRow>
                  </div>
                ))}
                {isEditable && (
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setContent(c => ({ ...c, features: { ...c.features, items: [...c.features.items, { title: '', description: '' }] } }))}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar módulo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Compliance ────────────────────────────────────────────────── */}
        <TabsContent value="compliance">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Título da seção">
                  <Input value={content.compliance.sectionTitle} disabled={!isEditable}
                    onChange={e => setContent(c => ({ ...c, compliance: { ...c.compliance, sectionTitle: e.target.value } }))} />
                </FieldRow>
                <FieldRow label="Subtítulo da seção">
                  <Input value={content.compliance.sectionSubtitle} disabled={!isEditable}
                    onChange={e => setContent(c => ({ ...c, compliance: { ...c.compliance, sectionSubtitle: e.target.value } }))} />
                </FieldRow>
              </div>
              <Separator />
              <div className="space-y-3">
                {content.compliance.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 items-end rounded-lg border p-3">
                    <FieldRow label="Label (ex: eSocial)">
                      <Input value={item.label} disabled={!isEditable}
                        onChange={e => setContent(c => { const items = [...c.compliance.items]; items[i] = { ...items[i], label: e.target.value }; return { ...c, compliance: { ...c.compliance, items } }; })} />
                    </FieldRow>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <FieldRow label="Descrição">
                          <Input value={item.desc} disabled={!isEditable}
                            onChange={e => setContent(c => { const items = [...c.compliance.items]; items[i] = { ...items[i], desc: e.target.value }; return { ...c, compliance: { ...c.compliance, items } }; })} />
                        </FieldRow>
                      </div>
                      {isEditable && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                          onClick={() => setContent(c => { const items = c.compliance.items.filter((_, j) => j !== i); return { ...c, compliance: { ...c.compliance, items } }; })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {isEditable && (
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setContent(c => ({ ...c, compliance: { ...c.compliance, items: [...c.compliance.items, { label: '', desc: '' }] } }))}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar item
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Highlights ────────────────────────────────────────────────── */}
        <TabsContent value="highlights">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FieldRow label="Título">
                <Input value={content.highlights.sectionTitle} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, highlights: { ...c.highlights, sectionTitle: e.target.value } }))} />
              </FieldRow>
              <FieldRow label="Parágrafo">
                <Textarea rows={3} value={content.highlights.body} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, highlights: { ...c.highlights, body: e.target.value } }))} />
              </FieldRow>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bullets</Label>
                {content.highlights.bullets.map((b, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input value={b} disabled={!isEditable}
                      onChange={e => setContent(c => { const bullets = [...c.highlights.bullets]; bullets[i] = e.target.value; return { ...c, highlights: { ...c.highlights, bullets } }; })} />
                    {isEditable && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                        onClick={() => setContent(c => { const bullets = c.highlights.bullets.filter((_, j) => j !== i); return { ...c, highlights: { ...c.highlights, bullets } }; })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setContent(c => ({ ...c, highlights: { ...c.highlights, bullets: [...c.highlights.bullets, ''] } }))}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar bullet
                  </Button>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cards de destaque (até 4)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {content.highlights.cards.map((card, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input value={card.label} disabled={!isEditable} placeholder="Rótulo"
                        onChange={e => setContent(c => { const cards = [...c.highlights.cards]; cards[i] = { label: e.target.value }; return { ...c, highlights: { ...c.highlights, cards } }; })} />
                      {isEditable && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                          onClick={() => setContent(c => { const cards = c.highlights.cards.filter((_, j) => j !== i); return { ...c, highlights: { ...c.highlights, cards } }; })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {isEditable && content.highlights.cards.length < 4 && (
                  <Button variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setContent(c => ({ ...c, highlights: { ...c.highlights, cards: [...c.highlights.cards, { label: '' }] } }))}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar card
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <TabsContent value="cta">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FieldRow label="Título do CTA">
                <Textarea rows={2} value={content.cta.heading} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, cta: { ...c.cta, heading: e.target.value } }))} />
              </FieldRow>
              <FieldRow label="Subtítulo">
                <Textarea rows={2} value={content.cta.subheading} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, cta: { ...c.cta, subheading: e.target.value } }))} />
              </FieldRow>
              <FieldRow label="Texto do botão">
                <Input value={content.cta.buttonText} disabled={!isEditable}
                  onChange={e => setContent(c => ({ ...c, cta: { ...c.cta, buttonText: e.target.value } }))} />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
