/**
 * Website Builder — Core Types
 */

export type WebsiteBlockType =
  | 'hero'
  | 'feature-grid'
  | 'fab-block'
  | 'pricing-table'
  | 'cta-section'
  | 'testimonial-slider'
  | 'faq-accordion';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

/** Per-breakpoint layout overrides */
export interface BreakpointOverrides {
  columns?: number;
  layout?: 'horizontal' | 'vertical' | 'stacked';
  padding?: string;
  textAlign?: 'left' | 'center' | 'right';
  hidden?: boolean;
}

export interface WebsiteBlock {
  id: string;
  type: WebsiteBlockType;
  order: number;
  content: Record<string, unknown>;
  styling?: Record<string, string>;
  /** Per-breakpoint overrides — keys are Viewport values */
  responsive?: Partial<Record<Viewport, BreakpointOverrides>>;
}

export interface BlockDefinition {
  type: WebsiteBlockType;
  label: string;
  icon: string;
  description: string;
  defaultContent: Record<string, unknown>;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: 'hero',
    label: 'Hero Section',
    icon: 'Layout',
    description: 'Banner principal com headline, subtítulo e CTA',
    defaultContent: {
      headline: 'Transforme sua gestão de pessoas',
      subheadline: 'Plataforma completa para RH moderno',
      ctaText: 'Começar agora',
      ctaLink: '/contato',
      backgroundStyle: 'gradient',
    },
  },
  {
    type: 'feature-grid',
    label: 'Feature Grid',
    icon: 'Grid3x3',
    description: 'Grade de funcionalidades com ícones',
    defaultContent: {
      title: 'Funcionalidades',
      columns: 3,
      features: [
        { icon: 'Users', title: 'Gestão de Pessoas', description: 'Cadastro completo de colaboradores.' },
        { icon: 'DollarSign', title: 'Folha de Pagamento', description: 'Cálculos automáticos e conformidade.' },
        { icon: 'Shield', title: 'Compliance', description: 'Conformidade trabalhista garantida.' },
      ],
    },
  },
  {
    type: 'fab-block',
    label: 'FAB Block',
    icon: 'Sparkles',
    description: 'Feature-Advantage-Benefit com destaque visual',
    defaultContent: {
      feature: 'Multi-tenant avançado',
      advantage: 'Gestão centralizada de múltiplas empresas',
      benefit: 'Reduza custos operacionais em até 40%',
      layout: 'horizontal',
    },
  },
  {
    type: 'pricing-table',
    label: 'Pricing Table',
    icon: 'CreditCard',
    description: 'Tabela de preços com planos',
    defaultContent: {
      title: 'Planos e Preços',
      plans: [
        { name: 'Starter', price: 'R$ 99', period: '/mês', features: ['Até 50 colaboradores', 'Suporte email'], highlighted: false },
        { name: 'Professional', price: 'R$ 299', period: '/mês', features: ['Até 200 colaboradores', 'Suporte prioritário', 'API Access'], highlighted: true },
        { name: 'Enterprise', price: 'Sob consulta', period: '', features: ['Ilimitado', 'Suporte 24/7', 'SLA dedicado'], highlighted: false },
      ],
    },
  },
  {
    type: 'cta-section',
    label: 'CTA Section',
    icon: 'MousePointerClick',
    description: 'Call-to-action com urgência',
    defaultContent: {
      headline: 'Pronto para começar?',
      subheadline: 'Teste grátis por 14 dias, sem cartão de crédito.',
      ctaText: 'Criar conta grátis',
      ctaLink: '/signup',
      style: 'centered',
    },
  },
  {
    type: 'testimonial-slider',
    label: 'Testimonial Slider',
    icon: 'MessageSquareQuote',
    description: 'Depoimentos de clientes em carrossel',
    defaultContent: {
      title: 'O que nossos clientes dizem',
      testimonials: [
        { name: 'Maria Silva', role: 'Diretora de RH', company: 'TechCorp', quote: 'Reduziu nosso tempo de folha em 60%.' },
        { name: 'João Santos', role: 'CEO', company: 'StartupXYZ', quote: 'A melhor plataforma de gestão que já usamos.' },
      ],
    },
  },
  {
    type: 'faq-accordion',
    label: 'FAQ Accordion',
    icon: 'HelpCircle',
    description: 'Perguntas frequentes em acordeão',
    defaultContent: {
      title: 'Perguntas Frequentes',
      items: [
        { question: 'Como funciona o período de teste?', answer: '14 dias grátis com acesso completo a todas as funcionalidades.' },
        { question: 'Posso migrar meus dados?', answer: 'Sim, oferecemos migração assistida sem custo adicional.' },
        { question: 'Qual o suporte oferecido?', answer: 'Suporte por email, chat e telefone dependendo do plano.' },
      ],
    },
  },
];
