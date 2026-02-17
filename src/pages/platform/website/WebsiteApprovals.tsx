/**
 * /platform/website/approvals — Website governance workflow UI.
 */
import { useState } from 'react';
import { ShieldCheck, Clock, CheckCircle2, XCircle, Send, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getWebsiteStatusLabel,
  getWebsiteStatusVariant,
  getWebsiteAvailableTransitions,
  type WebsiteGovernanceStatus,
} from '@/domains/website-builder/website-governance-engine';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';

interface MockPage {
  id: string;
  title: string;
  slug: string;
  status: WebsiteGovernanceStatus;
  createdBy: string;
  updatedAt: string;
}

const MOCK_PAGES: MockPage[] = [
  { id: '1', title: 'Home — Redesign Q1', slug: '/', status: 'submitted', createdBy: 'marketing@example.com', updatedAt: '2026-02-15' },
  { id: '2', title: 'Página de Preços v2', slug: '/precos', status: 'approved', createdBy: 'design@example.com', updatedAt: '2026-02-14' },
  { id: '3', title: 'Landing Funcionalidades', slug: '/funcionalidades', status: 'draft', createdBy: 'content@example.com', updatedAt: '2026-02-13' },
  { id: '4', title: 'Blog — Nova Estrutura', slug: '/blog', status: 'published', createdBy: 'marketing@example.com', updatedAt: '2026-02-10' },
  { id: '5', title: 'Página Sobre — Atualização', slug: '/sobre', status: 'submitted', createdBy: 'design@example.com', updatedAt: '2026-02-16' },
];

const statusIcons: Record<WebsiteGovernanceStatus, typeof Clock> = {
  draft: Clock,
  submitted: Send,
  approved: CheckCircle2,
  published: CheckCircle2,
  archived: Archive,
};

export default function WebsiteApprovals() {
  const { identity } = usePlatformIdentity();
  const userRole = (identity?.role ?? 'platform_viewer') as PlatformRoleType;
  const [pages, setPages] = useState(MOCK_PAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const selected = pages.find((p) => p.id === selectedId);
  const transitions = selected ? getWebsiteAvailableTransitions(selected.status, userRole) : [];

  const handleTransition = (targetStatus: WebsiteGovernanceStatus) => {
    if (!selectedId) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? { ...p, status: targetStatus, updatedAt: new Date().toISOString().split('T')[0] }
          : p,
      ),
    );
    setNotes('');
  };

  const grouped = {
    pending: pages.filter((p) => p.status === 'submitted'),
    approved: pages.filter((p) => p.status === 'approved'),
    drafts: pages.filter((p) => p.status === 'draft'),
    published: pages.filter((p) => p.status === 'published' || p.status === 'archived'),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Aprovações Website</h1>
          <p className="text-sm text-muted-foreground">
            Workflow: Rascunho → Submetido → Aprovado → Publicado
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', count: grouped.pending.length, color: 'text-warning' },
          { label: 'Aprovados', count: grouped.approved.length, color: 'text-accent' },
          { label: 'Rascunhos', count: grouped.drafts.length, color: 'text-muted-foreground' },
          { label: 'Publicados', count: grouped.published.length, color: 'text-primary' },
        ].map(({ label, count, color }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card/60 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          <ScrollArea className="rounded-lg border border-border/60 bg-card/60 max-h-[calc(100vh-22rem)]">
            <div className="divide-y divide-border/40">
              {pages.map((page) => {
                const StatusIcon = statusIcons[page.status];
                return (
                  <button
                    key={page.id}
                    onClick={() => setSelectedId(page.id)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30 ${
                      selectedId === page.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <StatusIcon className={`h-4 w-4 shrink-0 ${
                      page.status === 'submitted' ? 'text-warning' :
                      page.status === 'approved' ? 'text-accent' :
                      page.status === 'published' ? 'text-primary' :
                      'text-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{page.title}</p>
                      <p className="text-[10px] text-muted-foreground">{page.slug} • {page.createdBy}</p>
                    </div>
                    <Badge variant={getWebsiteStatusVariant(page.status)} className="text-[10px] shrink-0">
                      {getWebsiteStatusLabel(page.status)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground shrink-0">{page.updatedAt}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-3">
                <h3 className="text-sm font-bold text-foreground">{selected.title}</h3>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Slug: <span className="font-mono">{selected.slug}</span></p>
                  <p className="text-[11px] text-muted-foreground">Criado por: {selected.createdBy}</p>
                  <p className="text-[11px] text-muted-foreground">Atualizado: {selected.updatedAt}</p>
                </div>
                <Badge variant={getWebsiteStatusVariant(selected.status)}>
                  {getWebsiteStatusLabel(selected.status)}
                </Badge>
              </div>

              {transitions.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-3">
                  <p className="text-xs font-bold text-foreground">Ações Disponíveis</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas (opcional)..."
                    rows={2}
                    className="text-xs resize-none"
                  />
                  <div className="flex flex-col gap-2">
                    {transitions.map((t) => (
                      <Button
                        key={t.to}
                        size="sm"
                        variant={t.to === 'draft' ? 'destructive' : 'default'}
                        onClick={() => handleTransition(t.to)}
                        className="text-xs justify-start"
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-border/60 bg-card/60 p-8 text-center">
              <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Selecione uma página para ver detalhes e ações de governança.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
