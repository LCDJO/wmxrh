export interface TalentCandidateRecord {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpf_hash: string;
  cidade: string | null;
  estado: string | null;
  origem: string;
  metadata_json: Record<string, unknown> | null;
}

export interface ProviderExecutionContext {
  candidate: TalentCandidateRecord;
  identifier?: string | null;
  identifierType?: "cpf" | "cnpj" | null;
}

export interface ProviderResult {
  provider: string;
  mode: "real" | "public" | "mock";
  structuredData: Record<string, unknown>;
  riskScore: number;
  notes: string[];
  fetchedAt: string;
}

interface Provider {
  key: string;
  execute(ctx: ProviderExecutionContext): Promise<ProviderResult>;
}

const nowIso = () => new Date().toISOString();

function deterministicScore(seed: string, max = 100): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return Number((hash % max).toFixed(2));
}

function normalizeDigits(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\D/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function resolveUrl(template: string, identifier: string): string {
  return template.includes("{document}")
    ? template.replaceAll("{document}", encodeURIComponent(identifier))
    : `${template}${template.includes("?") ? "&" : "?"}document=${encodeURIComponent(identifier)}`;
}

class MockProvider implements Provider {
  key: string;
  constructor(private readonly keyName: string) {
    this.key = keyName;
  }

  async execute(ctx: ProviderExecutionContext): Promise<ProviderResult> {
    const seed = `${this.keyName}:${ctx.candidate.id}:${ctx.identifier ?? ctx.candidate.email}`;
    const risk = deterministicScore(seed);
    return {
      provider: this.keyName,
      mode: "mock",
      structuredData: {
        candidate_ref: ctx.candidate.id,
        source_mode: "mock",
        confidence: 0.35,
        summary: `Mock result for ${this.keyName}`,
        traits: {
          consistency: deterministicScore(`${seed}:consistency`),
          exposure: deterministicScore(`${seed}:exposure`),
          watchlist_hits: risk > 70 ? 1 : 0,
        },
      },
      riskScore: risk,
      notes: ["Provider mock acionado por falta de credenciais ou identificador bruto."],
      fetchedAt: nowIso(),
    };
  }
}

class ReceitaFederalRealProvider implements Provider {
  key = "receita_federal";

  async execute(ctx: ProviderExecutionContext): Promise<ProviderResult> {
    const identifier = normalizeDigits(ctx.identifier);
    const tokenUrl = Deno.env.get("SERPRO_TOKEN_URL");
    const consumerKey = Deno.env.get("SERPRO_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("SERPRO_CONSUMER_SECRET");
    const cpfBaseUrl = Deno.env.get("SERPRO_CPF_BASE_URL");

    if (!identifier || ctx.identifierType !== "cpf") throw new Error("CPF bruto não informado para Receita Federal");
    if (!tokenUrl || !consumerKey || !consumerSecret || !cpfBaseUrl) throw new Error("Credenciais SERPRO ausentes");

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      throw new Error(`SERPRO token failed [${tokenRes.status}]: ${errorBody}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string | undefined;
    if (!accessToken) throw new Error("SERPRO access_token ausente");

    const response = await fetch(resolveUrl(cpfBaseUrl, identifier), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`SERPRO CPF failed [${response.status}]: ${JSON.stringify(payload)}`);
    }

    return {
      provider: this.key,
      mode: "real",
      structuredData: {
        identifier_last4: identifier.slice(-4),
        source: "serpro",
        payload,
      },
      riskScore: deterministicScore(`${identifier}:${JSON.stringify(payload)}`),
      notes: ["Consulta real via SERPRO executada."],
      fetchedAt: nowIso(),
    };
  }
}

class TribunalRealProvider implements Provider {
  constructor(
    public readonly key: "cnj" | "tst",
    private readonly envUrl: string,
    private readonly envApiKey: string,
  ) {}

  async execute(ctx: ProviderExecutionContext): Promise<ProviderResult> {
    const identifier = normalizeDigits(ctx.identifier);
    const baseUrl = Deno.env.get(this.envUrl);
    const apiKey = Deno.env.get(this.envApiKey);

    if (!identifier) throw new Error(`${this.key}: identificador bruto ausente`);
    if (!baseUrl || !apiKey) throw new Error(`${this.key}: credenciais ausentes`);

    const response = await fetch(resolveUrl(baseUrl, identifier), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`${this.key} failed [${response.status}]: ${JSON.stringify(payload)}`);
    }

    return {
      provider: this.key,
      mode: "real",
      structuredData: {
        source: this.key,
        identifier_last4: identifier.slice(-4),
        payload,
      },
      riskScore: deterministicScore(`${this.key}:${identifier}:${JSON.stringify(payload)}`),
      notes: [`Consulta real em ${this.key.toUpperCase()} executada.`],
      fetchedAt: nowIso(),
    };
  }
}

class PublicRegistryProvider implements Provider {
  constructor(public readonly key: "ceis" | "trabalho_escravo", private readonly envUrl: string) {}

  async execute(ctx: ProviderExecutionContext): Promise<ProviderResult> {
    const identifier = normalizeDigits(ctx.identifier);
    const baseUrl = Deno.env.get(this.envUrl);
    if (!identifier) throw new Error(`${this.key}: identificador bruto ausente`);
    if (!baseUrl) throw new Error(`${this.key}: URL pública não configurada`);

    const response = await fetch(resolveUrl(baseUrl, identifier), {
      headers: { Accept: "application/json" },
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`${this.key} failed [${response.status}]: ${JSON.stringify(payload)}`);
    }

    return {
      provider: this.key,
      mode: "public",
      structuredData: {
        source: this.key,
        identifier_last4: identifier.slice(-4),
        payload,
      },
      riskScore: deterministicScore(`${this.key}:${identifier}:${JSON.stringify(payload)}`),
      notes: [`Consulta pública em ${this.key} executada.`],
      fetchedAt: nowIso(),
    };
  }
}

const providerChains: Record<string, Provider[]> = {
  receita_federal: [
    new ReceitaFederalRealProvider(),
    new MockProvider("receita_federal"),
  ],
  cnj: [
    new TribunalRealProvider("cnj", "CNJ_API_URL", "CNJ_API_KEY"),
    new MockProvider("cnj"),
  ],
  tst: [
    new TribunalRealProvider("tst", "TST_API_URL", "TST_API_KEY"),
    new MockProvider("tst"),
  ],
  ceis: [
    new PublicRegistryProvider("ceis", "CEIS_API_URL"),
    new MockProvider("ceis"),
  ],
  trabalho_escravo: [
    new PublicRegistryProvider("trabalho_escravo", "TRABALHO_ESCRAVO_API_URL"),
    new MockProvider("trabalho_escravo"),
  ],
};

export async function resolveEnrichmentProvider(
  providerKey: string,
  ctx: ProviderExecutionContext,
): Promise<ProviderResult> {
  const chain = providerChains[providerKey] ?? [new MockProvider(providerKey)];
  const errors: string[] = [];

  for (const provider of chain) {
    try {
      const result = await provider.execute(ctx);
      return {
        ...result,
        notes: errors.length > 0 ? [...errors, ...result.notes] : result.notes,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`No enrichment provider available for ${providerKey}`);
}

export function buildScoreSnapshot(results: ProviderResult[]) {
  const riskValues = results.map((item) => item.riskScore);
  const riskAverage = riskValues.length > 0
    ? Number((riskValues.reduce((sum, value) => sum + value, 0) / riskValues.length).toFixed(2))
    : 0;

  const technicalScore = Number(Math.max(0, 100 - riskAverage * 0.3).toFixed(2));
  const behavioralScore = Number(Math.max(0, 100 - riskAverage * 0.2).toFixed(2));
  const totalScore = Number(Math.max(0, ((technicalScore + behavioralScore + (100 - riskAverage)) / 3)).toFixed(2));

  return {
    score_total: totalScore,
    score_tecnico: technicalScore,
    score_comportamental: behavioralScore,
    score_risco: riskAverage,
    detalhes_json: {
      providers: results.map((item) => ({
        provider: item.provider,
        mode: item.mode,
        risk_score: item.riskScore,
        fetched_at: item.fetchedAt,
      })),
      generated_at: nowIso(),
    },
  };
}
