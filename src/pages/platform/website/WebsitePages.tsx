/**
 * /platform/website/pages — Website Drag & Drop Editor
 */
import { Paintbrush } from 'lucide-react';
import { DragDropEditor } from '@/components/website-builder/DragDropEditor';

export default function WebsitePages() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Paintbrush className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Editor Drag & Drop</h1>
          <p className="text-sm text-muted-foreground">Monte o layout das páginas arrastando e reorganizando seções.</p>
        </div>
      </div>
      <DragDropEditor />
    </div>
  );
}
