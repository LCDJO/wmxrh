/**
 * RoleSuggestionPanel — AI-powered permission suggestions when creating/editing a role.
 * Shows "Sugestão baseada em outros tenants semelhantes" with checkable permissions.
 *
 * SECURITY: This component NEVER applies suggestions automatically.
 * The user MUST manually select suggestions and click "Aplicar" to
 * trigger onApplySuggestions. No mutation happens without explicit confirmation.
 */
import { useState, useEffect } from 'react';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import type { CognitiveSuggestion } from '@/domains/platform-cognitive/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Brain, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  roleName: string;
  /** Called when user accepts suggestions — passes permission codes to toggle. */
  onApplySuggestions: (permissionCodes: string[]) => void;
  /** Currently selected permission codes (to show which are already on). */
  currentPermissionCodes?: Set<string>;
}

export function RoleSuggestionPanel({ roleName, onApplySuggestions, currentPermissionCodes }: Props) {
  const { ask, loading, response } = usePlatformCognitive();
  const { identity } = usePlatformIdentity();
  const [expanded, setExpanded] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState(false);

  // Auto-fetch when role name is provided and long enough
  useEffect(() => {
    if (roleName.length >= 3 && !fetched && identity) {
      setFetched(true);
      ask('suggest-permissions', { role: identity.role, email: identity.email }, { role_name: roleName });
    }
  }, [roleName, fetched, identity, ask]);

  // Reset when role name changes significantly
  useEffect(() => {
    setFetched(false);
    setSelectedCodes(new Set());
  }, [roleName]);

  const suggestions = response?.suggestions ?? [];
  const permSuggestions = suggestions.filter(s => s.type === 'permission');

  const toggleCode = (code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleApply = () => {
    onApplySuggestions(Array.from(selectedCodes));
    setSelectedCodes(new Set());
  };

  if (!roleName || roleName.length < 3) return null;

  return (
    <div className="rounded-lg border border-[hsl(265_60%_50%/0.2)] bg-[hsl(265_60%_50%/0.03)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[hsl(265_60%_50%/0.05)] transition-colors"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(265_60%_50%/0.1)]">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(265_80%_55%)]" />
          ) : (
            <Brain className="h-3.5 w-3.5 text-[hsl(265_80%_55%)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[hsl(265_80%_55%)]" />
            Sugestão baseada em outros tenants semelhantes
          </p>
          {response?.summary && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{response.summary}</p>
          )}
        </div>
        {permSuggestions.length > 0 && (
          <Badge variant="outline" className="text-[9px] border-[hsl(265_60%_50%/0.3)] text-[hsl(265_60%_45%)]">
            {permSuggestions.length} sugestões
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-[hsl(265_60%_50%/0.15)] px-3.5 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando padrões de permissão...
            </div>
          )}

          {!loading && permSuggestions.length === 0 && fetched && (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhuma sugestão disponível para "{roleName}".
            </p>
          )}

          {permSuggestions.length > 0 && (
            <>
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-1.5">
                  {permSuggestions.map((s) => {
                    const code = s.metadata?.permission_code as string ?? s.title;
                    const alreadyOn = currentPermissionCodes?.has(code);
                    const isSelected = selectedCodes.has(code);
                    const confidence = Math.round(s.confidence * 100);

                    return (
                      <label
                        key={s.id}
                        className={cn(
                          'flex items-start gap-2.5 rounded-md border p-2.5 transition-colors cursor-pointer',
                          alreadyOn
                            ? 'border-primary/20 bg-primary/5 opacity-70'
                            : isSelected
                              ? 'border-[hsl(265_60%_50%/0.3)] bg-[hsl(265_60%_50%/0.06)]'
                              : 'border-border/50 hover:bg-muted/30'
                        )}
                      >
                        <Checkbox
                          checked={alreadyOn || isSelected}
                          disabled={alreadyOn}
                          onCheckedChange={() => !alreadyOn && toggleCode(code)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {alreadyOn && <Check className="h-3 w-3 text-primary shrink-0" />}
                            <p className="text-xs font-medium text-foreground">{s.title}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] shrink-0',
                            confidence >= 75 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              : confidence >= 45 ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                                : 'text-muted-foreground'
                          )}
                        >
                          {confidence}%
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>

              {selectedCodes.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="w-full gap-2 bg-[hsl(265_60%_50%)] hover:bg-[hsl(265_60%_45%)] text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  Aplicar {selectedCodes.size} sugestões
                </Button>
              )}
            </>
          )}

          {!loading && !fetched && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-[hsl(265_60%_50%/0.25)] text-[hsl(265_60%_45%)]"
              onClick={() => {
                if (identity) {
                  setFetched(true);
                  ask('suggest-permissions', { role: identity.role, email: identity.email }, { role_name: roleName });
                }
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Obter sugestões de permissões
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
