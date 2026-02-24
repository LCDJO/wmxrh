/**
 * TemplateHtmlPreview — Live preview panel for agreement HTML content.
 * Replaces template variables with sample data and renders styled document preview.
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
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
  scaleFit?: boolean;
}

export function TemplateHtmlPreview({ contentHtml, title = 'Termo', companyName = 'Empresa Exemplo Ltda', primaryColor = '#0f7a4d', scaleFit = false }: Props) {
  const previewHtml = useMemo(() => replaceVariables(contentHtml, true), [contentHtml]);
  const today = new Date().toLocaleDateString('pt-BR');

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const computeScale = useCallback(() => {
    if (!scaleFit || !containerRef.current || !pageRef.current) return;
    const containerW = containerRef.current.clientWidth - 48; // padding
    const containerH = containerRef.current.clientHeight - 48;
    const pageW = pageRef.current.scrollWidth;
    const pageH = pageRef.current.scrollHeight;
    const s = Math.min(containerW / pageW, containerH / pageH, 1);
    setScale(s);
  }, [scaleFit]);

  useEffect(() => {
    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [computeScale, contentHtml]);

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

      {/* A4 page simulation */}
      <div ref={containerRef} className="flex-1 overflow-hidden bg-gray-200/60 p-6 flex justify-center items-start">
        <div
          ref={pageRef}
          className="bg-white shadow-lg flex flex-col origin-top"
          style={{
            width: '210mm',
            minHeight: '297mm',
            maxWidth: '100%',
            fontFamily: 'Georgia, serif',
            transform: scaleFit ? `scale(${scale})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          {/* Header */}
          <div className="px-10 pt-8 pb-3 border-b-2" style={{ borderColor: primaryColor }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-bold" style={{ color: primaryColor, letterSpacing: '0.4px' }}>{companyName}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Documento Oficial</div>
              </div>
              <div className="text-[10px] text-gray-500">{today}</div>
            </div>
            <div className="mt-3 text-xs font-semibold text-gray-700 text-center uppercase tracking-wider">
              {title || 'Termo'}
            </div>
          </div>

          {/* Body — grows to fill the page */}
          <div
            className="px-10 py-6 text-xs leading-relaxed prose prose-sm max-w-none flex-1"
            style={{ color: '#222' }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />

          {/* Footer — always at the bottom */}
          <div className="px-10 py-4 border-t border-gray-200 bg-gray-50/50 mt-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <QRCodeSVG
                  value={`${window.location.origin}/verificar/SAMPLE`}
                  size={44}
                  level="M"
                  fgColor={primaryColor}
                  className="border border-gray-200 rounded p-0.5"
                />
                <div>
                  <div className="text-[8px] text-gray-400 uppercase tracking-wider">Código Validador</div>
                  <div className="text-[10px] font-semibold font-mono tracking-wider text-gray-700">DOC-PREVIEW</div>
                </div>
              </div>
              <div className="text-[9px] text-gray-400">Página 1 de 1</div>
            </div>
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
