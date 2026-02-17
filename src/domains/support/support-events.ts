/**
 * Support Domain — Event Definitions
 */

export const SUPPORT_EVENTS = {
  TicketCreated: 'support:ticket_created',
  TicketAssigned: 'support:ticket_assigned',
  TicketStatusChanged: 'support:ticket_status_changed',
  TicketResolved: 'support:ticket_resolved',
  TicketClosed: 'support:ticket_closed',
  MessageSent: 'support:message_sent',
  AgentEvaluated: 'support:agent_evaluated',
  SystemRated: 'support:system_rated',
  WikiArticlePublished: 'support:wiki_article_published',
  WikiArticleViewed: 'support:wiki_article_viewed',
  // Chat events
  ChatSessionStarted: 'support:chat_session_started',
  ChatMessageSent: 'support:chat_message_sent',
  AgentTyping: 'support:agent_typing',
  ChatSessionClosed: 'support:chat_session_closed',
  ChatTranscriptArchived: 'support:chat_transcript_archived',
} as const;

export const __DOMAIN_CATALOG = {
  domain: 'Support',
  color: 'hsl(210 65% 50%)',
  events: [
    { name: 'TicketCreated', description: 'Novo ticket de suporte aberto pelo tenant' },
    { name: 'TicketAssigned', description: 'Ticket atribuído a um agente da plataforma' },
    { name: 'TicketStatusChanged', description: 'Status do ticket alterado' },
    { name: 'TicketResolved', description: 'Ticket marcado como resolvido' },
    { name: 'TicketClosed', description: 'Ticket fechado (pós-resolução ou cancelamento)' },
    { name: 'MessageSent', description: 'Mensagem enviada no ticket (tenant ou agente)' },
    { name: 'AgentEvaluated', description: 'Atendente avaliado pelo tenant' },
    { name: 'SystemRated', description: 'Avaliação do sistema enviada pelo usuário' },
    { name: 'WikiArticlePublished', description: 'Artigo da base de conhecimento publicado' },
    { name: 'WikiArticleViewed', description: 'Artigo da wiki visualizado' },
    { name: 'ChatSessionStarted', description: 'Sessão de chat ao vivo iniciada' },
    { name: 'ChatMessageSent', description: 'Mensagem enviada no chat ao vivo' },
    { name: 'AgentTyping', description: 'Agente está digitando no chat' },
    { name: 'ChatSessionClosed', description: 'Sessão de chat encerrada' },
    { name: 'ChatTranscriptArchived', description: 'Transcrição do chat arquivada permanentemente' },
  ],
};
