/**
 * PlatformVersioning — /platform/settings/versioning
 *
 * Tabs: Platform Releases | Module Versions | Dependency Graph | Changelog
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Rocket, GitBranch, Network, FileText, ShieldAlert } from 'lucide-react';
import { ReleaseDiffViewer } from '@/components/platform/versioning/ReleaseDiffViewer';
import { ModuleVersionTimeline } from '@/components/platform/versioning/ModuleVersionTimeline';
import { DependencyGraphViewer } from '@/components/platform/versioning/DependencyGraphViewer';
import { RollbackPanel } from '@/components/platform/versioning/RollbackPanel';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { Badge } from '@/components/ui/badge';

const TABS = [
  { value: 'releases', label: 'Platform Releases', icon: Rocket },
  { value: 'modules', label: 'Module Versions', icon: GitBranch },
  { value: 'dependencies', label: 'Dependency Graph', icon: Network },
  { value: 'changelog', label: 'Changelog', icon: FileText },
] as const;

export default function PlatformVersioning() {
  const [tab, setTab] = useState<string>('releases');
  const { can } = usePlatformPermissions();

  const canPublish = can('versioning.publish');
  const canRollback = can('versioning.rollback');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Versionamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie releases, versões de módulos, dependências e rollbacks da plataforma.
          </p>
        </div>
        {(!canPublish || !canRollback) && (
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/10 gap-1">
            <ShieldAlert className="h-3 w-3" />
            Somente leitura
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-muted/50 border border-border/40">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="releases" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ReleaseDiffViewer canPublish={canPublish} />
            <RollbackPanel canRollback={canRollback} />
          </div>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          <ModuleVersionTimeline />
        </TabsContent>

        <TabsContent value="dependencies" className="mt-4">
          <DependencyGraphViewer />
        </TabsContent>

        <TabsContent value="changelog" className="mt-4">
          <ChangelogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Changelog tab (inline) ─── */
function ChangelogTab() {
  const entries = [
    { date: '2026-02-15', category: '🚀 Novas Funcionalidades', items: ['**[growth_engine]** Landing Page Builder v2 com FAB', '**[billing_core]** Suporte a múltiplas moedas'] },
    { date: '2026-02-03', category: '✨ Melhorias', items: ['**[iam]** Custom roles por empresa', '**[core_hr]** Novo fluxo de admissão'] },
    { date: '2026-01-20', category: '💥 Breaking Changes', items: ['**[billing_core]** Novo ledger financeiro imutável — migração obrigatória'] },
    { date: '2026-01-05', category: '🐛 Correções', items: ['**[core_hr]** Fix cálculo de férias proporcionais', '**[growth_engine]** Fix A/B split ratio'] },
  ];

  return (
    <div className="space-y-4">
      {entries.map((block, i) => (
        <div key={i} className="rounded-lg border border-border/40 bg-card/80 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-foreground">{block.category}</span>
            <span className="text-xs text-muted-foreground ml-auto">{new Date(block.date).toLocaleDateString('pt-BR')}</span>
          </div>
          <ul className="space-y-1">
            {block.items.map((item, j) => (
              <li key={j} className="text-sm text-foreground/80" dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>') }} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
