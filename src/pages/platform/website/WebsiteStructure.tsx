/**
 * /platform/website/structure — Website structure/hierarchy manager.
 */
import { Network } from 'lucide-react';

export default function WebsiteStructure() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Network className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Estrutura do Website</h1>
          <p className="text-sm text-muted-foreground">Hierarquia de páginas, menus e navegação do site institucional.</p>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">Gestor de estrutura em desenvolvimento.</p>
      </div>
    </div>
  );
}
