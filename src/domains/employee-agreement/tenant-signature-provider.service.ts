import { supabase } from '@/integrations/supabase/client';
import type { SignatureProvider } from './types';

const FALLBACK_PROVIDER: SignatureProvider = 'simulation';
const EXPLICIT_PROVIDERS = new Set<SignatureProvider>([
  'clicksign',
  'autentique',
  'zapsign',
  'docusign',
  'opensign',
  'manual',
  'simulation',
]);

function isSignatureProvider(value: string): value is SignatureProvider {
  return [
    'clicksign',
    'autentique',
    'zapsign',
    'docusign',
    'opensign',
    'manual',
    'simulation',
    'internal_advanced',
  ].includes(value);
}

export async function resolveTenantSignatureProvider(
  tenantId: string,
  requestedProvider?: SignatureProvider | null,
): Promise<SignatureProvider> {
  if (requestedProvider && EXPLICIT_PROVIDERS.has(requestedProvider)) {
    return requestedProvider;
  }

  const { data, error } = await supabase.rpc('resolve_tenant_signature_provider', {
    _tenant_id: tenantId,
  });

  if (error) {
    console.warn('[SignatureProvider] Failed to resolve tenant provider:', error.message);
    return requestedProvider === 'manual' ? 'manual' : FALLBACK_PROVIDER;
  }

  const resolvedProvider = (data ?? []).find(
    (integration) => integration.is_enabled && isSignatureProvider(integration.provider_name),
  )?.provider_name;

  if (resolvedProvider && isSignatureProvider(resolvedProvider)) {
    return resolvedProvider;
  }

  return requestedProvider === 'manual' ? 'manual' : FALLBACK_PROVIDER;
}
