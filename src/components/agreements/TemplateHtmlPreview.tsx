/**
 * TemplateHtmlPreview — Live preview panel for agreement HTML content.
 * Replaces template variables with sample data and renders styled document preview.
 */

import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Eye } from 'lucide-react';

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

export function replaceVariables(html: string, highlight = false): string {
  let result = html;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    const replacement = highlight
      ? `<span style="color:#dc2626;font-weight:700">${value}</span>`
      : value;
    result = result.split(key).join(replacement);
  }
  return result;
}

interface Props {
  contentHtml: string;
  title?: string;
  companyName?: string;
  primaryColor?: string;
}

export function TemplateHtmlPreview({ contentHtml, title = 'Termo', companyName = 'Empresa Exemplo Ltda', primaryColor = '#0f7a4d' }: Props) {
  const previewHtml = useMemo(() => replaceVariables(contentHtml, true), [contentHtml]);
  const today = new Date().toLocaleDateString('pt-BR');

  if (!contentHtml.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
        <Eye className="h-10 w-10 opacity-30" />
        <p className="text-sm text-center">
          Digite o conteúdo HTML à esquerda para ver o preview ao vivo aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1.5 border-b border-border bg-muted/30 flex items-center gap-1.5 shrink-0">
        <Eye className="h-3 w-3" />
        Preview ao vivo
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Header */}
        <div className="px-5 pt-4 pb-2 border-b-2" style={{ borderColor: primaryColor }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold" style={{ color: primaryColor, letterSpacing: '0.4px' }}>{companyName}</div>
              <div className="text-[9px] text-gray-500 mt-0.5">Documento Oficial</div>
            </div>
            <div className="text-[9px] text-gray-500">{today}</div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-gray-700 text-center uppercase tracking-wider">
            {title || 'Termo'}
          </div>
        </div>

        {/* Body */}
        <div
          className="px-5 py-4 text-[11px] leading-relaxed prose prose-sm max-w-none"
          style={{ fontFamily: 'Georgia, serif', color: '#222' }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <QRCodeSVG
                value={`${window.location.origin}/verificar/SAMPLE`}
                size={36}
                level="M"
                fgColor={primaryColor}
                className="border border-gray-200 rounded p-0.5"
              />
              <div>
                <div className="text-[7px] text-gray-400 uppercase tracking-wider">Código Validador</div>
                <div className="text-[9px] font-semibold font-mono tracking-wider text-gray-700">DOC-PREVIEW</div>
              </div>
            </div>
            <div className="text-[8px] text-gray-400">Página 1 de 1</div>
          </div>
        </div>
      </div>
      <div className="text-[9px] text-muted-foreground px-3 py-1.5 border-t border-border shrink-0 flex items-center gap-2">
        <span style={{ color: '#dc2626', fontWeight: 700 }}>■</span>
        Textos em <strong style={{ color: '#dc2626' }}>vermelho e negrito</strong> são variáveis substituídas por dados fictícios.
      </div>
    </div>
  );
}
