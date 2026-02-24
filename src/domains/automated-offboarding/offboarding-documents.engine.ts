/**
 * Offboarding Document Engine — Etapa 4
 *
 * Generates all termination documents with integrity proof:
 *   1. TRCT (Termo de Rescisão do Contrato de Trabalho)
 *   2. Termo de Quitação
 *   3. Carta de Demissão (pedido_demissao only)
 *   4. Recibo de Devolução de Bens
 *
 * Each document embeds:
 *   - SHA-256 hash for integrity verification
 *   - QR Code URL for public validation
 *   - Blockchain proof reference (when available)
 */

import type { RescissionResult } from './rescission-calculator.engine';
import type { OffboardingType } from './types';
import { OFFBOARDING_TYPE_LABELS, AVISO_PREVIO_LABELS } from './types';

// ── Shared Types ──

export type OffboardingDocumentType = 'trct' | 'termo_quitacao' | 'carta_demissao' | 'recibo_devolucao_bens';

export const DOCUMENT_TYPE_LABELS: Record<OffboardingDocumentType, string> = {
  trct: 'Termo de Rescisão do Contrato de Trabalho',
  termo_quitacao: 'Termo de Quitação de Obrigações Trabalhistas',
  carta_demissao: 'Carta de Pedido de Demissão',
  recibo_devolucao_bens: 'Recibo de Devolução de Bens e Patrimônio',
};

export interface IntegrityProof {
  /** SHA-256 hash of the document content */
  hash_sha256: string;
  /** Public verification URL (embedded as QR code) */
  verification_url: string;
  /** Blockchain transaction hash (if anchored) */
  blockchain_tx?: string;
  /** Blockchain network name */
  blockchain_network?: string;
  /** Blockchain explorer URL */
  blockchain_explorer_url?: string;
  /** Document unique token for public lookup */
  document_token: string;
}

export interface OffboardingDocumentContext {
  // Employee
  employee_name: string;
  employee_cpf: string;
  employee_ctps?: string;
  employee_pis?: string;

  // Company
  company_name: string;
  company_cnpj: string;

  // Contract
  cargo: string;
  data_admissao: string;
  data_desligamento: string;
  offboarding_type: OffboardingType;
  aviso_previo_type: string;
  aviso_previo_days: number;

  // Workflow
  workflow_id: string;
  tenant_id: string;
}

export interface GeneratedDocument {
  type: OffboardingDocumentType;
  label: string;
  html: string;
  integrity?: IntegrityProof;
}

// ── Integrity Proof HTML Block ──

function renderIntegrityBlock(proof: IntegrityProof): string {
  return `
<div class="integrity-proof">
  <div class="integrity-title">🔒 Prova de Integridade</div>
  <div class="integrity-grid">
    <div class="integrity-col">
      <div class="integrity-qr">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(proof.verification_url)}" 
             alt="QR Code de Verificação" width="120" height="120" />
        <div class="integrity-qr-label">Escaneie para verificar</div>
      </div>
    </div>
    <div class="integrity-col integrity-details">
      <div class="integrity-item">
        <span class="integrity-label">Hash SHA-256:</span>
        <span class="integrity-hash">${proof.hash_sha256}</span>
      </div>
      <div class="integrity-item">
        <span class="integrity-label">Token:</span>
        <span class="integrity-value">${proof.document_token}</span>
      </div>
      ${proof.blockchain_tx ? `
      <div class="integrity-item">
        <span class="integrity-label">Blockchain:</span>
        <span class="integrity-value">${proof.blockchain_network || 'Polygon'}</span>
      </div>
      <div class="integrity-item">
        <span class="integrity-label">TX:</span>
        <span class="integrity-hash">${proof.blockchain_tx}</span>
      </div>
      ${proof.blockchain_explorer_url ? `
      <div class="integrity-item">
        <span class="integrity-label">Explorer:</span>
        <a href="${proof.blockchain_explorer_url}" class="integrity-link">${proof.blockchain_explorer_url}</a>
      </div>` : ''}` : `
      <div class="integrity-item">
        <span class="integrity-label">Blockchain:</span>
        <span class="integrity-value" style="color:#e65100;">Pendente de ancoragem</span>
      </div>`}
      <div class="integrity-item">
        <span class="integrity-label">Verificação:</span>
        <a href="${proof.verification_url}" class="integrity-link">${proof.verification_url}</a>
      </div>
    </div>
  </div>
</div>`;
}

// ── Shared CSS ──

function baseStyles(): string {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1a1a1a; padding: 20mm; line-height: 1.5; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .header h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .header .subtitle { font-size: 10px; color: #666; margin-top: 4px; }
  .disclaimer { background: #fff3cd; border: 1px solid #ffc107; padding: 8px 12px; margin-bottom: 16px; font-size: 9px; text-align: center; color: #856404; border-radius: 4px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; background: #f0f0f0; padding: 4px 8px; margin-bottom: 8px; border-left: 3px solid #333; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .info-item { display: flex; gap: 4px; }
  .info-label { font-weight: bold; min-width: 140px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 10px; }
  th { background: #f5f5f5; font-weight: bold; }
  td.currency { text-align: right; font-family: 'Courier New', monospace; }
  .total-row { font-weight: bold; background: #e8e8e8; }
  .summary-box { border: 2px solid #333; padding: 12px; margin-top: 16px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center; }
  .summary-value { font-size: 16px; font-weight: bold; }
  .summary-label { font-size: 9px; color: #666; text-transform: uppercase; }
  .fgts-box { background: #e8f5e9; border: 1px solid #4caf50; padding: 10px; margin-top: 12px; border-radius: 4px; }
  .signatures { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }
  .signature-line { border-top: 1px solid #333; padding-top: 4px; margin-top: 60px; font-size: 10px; }
  .footer { margin-top: 30px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
  .body-text { font-size: 11px; line-height: 1.8; text-align: justify; margin-bottom: 12px; }
  .item-list { margin: 8px 0; }
  .item-list li { margin-bottom: 4px; }
  /* Integrity Proof Styles */
  .integrity-proof { margin-top: 24px; border: 2px solid #1565c0; border-radius: 6px; padding: 12px; background: #e3f2fd; }
  .integrity-title { font-size: 12px; font-weight: bold; color: #1565c0; margin-bottom: 8px; text-align: center; }
  .integrity-grid { display: flex; gap: 16px; align-items: flex-start; }
  .integrity-col { flex-shrink: 0; }
  .integrity-col.integrity-details { flex: 1; }
  .integrity-qr { text-align: center; }
  .integrity-qr-label { font-size: 8px; color: #666; margin-top: 4px; }
  .integrity-item { margin-bottom: 3px; font-size: 9px; }
  .integrity-label { font-weight: bold; color: #333; }
  .integrity-hash { font-family: 'Courier New', monospace; font-size: 8px; word-break: break-all; color: #555; }
  .integrity-value { color: #333; }
  .integrity-link { color: #1565c0; text-decoration: none; font-size: 8px; word-break: break-all; }
  @media print { body { padding: 15mm; } .disclaimer, .integrity-proof, .fgts-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;
}

// ── Helpers ──

const fmt = {
  currency: (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  date: (iso: string) => new Date(iso).toLocaleDateString('pt-BR'),
  now: () => new Date().toLocaleString('pt-BR'),
};

function wrapDocument(title: string, subtitle: string, body: string, proof?: IntegrityProof): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${baseStyles()}</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <div class="subtitle">${subtitle}</div>
</div>
${body}
${proof ? renderIntegrityBlock(proof) : ''}
<div class="footer">
  Documento gerado em ${fmt.now()}
  <br/>Este documento foi gerado eletronicamente e possui verificação de integridade.
</div>
</body>
</html>`;
}

function signaturesHtml(company: string, employee: string, includeWitness = false): string {
  return `<div class="signatures" ${includeWitness ? 'style="grid-template-columns:1fr 1fr 1fr;"' : ''}>
  <div><div class="signature-line">${company}<br/>Empregador</div></div>
  <div><div class="signature-line">${employee}<br/>Trabalhador(a)</div></div>
  ${includeWitness ? '<div><div class="signature-line">Testemunha</div></div>' : ''}
</div>`;
}

// ══════════════════════════════════════════════════════════
// 1. TRCT
// ══════════════════════════════════════════════════════════

export function generateTrctHtml(ctx: OffboardingDocumentContext, rescission: RescissionResult, proof?: IntegrityProof): string {
  const tipoLabel = OFFBOARDING_TYPE_LABELS[rescission.tipo_rescisao] || rescission.tipo_rescisao;
  const avisoLabel = AVISO_PREVIO_LABELS[ctx.aviso_previo_type as keyof typeof AVISO_PREVIO_LABELS] || ctx.aviso_previo_type;
  const proventos = rescission.linhas.filter(l => l.tipo === 'provento');
  const descontos = rescission.linhas.filter(l => l.tipo === 'desconto');

  const body = `
<div class="disclaimer">⚠️ ${rescission.disclaimer}</div>

<div class="section">
  <div class="section-title">1. Identificação do Empregador</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Razão Social:</span> ${ctx.company_name}</div>
    <div class="info-item"><span class="info-label">CNPJ:</span> ${ctx.company_cnpj}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">2. Identificação do Trabalhador</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Nome:</span> ${ctx.employee_name}</div>
    <div class="info-item"><span class="info-label">CPF:</span> ${ctx.employee_cpf}</div>
    ${ctx.employee_ctps ? `<div class="info-item"><span class="info-label">CTPS:</span> ${ctx.employee_ctps}</div>` : ''}
    ${ctx.employee_pis ? `<div class="info-item"><span class="info-label">PIS/PASEP:</span> ${ctx.employee_pis}</div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">3. Dados do Contrato</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Cargo:</span> ${ctx.cargo}</div>
    <div class="info-item"><span class="info-label">Causa:</span> ${tipoLabel}</div>
    <div class="info-item"><span class="info-label">Admissão:</span> ${fmt.date(ctx.data_admissao)}</div>
    <div class="info-item"><span class="info-label">Desligamento:</span> ${fmt.date(ctx.data_desligamento)}</div>
    <div class="info-item"><span class="info-label">Aviso Prévio:</span> ${avisoLabel} (${ctx.aviso_previo_days} dias)</div>
  </div>
</div>

<div class="section">
  <div class="section-title">4. Discriminação das Verbas Rescisórias</div>
  <h4 style="margin:8px 0 4px;font-size:10px;">PROVENTOS</h4>
  <table>
    <thead><tr><th>Cód.</th><th>Descrição</th><th>Ref.</th><th>Base Legal</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>
      ${proventos.map(l => `<tr><td>${l.codigo}</td><td>${l.descricao}</td><td>${l.referencia || '—'}</td><td>${l.base_legal}</td><td class="currency">${fmt.currency(l.valor)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="4">TOTAL PROVENTOS</td><td class="currency">${fmt.currency(rescission.total_proventos)}</td></tr>
    </tbody>
  </table>
  ${descontos.length > 0 ? `
  <h4 style="margin:8px 0 4px;font-size:10px;">DESCONTOS</h4>
  <table>
    <thead><tr><th>Cód.</th><th>Descrição</th><th>Ref.</th><th>Base Legal</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>
      ${descontos.map(l => `<tr><td>${l.codigo}</td><td>${l.descricao}</td><td>${l.referencia || '—'}</td><td>${l.base_legal}</td><td class="currency">${fmt.currency(l.valor)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="4">TOTAL DESCONTOS</td><td class="currency">${fmt.currency(rescission.total_descontos)}</td></tr>
    </tbody>
  </table>` : ''}
</div>

<div class="summary-box">
  <div class="summary-grid">
    <div><div class="summary-value" style="color:#2e7d32;">${fmt.currency(rescission.total_proventos)}</div><div class="summary-label">Total Proventos</div></div>
    <div><div class="summary-value" style="color:#c62828;">${fmt.currency(rescission.total_descontos)}</div><div class="summary-label">Total Descontos</div></div>
    <div><div class="summary-value">${fmt.currency(rescission.valor_liquido)}</div><div class="summary-label">Valor Líquido</div></div>
  </div>
</div>

<div class="fgts-box">
  <div class="section-title" style="background:transparent;border-left-color:#4caf50;">5. FGTS</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Saldo FGTS:</span> ${fmt.currency(rescission.saldo_fgts)}</div>
    <div class="info-item"><span class="info-label">FGTS Mês Rescisão:</span> ${fmt.currency(rescission.fgts_mes_rescisao)}</div>
    <div class="info-item"><span class="info-label">Multa FGTS (${rescission.multa_fgts_percentual}%):</span> ${fmt.currency(rescission.multa_fgts)}</div>
    <div class="info-item"><span class="info-label"><strong>Total FGTS:</strong></span> <strong>${fmt.currency(rescission.total_fgts_a_receber)}</strong></div>
  </div>
</div>

${signaturesHtml(ctx.company_name, ctx.employee_name)}`;

  return wrapDocument('Termo de Rescisão do Contrato de Trabalho', `TRCT — ${tipoLabel}`, body, proof);
}

// ══════════════════════════════════════════════════════════
// 2. Termo de Quitação
// ══════════════════════════════════════════════════════════

export function generateTermoQuitacaoHtml(ctx: OffboardingDocumentContext, rescission: RescissionResult, proof?: IntegrityProof): string {
  const tipoLabel = OFFBOARDING_TYPE_LABELS[ctx.offboarding_type] || ctx.offboarding_type;

  const body = `
<div class="section">
  <div class="section-title">Identificação das Partes</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Empregador:</span> ${ctx.company_name} — CNPJ: ${ctx.company_cnpj}</div>
    <div class="info-item"><span class="info-label">Trabalhador:</span> ${ctx.employee_name} — CPF: ${ctx.employee_cpf}</div>
    <div class="info-item"><span class="info-label">Cargo:</span> ${ctx.cargo}</div>
    <div class="info-item"><span class="info-label">Modalidade:</span> ${tipoLabel}</div>
  </div>
</div>

<div class="section">
  <p class="body-text">
    Pelo presente <strong>Termo de Quitação Anual de Obrigações Trabalhistas</strong>, firmado com base no
    <strong>Art. 507-B da CLT</strong> (incluído pela Lei nº 13.467/2017 — Reforma Trabalhista), as partes acima
    qualificadas declaram que:
  </p>
  <p class="body-text">
    <strong>1.</strong> O empregador efetuou o pagamento integral de todas as verbas rescisórias devidas ao trabalhador,
    conforme discriminado no Termo de Rescisão do Contrato de Trabalho (TRCT) emitido nesta mesma data, no valor
    líquido de <strong>${fmt.currency(rescission.valor_liquido)}</strong>.
  </p>
  <p class="body-text">
    <strong>2.</strong> O trabalhador declara ter recebido corretamente todas as parcelas discriminadas no TRCT,
    incluindo saldo de salário, férias proporcionais e vencidas com 1/3 constitucional, 13º salário proporcional,
    ${rescission.multa_fgts > 0 ? `multa de ${rescission.multa_fgts_percentual}% do FGTS no valor de ${fmt.currency(rescission.multa_fgts)}, ` : ''}
    e demais verbas aplicáveis à modalidade de rescisão (${tipoLabel}).
  </p>
  <p class="body-text">
    <strong>3.</strong> O trabalhador dá plena, geral e irrevogável quitação ao empregador relativamente às obrigações
    trabalhistas discriminadas neste termo e no TRCT, durante o período contratual de
    <strong>${fmt.date(ctx.data_admissao)}</strong> a <strong>${fmt.date(ctx.data_desligamento)}</strong>.
  </p>
  <p class="body-text">
    <strong>4.</strong> Este termo não impede o trabalhador de pleitear judicialmente diferenças de verbas não
    discriminadas ou valores incorretamente apurados, conforme garantido pela Constituição Federal (Art. 5º, XXXV).
  </p>
  <p class="body-text">
    E por estarem assim justos e de acordo, firmam o presente instrumento em duas vias de igual teor e forma.
  </p>
</div>

<div class="section">
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Local e Data:</span> _________________, ${fmt.date(ctx.data_desligamento)}</div>
  </div>
</div>

${signaturesHtml(ctx.company_name, ctx.employee_name, true)}`;

  return wrapDocument('Termo de Quitação de Obrigações Trabalhistas', `Art. 507-B CLT — ${tipoLabel}`, body, proof);
}

// ══════════════════════════════════════════════════════════
// 3. Carta de Demissão
// ══════════════════════════════════════════════════════════

export function generateCartaDemissaoHtml(ctx: OffboardingDocumentContext, proof?: IntegrityProof): string {
  const body = `
<div class="section" style="margin-top: 20px;">
  <p class="body-text" style="text-align: right; margin-bottom: 24px;">
    _________________, ${fmt.date(ctx.data_desligamento)}
  </p>

  <p class="body-text">
    À<br/>
    <strong>${ctx.company_name}</strong><br/>
    CNPJ: ${ctx.company_cnpj}
  </p>

  <p class="body-text" style="margin-top: 16px;">
    Prezados Senhores,
  </p>

  <p class="body-text">
    Eu, <strong>${ctx.employee_name}</strong>, inscrito(a) no CPF sob nº <strong>${ctx.employee_cpf}</strong>,
    ocupando o cargo de <strong>${ctx.cargo}</strong>, venho por meio desta comunicar meu
    <strong>pedido de demissão</strong> do quadro de funcionários desta empresa, a partir de
    <strong>${fmt.date(ctx.data_desligamento)}</strong>.
  </p>

  <p class="body-text">
    ${ctx.aviso_previo_type === 'trabalhado'
      ? `Declaro que cumprirei o aviso prévio de ${ctx.aviso_previo_days} dias, conforme estabelecido no Art. 487 da CLT.`
      : `Solicito a dispensa do cumprimento do aviso prévio, ciente de que a empresa poderá descontar o período correspondente das verbas rescisórias, conforme Art. 487, §2º da CLT.`
    }
  </p>

  <p class="body-text">
    Agradeço pela oportunidade e pelo período em que fiz parte desta organização, desde
    <strong>${fmt.date(ctx.data_admissao)}</strong>.
  </p>

  <p class="body-text">Atenciosamente,</p>
</div>

<div class="signatures" style="grid-template-columns: 1fr;">
  <div><div class="signature-line">${ctx.employee_name}<br/>CPF: ${ctx.employee_cpf}</div></div>
</div>

<div class="section" style="margin-top: 30px;">
  <div class="section-title">Recebido pelo Empregador</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Recebido por:</span> _________________________________</div>
    <div class="info-item"><span class="info-label">Data:</span> ____/____/________</div>
    <div class="info-item"><span class="info-label">Cargo:</span> _________________________________</div>
  </div>
</div>`;

  return wrapDocument('Carta de Pedido de Demissão', `${ctx.employee_name} — ${ctx.company_name}`, body, proof);
}

// ══════════════════════════════════════════════════════════
// 4. Recibo de Devolução de Bens
// ══════════════════════════════════════════════════════════

export interface AssetItem {
  descricao: string;
  patrimonio?: string;
  numero_serie?: string;
  estado: 'bom' | 'regular' | 'danificado' | 'nao_devolvido';
  observacao?: string;
}

const ASSET_STATE_LABELS: Record<string, string> = {
  bom: 'Bom estado',
  regular: 'Regular',
  danificado: 'Danificado',
  nao_devolvido: 'Não devolvido',
};

export function generateReciboDevolucaoBensHtml(
  ctx: OffboardingDocumentContext,
  assets: AssetItem[],
  proof?: IntegrityProof,
): string {
  const hasUndamaged = assets.some(a => a.estado === 'nao_devolvido');

  const body = `
<div class="section">
  <div class="section-title">Identificação</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Empregador:</span> ${ctx.company_name} — CNPJ: ${ctx.company_cnpj}</div>
    <div class="info-item"><span class="info-label">Colaborador:</span> ${ctx.employee_name} — CPF: ${ctx.employee_cpf}</div>
    <div class="info-item"><span class="info-label">Cargo:</span> ${ctx.cargo}</div>
    <div class="info-item"><span class="info-label">Data Desligamento:</span> ${fmt.date(ctx.data_desligamento)}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Bens e Patrimônio</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descrição</th>
        <th>Patrimônio</th>
        <th>Nº Série</th>
        <th>Estado</th>
        <th>Observação</th>
      </tr>
    </thead>
    <tbody>
      ${assets.map((a, i) => `
      <tr ${a.estado === 'nao_devolvido' ? 'style="background:#ffebee;"' : a.estado === 'danificado' ? 'style="background:#fff8e1;"' : ''}>
        <td>${i + 1}</td>
        <td>${a.descricao}</td>
        <td>${a.patrimonio || '—'}</td>
        <td>${a.numero_serie || '—'}</td>
        <td><strong>${ASSET_STATE_LABELS[a.estado] || a.estado}</strong></td>
        <td>${a.observacao || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  ${hasUndamaged ? `
  <div class="disclaimer" style="background:#ffebee;border-color:#ef5350;color:#c62828;">
    ⚠️ Existem bens não devolvidos. Verificar possibilidade de desconto em rescisão conforme CLT Art. 462.
  </div>` : ''}
</div>

<div class="section">
  <p class="body-text">
    O(A) colaborador(a) acima identificado(a) declara ter devolvido os bens e equipamentos listados neste recibo,
    que se encontravam sob sua responsabilidade durante o vínculo empregatício. A empresa confirma o recebimento
    dos itens nas condições descritas acima.
  </p>
</div>

${signaturesHtml(ctx.company_name, ctx.employee_name)}`;

  return wrapDocument('Recibo de Devolução de Bens e Patrimônio', `Desligamento — ${ctx.employee_name}`, body, proof);
}

// ══════════════════════════════════════════════════════════
// ORCHESTRATOR — Generate all applicable documents
// ══════════════════════════════════════════════════════════

export interface GenerateAllDocumentsInput {
  context: OffboardingDocumentContext;
  rescission: RescissionResult;
  assets?: AssetItem[];
  /** Map of document type → IntegrityProof (populated after hash generation) */
  proofs?: Partial<Record<OffboardingDocumentType, IntegrityProof>>;
}

/**
 * Generate all applicable offboarding documents.
 *
 * Returns documents based on offboarding type:
 * - Always: TRCT, Termo de Quitação, Recibo de Devolução de Bens
 * - Only pedido_demissao: Carta de Demissão
 */
export function generateAllOffboardingDocuments(input: GenerateAllDocumentsInput): GeneratedDocument[] {
  const { context: ctx, rescission, assets = [], proofs = {} } = input;
  const docs: GeneratedDocument[] = [];

  // 1. TRCT (always)
  docs.push({
    type: 'trct',
    label: DOCUMENT_TYPE_LABELS.trct,
    html: generateTrctHtml(ctx, rescission, proofs.trct),
    integrity: proofs.trct,
  });

  // 2. Termo de Quitação (always)
  docs.push({
    type: 'termo_quitacao',
    label: DOCUMENT_TYPE_LABELS.termo_quitacao,
    html: generateTermoQuitacaoHtml(ctx, rescission, proofs.termo_quitacao),
    integrity: proofs.termo_quitacao,
  });

  // 3. Carta de Demissão (only pedido_demissao)
  if (ctx.offboarding_type === 'pedido_demissao') {
    docs.push({
      type: 'carta_demissao',
      label: DOCUMENT_TYPE_LABELS.carta_demissao,
      html: generateCartaDemissaoHtml(ctx, proofs.carta_demissao),
      integrity: proofs.carta_demissao,
    });
  }

  // 4. Recibo de Devolução de Bens (always — may be empty list)
  docs.push({
    type: 'recibo_devolucao_bens',
    label: DOCUMENT_TYPE_LABELS.recibo_devolucao_bens,
    html: generateReciboDevolucaoBensHtml(ctx, assets, proofs.recibo_devolucao_bens),
    integrity: proofs.recibo_devolucao_bens,
  });

  return docs;
}
