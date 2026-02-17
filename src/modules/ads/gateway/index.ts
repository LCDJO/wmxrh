import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createAdsGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    listCampaigns: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('campaigns', 'list', params),
    createCampaign: (data: Record<string, unknown>) =>
      gateway.mutate('campaigns', 'create', data),
    getReports: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('ads_reports', 'list', params),
  };
}
