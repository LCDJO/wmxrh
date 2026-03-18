import type { SignatureProvider } from './types';

export const PLAN_SCOPED_SIGNATURE_PROVIDERS = [
  'clicksign',
  'autentique',
  'zapsign',
  'docusign',
  'opensign',
] as const satisfies readonly SignatureProvider[];

export type PlanScopedSignatureProvider = typeof PLAN_SCOPED_SIGNATURE_PROVIDERS[number];

export const SIGNATURE_PROVIDER_LABELS: Record<PlanScopedSignatureProvider, string> = {
  clicksign: 'Clicksign',
  autentique: 'Autentique',
  zapsign: 'ZapSign',
  docusign: 'DocuSign',
  opensign: 'OpenSign',
};

export const SIGNATURE_PROVIDER_DESCRIPTIONS: Record<PlanScopedSignatureProvider, string> = {
  clicksign: 'API REST com foco no mercado brasileiro.',
  autentique: 'Assinatura eletrônica com fluxo simples e rápido.',
  zapsign: 'Operação enxuta com webhook e automação.',
  docusign: 'Fluxo JWT por tenant pronto para produção.',
  opensign: 'Alternativa open-source/self-hosted.',
};

export function toPlanSignatureProviderFlag(provider: PlanScopedSignatureProvider): string {
  return `signature_provider:${provider}`;
}

export function isPlanScopedSignatureProvider(value: string): value is PlanScopedSignatureProvider {
  return PLAN_SCOPED_SIGNATURE_PROVIDERS.includes(value as PlanScopedSignatureProvider);
}

export function getPlanAllowedSignatureProviders(featureFlags?: string[] | null): PlanScopedSignatureProvider[] {
  const flags = featureFlags ?? [];

  return flags
    .filter((flag) => flag.startsWith('signature_provider:'))
    .map((flag) => flag.replace('signature_provider:', ''))
    .filter(isPlanScopedSignatureProvider);
}

export function hasPlanScopedSignatureProviderConfig(featureFlags?: string[] | null): boolean {
  return getPlanAllowedSignatureProviders(featureFlags).length > 0;
}
