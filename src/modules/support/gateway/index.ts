import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createSupportGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;
  return {
    listTickets: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('support_tickets', 'list', params),
    createTicket: (data: Record<string, unknown>) =>
      gateway.mutate('support_tickets', 'create', data),
    listWikiArticles: (params?: Record<string, unknown>) =>
      gateway.query<unknown[]>('support_wiki_articles', 'list', params),
  };
}
