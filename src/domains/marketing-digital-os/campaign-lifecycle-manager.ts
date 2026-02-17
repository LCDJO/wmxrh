/**
 * CampaignLifecycleManager — Manages marketing campaign lifecycle.
 *
 * Campaigns group multiple marketing assets (landing pages, experiments,
 * email sequences) into coordinated efforts with shared goals and timelines.
 *
 * States: draft → scheduled → active → paused → completed → archived
 */

// ── Types ──────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';

export interface CampaignAssetRef {
  type: 'landing_page' | 'experiment' | 'email_sequence' | 'website_page';
  assetId: string;
  role: 'primary' | 'supporting';
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  goal: string;
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  assets: CampaignAssetRef[];
  startDate: string | null;
  endDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignTransition {
  from: CampaignStatus;
  to: CampaignStatus;
  allowed: boolean;
  reason?: string;
}

// ── Status Machine ─────────────────────────────────────

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['scheduled', 'archived'],
  scheduled: ['active', 'draft', 'archived'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed', 'archived'],
  completed: ['archived'],
  archived: [],
};

// ── Manager ────────────────────────────────────────────

export class CampaignLifecycleManager {
  private campaigns: Campaign[] = [];

  create(input: Pick<Campaign, 'name' | 'description' | 'goal' | 'targetMetric' | 'targetValue'>): Campaign {
    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      ...input,
      status: 'draft',
      currentValue: 0,
      assets: [],
      startDate: null,
      endDate: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.campaigns.push(campaign);
    return campaign;
  }

  transition(campaignId: string, to: CampaignStatus): CampaignTransition {
    const campaign = this.campaigns.find(c => c.id === campaignId);
    if (!campaign) return { from: 'draft', to, allowed: false, reason: 'Campanha não encontrada.' };

    const allowed = VALID_TRANSITIONS[campaign.status]?.includes(to) ?? false;
    if (allowed) {
      campaign.status = to;
      campaign.updatedAt = new Date().toISOString();
      if (to === 'active' && !campaign.startDate) campaign.startDate = new Date().toISOString();
      if (to === 'completed') campaign.endDate = new Date().toISOString();
    }

    return {
      from: campaign.status,
      to,
      allowed,
      reason: allowed ? undefined : `Transição de "${campaign.status}" para "${to}" não é permitida.`,
    };
  }

  addAsset(campaignId: string, asset: CampaignAssetRef): boolean {
    const campaign = this.campaigns.find(c => c.id === campaignId);
    if (!campaign || campaign.status === 'completed' || campaign.status === 'archived') return false;
    campaign.assets.push(asset);
    campaign.updatedAt = new Date().toISOString();
    return true;
  }

  getAll(): Campaign[] {
    return [...this.campaigns];
  }

  getByStatus(status: CampaignStatus): Campaign[] {
    return this.campaigns.filter(c => c.status === status);
  }

  getById(id: string): Campaign | undefined {
    return this.campaigns.find(c => c.id === id);
  }
}

export const campaignLifecycleManager = new CampaignLifecycleManager();
