/**
 * Developer Portal Domain Events — autodiscovered by event catalog.
 */

export const __DOMAIN_CATALOG = {
  domain: 'Developer Portal',
  color: 'hsl(200 70% 50%)',
  events: [
    { name: 'AppRegistered', description: 'Novo app registrado no Developer Portal' },
    { name: 'AppPublished', description: 'App publicado no Marketplace' },
    { name: 'AppInstalled', description: 'App instalado por um tenant' },
    { name: 'AppUninstalled', description: 'App desinstalado por um tenant' },
    { name: 'WebhookRegistered', description: 'Webhook registrado por app externo' },
    { name: 'AppScopeRequested', description: 'Escopo adicional solicitado por app' },
    { name: 'AppReviewSubmitted', description: 'App submetido para revisão' },
    { name: 'AppApproved', description: 'App aprovado para marketplace' },
    { name: 'AppRejected', description: 'App rejeitado na revisão' },
  ],
};
