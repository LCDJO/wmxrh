/**
 * Termo de Rescisão — Document Generator
 *
 * Generates an HTML document for the Termo de Rescisão do Contrato de Trabalho (TRCT)
 * based on the rescission calculation result.
 */

import type { RescissionResult } from './rescission-calculator.engine';
import { OFFBOARDING_TYPE_LABELS, AVISO_PREVIO_LABELS } from './types';

export interface TermoRescisaoData {
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

  // Calculation
  rescission: RescissionResult;

  // Aviso
  aviso_previo_type: string;
  aviso_previo_days: number;
}

/**
 * Generate TRCT HTML document.
 */
export function generateTermoRescisaoHtml(data: TermoRescisaoData): string {
  const { rescission: r, ...info } = data;

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  };

  const proventos = r.linhas.filter(l => l.tipo === 'provento');
  const descontos = r.linhas.filter(l => l.tipo === 'desconto');

  const tipoLabel = OFFBOARDING_TYPE_LABELS[r.tipo_rescisao] || r.tipo_rescisao;
  const avisoLabel = AVISO_PREVIO_LABELS[data.aviso_previo_type as keyof typeof AVISO_PREVIO_LABELS] || data.aviso_previo_type;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Termo de Rescisão do Contrato de Trabalho</title>
<style>
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
  @media print { body { padding: 15mm; } .disclaimer { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="header">
  <h1>Termo de Rescisão do Contrato de Trabalho</h1>
  <div class="subtitle">TRCT — ${tipoLabel}</div>
</div>

<div class="disclaimer">
  ⚠️ ${r.disclaimer}
</div>

<div class="section">
  <div class="section-title">1. Identificação do Empregador</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Razão Social:</span> ${info.company_name}</div>
    <div class="info-item"><span class="info-label">CNPJ:</span> ${info.company_cnpj}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">2. Identificação do Trabalhador</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Nome:</span> ${info.employee_name}</div>
    <div class="info-item"><span class="info-label">CPF:</span> ${info.employee_cpf}</div>
    ${info.employee_ctps ? `<div class="info-item"><span class="info-label">CTPS:</span> ${info.employee_ctps}</div>` : ''}
    ${info.employee_pis ? `<div class="info-item"><span class="info-label">PIS/PASEP:</span> ${info.employee_pis}</div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">3. Dados do Contrato</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Cargo:</span> ${info.cargo}</div>
    <div class="info-item"><span class="info-label">Causa:</span> ${tipoLabel}</div>
    <div class="info-item"><span class="info-label">Admissão:</span> ${formatDate(info.data_admissao)}</div>
    <div class="info-item"><span class="info-label">Desligamento:</span> ${formatDate(info.data_desligamento)}</div>
    <div class="info-item"><span class="info-label">Aviso Prévio:</span> ${avisoLabel} (${data.aviso_previo_days} dias)</div>
  </div>
</div>

<div class="section">
  <div class="section-title">4. Discriminação das Verbas Rescisórias</div>

  <h4 style="margin: 8px 0 4px; font-size: 10px;">PROVENTOS</h4>
  <table>
    <thead>
      <tr><th>Cód.</th><th>Descrição</th><th>Referência</th><th>Base Legal</th><th style="text-align:right">Valor (R$)</th></tr>
    </thead>
    <tbody>
      ${proventos.map(l => `
      <tr>
        <td>${l.codigo}</td>
        <td>${l.descricao}</td>
        <td>${l.referencia || '—'}</td>
        <td>${l.base_legal}</td>
        <td class="currency">${formatCurrency(l.valor)}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4">TOTAL PROVENTOS</td>
        <td class="currency">${formatCurrency(r.total_proventos)}</td>
      </tr>
    </tbody>
  </table>

  ${descontos.length > 0 ? `
  <h4 style="margin: 8px 0 4px; font-size: 10px;">DESCONTOS</h4>
  <table>
    <thead>
      <tr><th>Cód.</th><th>Descrição</th><th>Referência</th><th>Base Legal</th><th style="text-align:right">Valor (R$)</th></tr>
    </thead>
    <tbody>
      ${descontos.map(l => `
      <tr>
        <td>${l.codigo}</td>
        <td>${l.descricao}</td>
        <td>${l.referencia || '—'}</td>
        <td>${l.base_legal}</td>
        <td class="currency">${formatCurrency(l.valor)}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4">TOTAL DESCONTOS</td>
        <td class="currency">${formatCurrency(r.total_descontos)}</td>
      </tr>
    </tbody>
  </table>` : ''}
</div>

<div class="summary-box">
  <div class="summary-grid">
    <div>
      <div class="summary-value" style="color: #2e7d32;">${formatCurrency(r.total_proventos)}</div>
      <div class="summary-label">Total Proventos</div>
    </div>
    <div>
      <div class="summary-value" style="color: #c62828;">${formatCurrency(r.total_descontos)}</div>
      <div class="summary-label">Total Descontos</div>
    </div>
    <div>
      <div class="summary-value">${formatCurrency(r.valor_liquido)}</div>
      <div class="summary-label">Valor Líquido Rescisão</div>
    </div>
  </div>
</div>

<div class="fgts-box">
  <div class="section-title" style="background: transparent; border-left-color: #4caf50;">5. FGTS</div>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Saldo FGTS:</span> ${formatCurrency(r.saldo_fgts)}</div>
    <div class="info-item"><span class="info-label">FGTS Mês Rescisão:</span> ${formatCurrency(r.fgts_mes_rescisao)}</div>
    <div class="info-item"><span class="info-label">Multa FGTS (${r.multa_fgts_percentual}%):</span> ${formatCurrency(r.multa_fgts)}</div>
    <div class="info-item"><span class="info-label"><strong>Total FGTS a Receber:</strong></span> <strong>${formatCurrency(r.total_fgts_a_receber)}</strong></div>
  </div>
</div>

<div class="signatures">
  <div>
    <div class="signature-line">${info.company_name}<br/>Empregador</div>
  </div>
  <div>
    <div class="signature-line">${info.employee_name}<br/>Trabalhador(a)</div>
  </div>
</div>

<div class="footer">
  Documento gerado em ${new Date().toLocaleString('pt-BR')} — SIMULAÇÃO para fins de análise financeira.
  <br/>Este documento NÃO substitui o TRCT homologado conforme legislação vigente.
</div>

</body>
</html>`;
}
