import { supabase } from '@/integrations/supabase/client';

export interface AgentSatisfaction {
  agentId: string;
  agentName: string;
  avgAgentScore: number | null;
  avgSystemScore: number | null;
  totalEvaluations: number;
}

export interface SessionDurationStats {
  avgMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  totalSessions: number;
}

export interface ResponseTimeStats {
  avgSeconds: number;
  medianSeconds: number;
  totalMeasured: number;
}

export interface ConversationAnalyticsResult {
  responseTime: ResponseTimeStats;
  sessionDuration: SessionDurationStats;
  satisfactionByAgent: AgentSatisfaction[];
}

export const ConversationAnalytics = {
  async getAll(tenantId?: string): Promise<ConversationAnalyticsResult> {
    const [responseTime, sessionDuration, satisfactionByAgent] = await Promise.all([
      this.getAvgResponseTime(tenantId),
      this.getSessionDuration(tenantId),
      this.getSatisfactionByAgent(tenantId),
    ]);
    return { responseTime, sessionDuration, satisfactionByAgent };
  },

  /** Average time between a tenant message and the next agent reply */
  async getAvgResponseTime(tenantId?: string): Promise<ResponseTimeStats> {
    // Get closed sessions
    let sessionsQuery = supabase
      .from('support_chat_sessions')
      .select('id')
      .eq('status', 'closed');
    if (tenantId) sessionsQuery = sessionsQuery.eq('tenant_id', tenantId);
    const { data: sessions } = await sessionsQuery;

    if (!sessions?.length) {
      return { avgSeconds: 0, medianSeconds: 0, totalMeasured: 0 };
    }

    const sessionIds = sessions.map(s => s.id);
    const deltas: number[] = [];

    // Process in batches of 20
    for (let i = 0; i < sessionIds.length; i += 20) {
      const batch = sessionIds.slice(i, i + 20);
      const { data: msgs } = await supabase
        .from('support_chat_messages')
        .select('session_id, sender_type, created_at')
        .in('session_id', batch)
        .order('created_at', { ascending: true });

      if (!msgs) continue;

      // Group by session
      const bySession: Record<string, typeof msgs> = {};
      for (const m of msgs) {
        (bySession[m.session_id] ??= []).push(m);
      }

      for (const sessionMsgs of Object.values(bySession)) {
        for (let j = 0; j < sessionMsgs.length - 1; j++) {
          if (sessionMsgs[j].sender_type === 'tenant' && sessionMsgs[j + 1].sender_type === 'agent') {
            const delta = (new Date(sessionMsgs[j + 1].created_at).getTime() - new Date(sessionMsgs[j].created_at).getTime()) / 1000;
            if (delta > 0 && delta < 86400) deltas.push(delta); // ignore > 24h
          }
        }
      }
    }

    if (!deltas.length) return { avgSeconds: 0, medianSeconds: 0, totalMeasured: 0 };

    deltas.sort((a, b) => a - b);
    const avg = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    const median = deltas[Math.floor(deltas.length / 2)];

    return {
      avgSeconds: Math.round(avg),
      medianSeconds: Math.round(median),
      totalMeasured: deltas.length,
    };
  },

  /** Average session duration (started_at → ended_at) */
  async getSessionDuration(tenantId?: string): Promise<SessionDurationStats> {
    let query = supabase
      .from('support_chat_sessions')
      .select('started_at, ended_at')
      .eq('status', 'closed')
      .not('ended_at', 'is', null);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data: sessions } = await query;

    if (!sessions?.length) {
      return { avgMinutes: 0, minMinutes: 0, maxMinutes: 0, totalSessions: 0 };
    }

    const durations = sessions.map(s => {
      return (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000;
    }).filter(d => d > 0);

    if (!durations.length) {
      return { avgMinutes: 0, minMinutes: 0, maxMinutes: 0, totalSessions: 0 };
    }

    return {
      avgMinutes: Math.round(durations.reduce((s, v) => s + v, 0) / durations.length),
      minMinutes: Math.round(Math.min(...durations)),
      maxMinutes: Math.round(Math.max(...durations)),
      totalSessions: durations.length,
    };
  },

  /** Satisfaction scores grouped by agent */
  async getSatisfactionByAgent(_tenantId?: string): Promise<AgentSatisfaction[]> {
    const { data: evals } = await supabase
      .from('support_evaluations')
      .select('agent_id, agent_score, system_score');

    if (!evals?.length) return [];

    // Group by agent
    const byAgent: Record<string, { agentScores: number[]; systemScores: number[] }> = {};
    for (const ev of evals) {
      const key = ev.agent_id ?? '__unassigned__';
      if (!byAgent[key]) byAgent[key] = { agentScores: [], systemScores: [] };
      if (ev.agent_score != null) byAgent[key].agentScores.push(ev.agent_score);
      if (ev.system_score != null) byAgent[key].systemScores.push(ev.system_score);
    }

    // Fetch agent names
    const agentIds = Object.keys(byAgent).filter(k => k !== '__unassigned__');
    let agentNames: Record<string, string> = {};
    if (agentIds.length) {
      const { data: agents } = await supabase
        .from('platform_users')
        .select('user_id, display_name')
        .in('user_id', agentIds);
      if (agents) {
        for (const a of agents) {
          agentNames[a.user_id] = a.display_name ?? 'Agente';
        }
      }
    }

    return Object.entries(byAgent).map(([id, scores]) => {
      const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;
      return {
        agentId: id,
        agentName: id === '__unassigned__' ? 'Não atribuído' : (agentNames[id] ?? id.slice(0, 8)),
        avgAgentScore: avg(scores.agentScores),
        avgSystemScore: avg(scores.systemScores),
        totalEvaluations: scores.agentScores.length + scores.systemScores.length,
      };
    }).sort((a, b) => b.totalEvaluations - a.totalEvaluations);
  },
};
