/**
 * Support Domain — Type Definitions
 */

export type TicketStatus = 'open' | 'awaiting_agent' | 'awaiting_customer' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'technical' | 'feature_request' | 'bug_report' | 'account' | 'general';
export type SenderType = 'tenant_user' | 'platform_agent' | 'system';

export interface SupportTicket {
  id: string;
  tenant_id: string;
  created_by: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  assigned_to: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: SenderType;
  content: string;
  attachments: unknown[];
  is_internal: boolean;
  created_at: string;
}

export interface WikiCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WikiArticle {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  content_html: string;
  content_plain: string | null;
  tags: string[];
  module_reference: string | null;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  support_wiki_categories?: WikiCategory;
}

export interface SupportEvaluation {
  id: string;
  ticket_id: string;
  tenant_id: string;
  agent_id: string | null;
  agent_score: number | null;
  system_score: number | null;
  comment: string | null;
  created_at: string;
}

export interface SystemRating {
  id: string;
  tenant_id: string;
  user_id: string;
  category: string;
  rating: number;
  feedback: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateTicketDTO {
  tenant_id: string;
  subject: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tags?: string[];
}

export interface CreateMessageDTO {
  ticket_id: string;
  content: string;
  sender_type: SenderType;
  is_internal?: boolean;
  attachments?: unknown[];
}

// ── Chat Session & Messages ──

export type ChatSessionStatus = 'active' | 'paused' | 'closed';
export type ChatSenderType = 'tenant' | 'agent' | 'system';

export interface ChatSession {
  id: string;
  ticket_id: string;
  tenant_id: string;
  assigned_agent_id: string | null;
  protocol_number: string;
  status: ChatSessionStatus;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: ChatSenderType;
  sender_id: string | null;
  message_text: string;
  attachments: unknown[];
  created_at: string;
  read_at: string | null;
}

export interface CreateChatSessionDTO {
  ticket_id: string;
  tenant_id: string;
  assigned_agent_id?: string;
}

export interface SendChatMessageDTO {
  session_id: string;
  sender_type: ChatSenderType;
  message_text: string;
  attachments?: unknown[];
}
