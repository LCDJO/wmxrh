/**
 * PreviewTemplateDialog — Full-screen styled preview with PDF download.
 * Now uses TemplateHtmlPreview for consistent rendering.
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateDocumentPdf } from '@/services/pdfDocumentGenerator';
import { replaceVariables, TemplateHtmlPreview } from './TemplateHtmlPreview';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  contentHtml: string;
  companyName?: string;
}

export function PreviewTemplateDialog({ open, onOpenChange, name, contentHtml, companyName = 'Empresa Exemplo Ltda' }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const previewHtml = replaceVariables(contentHtml);
      await generateDocumentPdf({
        companyName,
        documentTitle: name,
        contentHtml: previewHtml,
      });
      toast({ title: 'PDF gerado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Pré-visualização: {name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden border border-border rounded-lg min-h-0">
          <TemplateHtmlPreview contentHtml={contentHtml} title={name} companyName={companyName} scaleFit />
        </div>

        <p className="text-[11px] text-muted-foreground">
          * As variáveis foram substituídas por dados fictícios. O código validador será gerado automaticamente na versão final.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          <Button onClick={handleDownloadPdf} className="gap-2" disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? 'Gerando...' : 'Baixar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
