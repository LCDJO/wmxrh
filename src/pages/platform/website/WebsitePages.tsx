/**
 * /platform/website/pages — Website institutional pages manager.
 */
import { FileText } from 'lucide-react';

export default function WebsitePages() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Páginas do Website</h1>
          <p className="text-sm text-muted-foreground">Gerencie as páginas institucionais do website da plataforma.</p>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">Editor de páginas em desenvolvimento — em breve com drag-and-drop híbrido.</p>
      </div>
    </div>
  );
}
