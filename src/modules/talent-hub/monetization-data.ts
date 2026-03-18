import type { PlanTier } from '@/components/shared/PlanBadge';

export type TalentCommercialTier = Extract<PlanTier, 'starter' | 'pro' | 'enterprise'>;
export type TalentBillingCycle = 'monthly' | 'annual';

export interface TalentMonetizationPlan {
  id: TalentCommercialTier;
  name: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualTotalPrice: number;
  candidateLimit: number | null;
  activeJobsLimit: number | null;
  includedCredits: number;
  description: string;
  features: string[];
  addons: string[];
  highlighted?: boolean;
  whiteLabel?: boolean;
}

export interface TalentUsageSnapshot {
  currentTier: TalentCommercialTier;
  currentPlanName: string;
  billingCycle: TalentBillingCycle;
  trialDaysLeft: number;
  recommendedTier: TalentCommercialTier;
  usage: {
    candidatesUsed: number;
    candidatesLimit: number;
    activeJobsUsed: number;
    activeJobsLimit: number;
    creditsUsed: number;
    creditsIncluded: number;
  };
  lockedFeatures: string[];
  upsellReason: string;
}

export const talentMonetizationPlans: TalentMonetizationPlan[] = [
  {
    id: 'starter',
    name: 'Básico',
    monthlyPrice: 99,
    annualMonthlyPrice: 82,
    annualTotalPrice: 990,
    candidateLimit: 100,
    activeJobsLimit: 1,
    includedCredits: 10,
    description: 'Entrada rápida para estruturar um banco de talentos com operação enxuta.',
    features: [
      'Banco de talentos',
      'Pipeline simples',
      'Até 100 candidatos',
      '1 vaga ativa',
      '10 créditos mensais para consultas',
    ],
    addons: ['Receita Federal por uso', 'Consulta judicial por uso'],
  },
  {
    id: 'pro',
    name: 'Profissional',
    monthlyPrice: 299,
    annualMonthlyPrice: 249,
    annualTotalPrice: 2990,
    candidateLimit: 1000,
    activeJobsLimit: 10,
    includedCredits: 80,
    description: 'Funil completo, score automático e integrações para escalar recrutamento.',
    features: [
      'Pipeline completo com drag and drop',
      'Score automático',
      'Integrações básicas',
      'Até 1.000 candidatos',
      '10 vagas ativas',
      '80 créditos mensais',
    ],
    addons: ['Score avançado por IA', 'Pacotes de créditos com desconto'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 799,
    annualMonthlyPrice: 666,
    annualTotalPrice: 7990,
    candidateLimit: null,
    activeJobsLimit: null,
    includedCredits: 300,
    description: 'Operação premium com IA, enriquecimento completo e dossiê automático.',
    features: [
      'Enriquecimento completo',
      'APIs externas',
      'IA e dossiê automático',
      'Candidatos ilimitados',
      'Vagas ilimitadas',
      '300 créditos mensais',
      'White-label opcional',
    ],
    addons: ['Background check completo', 'White-label', 'SLA dedicado'],
    whiteLabel: true,
  },
];

export const talentUsageSnapshot: TalentUsageSnapshot = {
  currentTier: 'starter',
  currentPlanName: 'Básico',
  billingCycle: 'monthly',
  trialDaysLeft: 6,
  recommendedTier: 'pro',
  usage: {
    candidatesUsed: 84,
    candidatesLimit: 100,
    activeJobsUsed: 1,
    activeJobsLimit: 1,
    creditsUsed: 8,
    creditsIncluded: 10,
  },
  lockedFeatures: [
    'Pipeline completo com drag and drop',
    'Score automático e shortlist inteligente',
    'Integrações básicas e insights enriquecidos',
  ],
  upsellReason: 'Você já consumiu 84% da base do plano e atingiu a vaga ativa incluída.',
};

export const talentAddonCatalog = [
  {
    name: 'Consulta Receita Federal',
    priceRange: 'R$ 0,50 — R$ 0,90',
    billingMode: 'Por uso',
    positioning: 'Validação cadastral e sinal de regularidade para acelerar triagem.',
  },
  {
    name: 'Consulta judicial',
    priceRange: 'R$ 2,90 — R$ 5,00',
    billingMode: 'Por uso',
    positioning: 'Camada jurídica para vagas críticas ou com maior exposição regulatória.',
  },
  {
    name: 'Score avançado (IA)',
    priceRange: 'R$ 1,50',
    billingMode: 'Por uso',
    positioning: 'Leitura preditiva para aderência, risco e recomendação de próximos passos.',
  },
  {
    name: 'Background check completo',
    priceRange: 'R$ 4,90',
    billingMode: 'Por uso',
    positioning: 'Dossiê integrado ao RH com documentação, risco e histórico consolidado.',
  },
  {
    name: 'White-label',
    priceRange: 'R$ 99/mês',
    billingMode: 'Add-on mensal',
    positioning: 'Marca própria para operações enterprise e consultorias de recrutamento.',
  },
];

export const talentRevenueMetrics = [
  { label: 'MRR alvo', value: 'R$ 92k', detail: 'Receita recorrente combinando planos + add-ons.' },
  { label: 'CAC', value: 'R$ 780', detail: 'Pago em até 3 meses com trial orientado a ativação.' },
  { label: 'LTV', value: 'R$ 9,8k', detail: 'Expansão puxada por uso recorrente de consultas.' },
  { label: 'Churn', value: '< 3,2%', detail: 'Retenção sustentada por stickiness operacional.' },
  { label: 'Receita por consulta', value: 'R$ 2,10', detail: 'Média ponderada entre validação cadastral e background.' },
];

export const talentGrowthStrategies = [
  {
    title: 'Trial orientado a ativação',
    description: '14 dias ou 50 candidatos processados para gerar valor antes da cobrança.',
  },
  {
    title: 'Upsell por limite',
    description: 'Disparo quando o tenant atinge 70%, 90% e 100% da capacidade de candidatos.',
  },
  {
    title: 'Créditos pré-pagos',
    description: 'Pacotes com desconto para aumentar margem e previsibilidade de consumo.',
  },
  {
    title: 'White-label enterprise',
    description: 'Expansão de ticket com consultorias e BPOs de recrutamento.',
  },
];

export const talentUpsellTriggers = [
  'Ao tentar abrir a 2ª vaga no plano Básico.',
  'Ao solicitar score automático sem pacote ativo.',
  'Ao acessar enriquecimento ou dossiê automático em contas não Enterprise.',
  'Ao consumir 80% dos créditos mensais de consultas.',
];

export function getTalentUsagePercentage(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
