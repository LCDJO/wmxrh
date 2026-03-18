export type TalentView = 'dashboard' | 'candidates' | 'profile' | 'pipeline' | 'jobs' | 'settings';

export type CandidateStage = 'novo' | 'triagem' | 'entrevista' | 'proposta' | 'contratado';
export type CandidateOrigin = 'site' | 'linkedin' | 'importação' | 'indicação';
export type RiskLevel = 'baixo' | 'médio' | 'alto';
export type EnrichmentSource = 'Receita Federal' | 'CNJ' | 'TST' | 'APIs públicas';

export interface CandidateDocument {
  id: string;
  type: 'Currículo' | 'Certificado' | 'Laudo' | 'Portfólio';
  title: string;
  updatedAt: string;
  status: 'validado' | 'pendente' | 'vencendo';
}

export interface CandidateTimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
}

export interface CandidateScoreBreakdown {
  total: number;
  technical: number;
  behavioral: number;
  risk: number;
  aderencia: number;
}

export interface CandidateLocation {
  city: string;
  state: string;
  x: number;
  y: number;
}

export interface CandidateInsight {
  title: string;
  text: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  origin: CandidateOrigin;
  stage: CandidateStage;
  risk: RiskLevel;
  role: string;
  score: CandidateScoreBreakdown;
  city: string;
  state: string;
  summary: string;
  skills: string[];
  aiInsights: CandidateInsight[];
  location: CandidateLocation;
  documents: CandidateDocument[];
  timeline: CandidateTimelineEvent[];
  enrichments: Array<{
    source: EnrichmentSource;
    status: 'concluído' | 'processando';
    updatedAt: string;
    data: Record<string, string | number | boolean | string[]>;
  }>;
  linkedJobIds: string[];
}

export interface Job {
  id: string;
  title: string;
  status: 'aberta' | 'pausada' | 'fechada';
  department: string;
  seniority: 'Júnior' | 'Pleno' | 'Sênior';
  applicants: number;
  openDays: number;
  location: string;
  salaryRange: string;
  requirements: string[];
  summary: string;
}

export interface TalentMetricPoint {
  label: string;
  candidatos: number;
  score: number;
}

export interface PipelineDistributionPoint {
  stage: CandidateStage;
  total: number;
}
