function buildFunctionUrl(functionName: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Project ID not configured for signature webhooks.');
  }

  return `https://${projectId}.supabase.co/functions/v1/${functionName}`;
}

export function buildAgreementWebhookUrl(): string {
  return buildFunctionUrl('agreement-webhook');
}

export function buildEpiSignatureWebhookUrl(): string {
  return buildFunctionUrl('epi-signature-webhook');
}
