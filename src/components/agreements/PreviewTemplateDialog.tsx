/**
 * PreviewTemplateDialog — Renders agreement HTML as a styled preview with PDF download
 */

import { useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  contentHtml: string;
}

export function PreviewTemplateDialog({ open, onOpenChange, name, contentHtml }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let y = margin;
      let remainingHeight = imgHeight;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageHeight - margin * 2);
        pdf.addImage(imgData, 'PNG', margin, y - (imgHeight - remainingHeight), contentWidth, imgHeight);
        remainingHeight -= sliceHeight;
        if (remainingHeight > 0) {
          pdf.addPage();
          y = margin;
        }
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      pdf.save(`${slug}.pdf`);
      toast({ title: 'PDF gerado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  // Replace template variables with sample data for preview
  const previewHtml = contentHtml
    .replace(/\{\{nome_colaborador\}\}/g, 'João da Silva')
    .replace(/\{\{cpf\}\}/g, '123.456.789-00')
    .replace(/\{\{rg\}\}/g, '12.345.678-9')
    .replace(/\{\{cargo\}\}/g, 'Analista de RH')
    .replace(/\{\{departamento\}\}/g, 'Recursos Humanos')
    .replace(/\{\{empresa\}\}/g, 'Empresa Exemplo Ltda')
    .replace(/\{\{cnpj_empresa\}\}/g, '12.345.678/0001-90')
    .replace(/\{\{data_admissao\}\}/g, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{\{matricula\}\}/g, 'MAT-00123')
    .replace(/\{\{endereco\}\}/g, 'Rua Exemplo, 123 - Centro')
    .replace(/\{\{salario\}\}/g, 'R$ 5.000,00')
    .replace(/\{\{jornada\}\}/g, '44h semanais')
    .replace(/\{\{gestor\}\}/g, 'Maria Souza')
    .replace(/\{\{unidade\}\}/g, 'Matriz')
    .replace(/\{\{email\}\}/g, 'joao@empresa.com')
    .replace(/\{\{telefone\}\}/g, '(11) 99999-0000');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Pré-visualização: {name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border border-border rounded-lg bg-white">
          <div
            ref={contentRef}
            className="p-8 text-sm text-black leading-relaxed prose prose-sm max-w-none"
            style={{ fontFamily: 'serif', color: '#000' }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          * As variáveis foram substituídas por dados fictícios para fins de visualização.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          <Button onClick={handleDownloadPdf} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
