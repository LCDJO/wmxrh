/**
 * Automated Offboarding — Checklist Templates
 *
 * Defines the default checklist items generated for each offboarding type.
 */

import type { OffboardingType } from './types';

interface ChecklistTemplate {
  category: string;
  title: string;
  description: string;
  is_mandatory: boolean;
  is_automated: boolean;
  automation_action?: string;
}

const COMMON_ITEMS: ChecklistTemplate[] = [
  { category: 'documentacao', title: 'Gerar TRCT (Termo de Rescisão)', description: 'Emitir o Termo de Rescisão do Contrato de Trabalho conforme CLT.', is_mandatory: true, is_automated: false },
  { category: 'documentacao', title: 'Emitir Carta de Aviso Prévio', description: 'Gerar e entregar carta formal de aviso prévio ao colaborador.', is_mandatory: true, is_automated: false },
  { category: 'financeiro', title: 'Calcular verbas rescisórias', description: 'Simular e validar saldo de salário, férias, 13º proporcional e multas.', is_mandatory: true, is_automated: false },
  { category: 'financeiro', title: 'Dar baixa no FGTS', description: 'Gerar guia GRRF e processar chave de conectividade social.', is_mandatory: true, is_automated: false },
  { category: 'esocial', title: 'Enviar evento S-2299 ao eSocial', description: 'Transmitir evento de desligamento ao eSocial.', is_mandatory: true, is_automated: true, automation_action: 'esocial_s2299' },
  { category: 'exame_demissional', title: 'Agendar exame demissional', description: 'Agendar ASO demissional conforme NR-7.', is_mandatory: true, is_automated: false },
  { category: 'patrimonio', title: 'Recolher crachá e equipamentos', description: 'Coletar crachá, notebook, celular e demais itens corporativos.', is_mandatory: true, is_automated: false },
  { category: 'acessos', title: 'Revogar acessos de sistemas', description: 'Desativar login e remover permissões em todos os sistemas.', is_mandatory: true, is_automated: true, automation_action: 'revoke_access' },
  { category: 'beneficios', title: 'Cancelar benefícios', description: 'Solicitar cancelamento de plano de saúde, VR, VT e demais benefícios.', is_mandatory: true, is_automated: false },
  { category: 'arquivamento', title: 'Arquivar ficha do colaborador', description: 'Mover registro para status "desligado" e gerar snapshot.', is_mandatory: true, is_automated: true, automation_action: 'archive_employee' },
  { category: 'comunicacao', title: 'Notificar gestores e equipe', description: 'Informar liderança e time sobre o desligamento.', is_mandatory: false, is_automated: false },
  { category: 'comunicacao', title: 'Realizar entrevista de desligamento', description: 'Agendar e conduzir entrevista de saída.', is_mandatory: false, is_automated: false },
];

const JUSTA_CAUSA_EXTRA: ChecklistTemplate[] = [
  { category: 'documentacao', title: 'Documentar provas da justa causa', description: 'Anexar documentos comprobatórios conforme Art. 482 CLT.', is_mandatory: true, is_automated: false },
  { category: 'documentacao', title: 'Notificar sindicato (se aplicável)', description: 'Comunicar entidade sindical quando exigido por convenção coletiva.', is_mandatory: false, is_automated: false },
];

const ACORDO_MUTUO_EXTRA: ChecklistTemplate[] = [
  { category: 'documentacao', title: 'Formalizar acordo mútuo', description: 'Gerar termo de acordo conforme Art. 484-A CLT com assinaturas.', is_mandatory: true, is_automated: false },
];

const PEDIDO_DEMISSAO_EXTRA: ChecklistTemplate[] = [
  { category: 'documentacao', title: 'Receber carta de pedido de demissão', description: 'Registrar carta formal do colaborador.', is_mandatory: true, is_automated: false },
];

export function getChecklistTemplatesByType(type: OffboardingType): ChecklistTemplate[] {
  const items = [...COMMON_ITEMS];
  switch (type) {
    case 'justa_causa':
      items.push(...JUSTA_CAUSA_EXTRA);
      break;
    case 'acordo_mutuo':
      items.push(...ACORDO_MUTUO_EXTRA);
      break;
    case 'pedido_demissao':
      items.push(...PEDIDO_DEMISSAO_EXTRA);
      break;
  }
  return items.map((item, i) => ({ ...item, ordem: i + 1 }));
}
