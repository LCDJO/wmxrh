/**
 * Regulatory Email Notification Service — Stub
 *
 * Automatic email notifications for regulatory events.
 * Will use edge functions for actual delivery.
 */

import type {
  EmailNotificationRequest,
  EmailNotificationResult,
  EmailNotificationType,
  EmailNotificationTemplate,
} from './types';

/** Default templates for each notification type */
export function getDefaultTemplate(type: EmailNotificationType): EmailNotificationTemplate {
  const templates: Record<EmailNotificationType, EmailNotificationTemplate> = {
    REGULATORY_ALERT: {
      type: 'REGULATORY_ALERT',
      subject_template: '[{{severidade}}] Alerta Regulatório: {{norm_codigo}}',
      body_html_template: '<h2>Alerta Regulatório</h2><p>{{mensagem}}</p>',
      body_text_template: 'Alerta Regulatório: {{mensagem}}',
      default_priority: 'high',
    },
    IMPACT_REPORT: {
      type: 'IMPACT_REPORT',
      subject_template: 'Relatório de Impacto: {{norm_codigo}} - {{titulo}}',
      body_html_template: '<h2>Relatório de Impacto Regulatório</h2><p>{{resumo}}</p>',
      body_text_template: 'Relatório de Impacto: {{resumo}}',
      default_priority: 'normal',
    },
    ACTION_REQUIRED: {
      type: 'ACTION_REQUIRED',
      subject_template: '[AÇÃO REQUERIDA] {{titulo}} - Prazo: {{prazo}}',
      body_html_template: '<h2>Ação Requerida</h2><p>{{descricao}}</p><p><strong>Prazo:</strong> {{prazo}}</p>',
      body_text_template: 'Ação Requerida: {{descricao}} - Prazo: {{prazo}}',
      default_priority: 'urgent',
    },
    COMPLIANCE_DEADLINE: {
      type: 'COMPLIANCE_DEADLINE',
      subject_template: 'Prazo de Conformidade: {{norm_codigo}} vence em {{dias}} dias',
      body_html_template: '<h2>Prazo de Conformidade</h2><p>{{descricao}}</p>',
      body_text_template: 'Prazo de Conformidade: {{descricao}}',
      default_priority: 'high',
    },
    DOU_DIGEST: {
      type: 'DOU_DIGEST',
      subject_template: 'Resumo DOU {{data}} - {{total}} publicações relevantes',
      body_html_template: '<h2>Resumo do Diário Oficial</h2>{{items}}',
      body_text_template: 'Resumo DOU: {{total}} publicações relevantes em {{data}}',
      default_priority: 'normal',
    },
  };
  return templates[type];
}

/** Interpolate template variables */
export function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
    template,
  );
}

/**
 * Stub: Send regulatory email notification.
 * Will be implemented via edge function.
 */
export async function sendRegulatoryEmail(
  _request: EmailNotificationRequest,
): Promise<EmailNotificationResult> {
  console.warn('[EmailNotification] sendRegulatoryEmail is a stub — not yet implemented');
  return {
    sent: false,
    message_id: null,
    recipients_count: _request.recipients.length,
    failed_recipients: _request.recipients.map(r => r.email),
    error: 'Email delivery not yet implemented',
    sent_at: new Date().toISOString(),
  };
}
