/**
 * PreviewTemplateDialog — Renders agreement HTML as a styled preview with PDF download
 * Uses pdfDocumentGenerator for section-based PDF with header, footer, QR code & validator.
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateDocumentPdf } from '@/services/pdfDocumentGenerator';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  contentHtml: string;
  companyName?: string;
}

const SAMPLE_DATA: Record<string, string> = {
  '{{nome_colaborador}}': 'João da Silva',
  '{{cpf}}': '123.456.789-00',
  '{{rg}}': '12.345.678-9',
  '{{cargo}}': 'Analista de RH',
  '{{departamento}}': 'Recursos Humanos',
  '{{empresa}}': 'Empresa Exemplo Ltda',
  '{{cnpj_empresa}}': '12.345.678/0001-90',
  '{{data_admissao}}': new Date().toLocaleDateString('pt-BR'),
  '{{data_atual}}': new Date().toLocaleDateString('pt-BR'),
  '{{matricula}}': 'MAT-00123',
  '{{endereco}}': 'Rua Exemplo, 123 - Centro',
  '{{salario}}': 'R$ 5.000,00',
  '{{jornada}}': '44h semanais',
  '{{gestor}}': 'Maria Souza',
  '{{unidade}}': 'Matriz',
  '{{email}}': 'joao@empresa.com',
  '{{telefone}}': '(11) 99999-0000',
};

function replaceVariables(html: string): string {
  let result = html;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    result = result.split(key).join(value);
  }
  return result;
}

export function PreviewTemplateDialog({ open, onOpenChange, name, contentHtml, companyName = 'Empresa Exemplo Ltda' }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const previewHtml = replaceVariables(contentHtml);
  const today = new Date().toLocaleDateString('pt-BR');
  const sampleValidator = 'DOC-PREVIEW-SAMPLE';

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
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

        <div className="flex-1 overflow-y-auto border border-border rounded-lg bg-white">
          {/* ── Header ── */}
          <div className="px-8 pt-6 pb-3 border-b-2" style={{ borderColor: '#1a1a2e' }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-base font-bold" style={{ color: '#1a1a2e', letterSpacing: '0.5px' }}>{companyName}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Documento Oficial</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500">{today}</div>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-gray-700 text-center uppercase tracking-wider">
              {name}
            </div>
          </div>

          {/* ── Body ── */}
          <div
            className="px-8 py-6 text-sm leading-relaxed prose prose-sm max-w-none"
            style={{ fontFamily: 'Georgia, serif', color: '#222' }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />

          {/* ── Footer ── */}
          <div className="px-8 py-4 border-t border-gray-200 bg-gray-50/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <QRCodeSVG
                  value={`${window.location.origin}/verificar/${sampleValidator}`}
                  size={56}
                  level="M"
                  fgColor="#1a1a2e"
                  className="border border-gray-200 rounded p-0.5"
                />
                <div>
                  <div className="text-[8px] text-gray-400 uppercase tracking-wider">Código Validador</div>
                  <div className="text-[11px] font-semibold font-mono tracking-wider text-gray-700">{sampleValidator}</div>
                  <div className="text-[7px] text-gray-400 mt-0.5">Escaneie o QR Code para verificar autenticidade</div>
                </div>
              </div>
              <div className="text-[9px] text-gray-400">Página 1 de 1</div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          * As variáveis foram substituídas por dados fictícios para fins de visualização. O código validador será gerado automaticamente na versão final.
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
