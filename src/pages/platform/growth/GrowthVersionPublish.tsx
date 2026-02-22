/**
 * GrowthVersionPublish — Version management + secure publish pipeline UI.
 *
 * Features:
 *  - Version history timeline for each landing page
 *  - Visual diff between versions
 *  - Isolated preview of any version
 *  - Rollback to previous version
 *  - Secure publish with permission-gated pipeline
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  History, Eye, RotateCcw, Upload, GitCompare, Shield, Clock,
  CheckCircle, XCircle, AlertTriangle, FileText, Lock
} from 'lucide-react';
import { landingPageBuilder } from '@/domains/platform-growth/landing-page-builder';
import { versioningManager } from '@/domains/platform-growth/versioning-manager';
import { securePublishService } from '@/domains/platform-growth/secure-publish-service';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';
import type { LandingPage } from '@/domains/platform-growth/types';
import type { PageVersion, VersionDiff } from '@/domains/platform-growth/versioning-manager';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';

export default function GrowthVersionPublish() {
  const { can, role } = usePlatformPermissions();
  const canPublish = can('landing_page.publish');

  const [pages, setPages] = useState<LandingPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [publishing, setPublishing] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffVersionA, setDiffVersionA] = useState<number | null>(null);
  const [diffVersionB, setDiffVersionB] = useState<number | null>(null);
  const [diffs, setDiffs] = useState<VersionDiff[]>([]);

  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);

  const selectedPage = pages.find(p => p.id === selectedPageId) ?? null;

  // ── Load pages ───────────────────────────────────
  useEffect(() => {
    landingPageBuilder.getAll().then(data => {
      setPages(data);
      if (data.length > 0 && !selectedPageId) setSelectedPageId(data[0].id);
      setLoading(false);
    });
  }, []);

  // ── Load versions when page changes ──────────────
  useEffect(() => {
    if (selectedPageId) {
      setVersions(versioningManager.getVersions(selectedPageId));
    }
  }, [selectedPageId]);

  const refreshVersions = useCallback(() => {
    if (selectedPageId) setVersions(versioningManager.getVersions(selectedPageId));
  }, [selectedPageId]);

  // ── Create Snapshot ──────────────────────────────
  const handleSnapshot = useCallback(async () => {
    if (!selectedPage) return;
    versioningManager.snapshot(selectedPage, role ?? 'unknown', 'Snapshot manual');
    refreshVersions();
    toast.success('Snapshot criado com sucesso.');
  }, [selectedPage, role, refreshVersions]);

  // ── Publish ──────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!selectedPageId || !role) return;
    setPublishing(true);
    try {
      const result = await securePublishService.publish(
        selectedPageId,
        'current-user',
        role as PlatformRoleType,
        { changeNotes, forcePublish: false }
      );
      if (result.success) {
        toast.success(`Página publicada! Versão ${result.versionCreated}`);
        refreshVersions();
        // Reload page data
        const updated = await landingPageBuilder.getAll();
        setPages(updated);
      } else {
        result.errors.forEach(e => {
          if (e.severity === 'blocking') toast.error(e.message);
          else toast.warning(e.message);
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar.');
    } finally {
      setPublishing(false);
      setPublishOpen(false);
      setChangeNotes('');
    }
  }, [selectedPageId, role, changeNotes, refreshVersions]);

  // ── Rollback ─────────────────────────────────────
  const handleRollback = useCallback(async () => {
    if (!selectedPageId || !role || rollbackTarget === null) return;
    const result = await securePublishService.rollback(
      selectedPageId,
      rollbackTarget,
      'current-user',
      role as PlatformRoleType
    );
    if (result.success) {
      toast.success(`Rollback para versão ${rollbackTarget} aplicado.`);
      const updated = await landingPageBuilder.getAll();
      setPages(updated);
    } else {
      result.errors.forEach(e => toast.error(e.message));
    }
    setRollbackTarget(null);
  }, [selectedPageId, role, rollbackTarget]);

  // ── Diff ─────────────────────────────────────────
  const handleDiff = useCallback(() => {
    if (!selectedPageId || diffVersionA === null || diffVersionB === null) return;
    const result = versioningManager.diff(selectedPageId, diffVersionA, diffVersionB);
    setDiffs(result);
    setDiffOpen(true);
  }, [selectedPageId, diffVersionA, diffVersionB]);

  // ── Preview ──────────────────────────────────────
  const previewData = previewVersion !== null && selectedPageId
    ? versioningManager.getPreviewSnapshot(selectedPageId, previewVersion)
    : null;

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Versionamento & Publicação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie versões, compare mudanças e publique com segurança.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPublish ? (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
              <Shield className="h-3 w-3 mr-1" /> Permissão para publicar
            </Badge>
          ) : (
            <Badge variant="outline" className="text-destructive border-destructive/30">
              <Lock className="h-3 w-3 mr-1" /> Sem permissão para publicar
            </Badge>
          )}
        </div>
      </div>

      {/* Page Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Landing Page</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={selectedPageId ?? ''} onValueChange={setSelectedPageId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione uma página" />
              </SelectTrigger>
              <SelectContent>
                {pages.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.status === 'published' ? '🟢 Publicada' : '🟡 Rascunho'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleSnapshot} disabled={!selectedPage}>
              <FileText className="h-4 w-4 mr-1" /> Criar Snapshot
            </Button>
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={!selectedPage || !canPublish}
            >
              <Upload className="h-4 w-4 mr-1" /> Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Histórico de Versões
            </CardTitle>
            <CardDescription>
              {versions.length} versão(ões) registrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma versão registrada. Crie um snapshot ou publique para iniciar o histórico.
              </p>
            ) : (
              <ScrollArea className="h-[420px] pr-4">
                <div className="space-y-3">
                  {[...versions].reverse().map((v, idx) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          v{v.version}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{v.snapshot.name}</span>
                          <Badge variant={v.snapshot.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                            {v.snapshot.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {v.changeNotes || 'Sem notas'} • {new Date(v.createdAt).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.snapshot.blocks.length} blocos • por {v.createdBy}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Preview isolado"
                          onClick={() => { setPreviewVersion(v.version); setPreviewOpen(true); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Rollback"
                          disabled={!canPublish}
                          onClick={() => setRollbackTarget(v.version)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Diff Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> Comparar Versões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={diffVersionA?.toString() ?? ''}
              onValueChange={v => setDiffVersionA(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Versão A" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.version.toString()}>
                    v{v.version} — {v.changeNotes || v.snapshot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={diffVersionB?.toString() ?? ''}
              onValueChange={v => setDiffVersionB(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Versão B" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.version.toString()}>
                    v{v.version} — {v.changeNotes || v.snapshot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              variant="outline"
              disabled={diffVersionA === null || diffVersionB === null || diffVersionA === diffVersionB}
              onClick={handleDiff}
            >
              <GitCompare className="h-4 w-4 mr-1" /> Comparar
            </Button>

            <Separator />

            {/* Pipeline Status */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de Publicação</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  {canPublish ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  Permissão de publicação
                </div>
                <div className="flex items-center gap-2">
                  {selectedPage && selectedPage.blocks.length >= 2
                    ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                    : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  Mínimo 2 blocos
                </div>
                <div className="flex items-center gap-2">
                  {selectedPage?.blocks.some(b => b.type === 'cta')
                    ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                    : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  Bloco CTA presente
                </div>
                <div className="flex items-center gap-2">
                  {selectedPage && selectedPage.slug && selectedPage.slug.length >= 2
                    ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  Slug válido
                </div>
                <div className="flex items-center gap-2">
                  {selectedPage?.blocks.every(b => b.fab.feature && b.fab.advantage && b.fab.benefit)
                    ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                    : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  FAB completo em todos os blocos
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Publish Dialog ──────────────────────────── */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Publicação Segura
            </DialogTitle>
            <DialogDescription>
              Um snapshot será criado automaticamente antes da publicação.
              A página passará pela validação completa do pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Notas da publicação</label>
              <Textarea
                placeholder="Descreva as mudanças desta versão..."
                value={changeNotes}
                onChange={e => setChangeNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            {selectedPage && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Página:</strong> {selectedPage.name}</p>
                <p><strong>Slug:</strong> /{selectedPage.slug}</p>
                <p><strong>Blocos:</strong> {selectedPage.blocks.length}</p>
                <p><strong>Status atual:</strong> {selectedPage.status}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publicando...' : 'Publicar Agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rollback Confirm ───────────────────────── */}
      <Dialog open={rollbackTarget !== null} onOpenChange={() => setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" /> Confirmar Rollback
            </DialogTitle>
            <DialogDescription>
              A página será revertida para a versão {rollbackTarget}. Esta ação substituirá o conteúdo atual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRollback}>
              Confirmar Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diff Dialog ────────────────────────────── */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Diff: v{diffVersionA} → v{diffVersionB}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {diffs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem diferenças encontradas.</p>
            ) : (
              <div className="space-y-2">
                {diffs.map((d, i) => (
                  <div key={i} className="border rounded-lg p-3 text-sm">
                    <p className="font-mono text-xs text-muted-foreground">{d.field}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-destructive line-through">
                        {d.before !== null ? String(d.before) : '(vazio)'}
                      </span>
                      <span className="text-emerald-600">
                        {d.after !== null ? String(d.after) : '(removido)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Isolated Preview Dialog ────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview Isolado — Versão {previewVersion}
              <Badge variant="outline" className="ml-2">Somente leitura</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg bg-background">
            {previewData ? (
              <LandingPageRenderer
                page={{
                  id: selectedPageId!,
                  name: previewData.name,
                  slug: previewData.slug,
                  status: previewData.status,
                  blocks: previewData.blocks,
                  analytics: { views: 0, uniqueVisitors: 0, conversions: 0, conversionRate: 0, avgTimeOnPage: 0, bounceRate: 0, topSources: [] },
                  created_at: '',
                  updated_at: '',
                }}
                industry="default"
                modules={[]}
              />
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum preview disponível.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
