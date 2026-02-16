/**
 * CognitivePanel — Slide-out panel powered by PlatformCognitiveLayer architecture.
 */
import { useState } from 'react';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import type { CognitiveIntent, CognitiveSuggestion } from '@/domains/platform-cognitive/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain, Sparkles, Loader2, Shield, LayoutDashboard, Zap, Eye, Settings,
  ChevronRight, Lightbulb, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INTENT_OPTIONS: { intent: CognitiveIntent; label: string; icon: React.ElementType; desc: string }[] = [
  { intent: 'suggest-permissions', label: 'Permissões', icon: Shield, desc: 'Sugere permissões ideais para um cargo' },
  { intent: 'recommend-dashboards', label: 'Dashboards', icon: LayoutDashboard, desc: 'Recomenda painéis relevantes' },
  { intent: 'suggest-shortcuts', label: 'Atalhos', icon: Zap, desc: 'Atalhos de navegação inteligentes' },
  { intent: 'detect-patterns', label: 'Padrões', icon: Eye, desc: 'Detecta padrões operacionais' },
  { intent: 'quick-setup', label: 'Setup Rápido', icon: Settings, desc: 'Guia de configuração otimizada' },
];

const TYPE_ICON: Record<string, React.ElementType> = {
  permission: Shield,
  dashboard: LayoutDashboard,
  shortcut: Zap,
  pattern: TrendingUp,
  setup: Settings,
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

function confidenceLevel(c: number) {
  if (c >= 0.75) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}

function SuggestionCard({ s }: { s: CognitiveSuggestion }) {
  const Icon = TYPE_ICON[s.type] ?? Lightbulb;
  const level = confidenceLevel(s.confidence);
  return (
    <div className="rounded-lg border p-3.5 space-y-2 hover:bg-muted/40 transition-colors">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{s.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
        </div>
        <Badge variant="outline" className={cn('text-[9px] shrink-0', CONFIDENCE_COLOR[level])}>
          {Math.round(s.confidence * 100)}%
        </Badge>
      </div>
      {s.action_label && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
          {s.action_label} <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function CognitivePanel() {
  const { ask, loading, response, clear } = usePlatformCognitive();
  const { identity } = usePlatformIdentity();
  const [open, setOpen] = useState(false);
  const [activeIntent, setActiveIntent] = useState<CognitiveIntent | null>(null);

  const handleAsk = async (intent: CognitiveIntent) => {
    if (!identity) return;
    setActiveIntent(intent);
    await ask(intent, { role: identity.role, email: identity.email });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { clear(); setActiveIntent(null); } }}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-[hsl(265_60%_50%/0.25)] text-[hsl(265_60%_45%)] hover:bg-[hsl(265_60%_50%/0.08)]"
        >
          <Brain className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cognitive</span>
          <Sparkles className="h-3 w-3 text-[hsl(265_80%_55%)]" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(265_60%_50%/0.12)]">
              <Brain className="h-5 w-5 text-[hsl(265_80%_55%)]" />
            </div>
            <div>
              <SheetTitle className="text-base">Platform Cognitive Layer</SheetTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Inteligência contextual • 6 advisors • Apenas sugestões
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Intent selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consultar Advisor</p>
              <div className="grid gap-2">
                {INTENT_OPTIONS.map(({ intent, label, icon: IIcon, desc }) => (
                  <button
                    key={intent}
                    disabled={loading}
                    onClick={() => handleAsk(intent)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                      activeIntent === intent
                        ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                        : 'hover:bg-muted/50',
                      loading && 'opacity-60 cursor-wait',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {loading && activeIntent === intent
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <IIcon className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {response && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[hsl(265_80%_55%)]" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sugestões</p>
                  </div>
                  <p className="text-sm text-muted-foreground italic">{response.summary}</p>
                  <div className="space-y-2.5">
                    {response.suggestions.map((s) => (
                      <SuggestionCard key={s.id} s={s} />
                    ))}
                  </div>
                  {response.suggestions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma sugestão no momento.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              ⚡ Cognitive Layer — apenas recomendações
            </p>
            <Badge variant="outline" className="text-[9px] gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              6 Advisors
            </Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
