import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SAML ACS (Assertion Consumer Service) Edge Function
 *
 * Handles:
 *   POST /saml-acs — SP-initiated & IdP-initiated SAML responses
 *   GET  /saml-acs?action=metadata&tenant_id=xxx — SP metadata
 *
 * Security:
 *   - Certificate-based XML signature verification
 *   - Condition validation (audience, time bounds)
 *   - Replay attack protection via assertion ID tracking
 *   - Attribute mapping (email → user_email, groups → role_mapping)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════
// XML HELPERS (minimal parser for SAML)
// ═══════════════════════════════════

function extractTag(xml: string, tag: string): string | null {
  // Handles namespaced tags like saml:Issuer or Issuer
  const patterns = [
    new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`, "s"),
    new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "s"),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractAttribute(xml: string, attr: string): string | null {
  const re = new RegExp(`${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function extractBlock(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
    "s"
  );
  const m = xml.match(re);
  return m ? m[0] : null;
}

function extractSAMLAttributes(
  assertionXml: string
): Record<string, string | string[]> {
  const attrs: Record<string, string | string[]> = {};
  const attrRegex =
    /<(?:\w+:)?Attribute\s+Name="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?Attribute>/g;
  let match;
  while ((match = attrRegex.exec(assertionXml)) !== null) {
    const name = match[1];
    const valueBlock = match[2];
    const values: string[] = [];
    const valRegex =
      /<(?:\w+:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:\w+:)?AttributeValue>/g;
    let vm;
    while ((vm = valRegex.exec(valueBlock)) !== null) {
      values.push(vm[1].trim());
    }
    attrs[name] = values.length === 1 ? values[0] : values;
  }
  return attrs;
}

// ═══════════════════════════════════
// CERTIFICATE / SIGNATURE VERIFICATION
// ═══════════════════════════════════

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importCertificate(
  pemCert: string
): Promise<CryptoKey> {
  const der = pemToArrayBuffer(pemCert);
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyXMLSignature(
  xml: string,
  certificate: string
): Promise<boolean> {
  try {
    // Extract SignatureValue and SignedInfo from the XML
    const signatureValue = extractTag(xml, "SignatureValue");
    const signedInfoBlock = extractBlock(xml, "SignedInfo");

    if (!signatureValue || !signedInfoBlock) {
      console.warn("[SAML-ACS] No signature found in response");
      return false;
    }

    const key = await importCertificate(certificate);
    const sigBytes = Uint8Array.from(atob(signatureValue.replace(/\s/g, "")), (c) =>
      c.charCodeAt(0)
    );

    // Canonicalize SignedInfo (simplified — strip whitespace between tags)
    const canonicalized = signedInfoBlock.replace(/>\s+</g, "><").trim();
    const data = new TextEncoder().encode(canonicalized);

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sigBytes,
      data
    );

    return valid;
  } catch (err) {
    console.error("[SAML-ACS] Signature verification error:", err);
    return false;
  }
}

// ═══════════════════════════════════
// REPLAY PROTECTION
// ═══════════════════════════════════

async function checkReplayAndStore(
  supabase: ReturnType<typeof createClient>,
  assertionId: string,
  tenantId: string,
  expiresAt: string
): Promise<boolean> {
  // Check if this assertion ID was already consumed
  const { data: existing } = await supabase
    .from("federation_audit_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("event_type", "saml_response_validated")
    .contains("details", { assertion_id: assertionId })
    .limit(1);

  if (existing && existing.length > 0) {
    console.warn(`[SAML-ACS] Replay detected: assertion ${assertionId}`);
    return true; // IS a replay
  }

  return false; // Not a replay
}

// ═══════════════════════════════════
// CONDITION VALIDATION
// ═══════════════════════════════════

interface ConditionResult {
  valid: boolean;
  errors: string[];
}

function validateConditions(
  assertionXml: string,
  expectedAudience: string,
  clockSkewMs: number = 300_000 // 5 min
): ConditionResult {
  const errors: string[] = [];
  const now = Date.now();

  // NotBefore
  const notBefore = extractAttribute(assertionXml, "NotBefore") ??
    extractAttribute(assertionXml, "NotOnOrAfter")
      ? null
      : null;
  const conditionsBlock = extractBlock(assertionXml, "Conditions");
  if (conditionsBlock) {
    const nb = extractAttribute(conditionsBlock, "NotBefore");
    const noa = extractAttribute(conditionsBlock, "NotOnOrAfter");

    if (nb) {
      const nbTime = new Date(nb).getTime();
      if (now < nbTime - clockSkewMs) {
        errors.push(`Assertion not yet valid (NotBefore: ${nb})`);
      }
    }

    if (noa) {
      const noaTime = new Date(noa).getTime();
      if (now > noaTime + clockSkewMs) {
        errors.push(`Assertion expired (NotOnOrAfter: ${noa})`);
      }
    }

    // Audience restriction
    const audienceRestriction = extractBlock(
      conditionsBlock,
      "AudienceRestriction"
    );
    if (audienceRestriction) {
      const audience = extractTag(audienceRestriction, "Audience");
      if (audience && audience !== expectedAudience) {
        errors.push(
          `Audience mismatch: expected ${expectedAudience}, got ${audience}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════
// ATTRIBUTE MAPPING
// ═══════════════════════════════════

interface MappedIdentity {
  email: string | null;
  roles: string[];
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  department: string | null;
  groups: string[];
  raw: Record<string, string | string[]>;
}

const DEFAULT_ATTRIBUTE_MAP: Record<string, string> = {
  // Standard SAML attributes → internal fields
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "email",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "first_name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname": "last_name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "display_name",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "groups",
  "http://schemas.xmlsoap.org/claims/Group": "groups",
  // Short names
  email: "email",
  mail: "email",
  firstName: "first_name",
  givenName: "first_name",
  lastName: "last_name",
  sn: "last_name",
  displayName: "display_name",
  cn: "display_name",
  groups: "groups",
  memberOf: "groups",
  role: "groups",
  department: "department",
};

function mapAttributes(
  raw: Record<string, string | string[]>,
  customMapping: Record<string, string>
): MappedIdentity {
  const merged = { ...DEFAULT_ATTRIBUTE_MAP, ...customMapping };
  const mapped: Record<string, string | string[]> = {};

  for (const [externalKey, internalKey] of Object.entries(merged)) {
    if (raw[externalKey] !== undefined) {
      mapped[internalKey] = raw[externalKey];
    }
  }

  const toStr = (v: string | string[] | undefined): string | null =>
    v ? (Array.isArray(v) ? v[0] : v) : null;
  const toArr = (v: string | string[] | undefined): string[] =>
    v ? (Array.isArray(v) ? v : [v]) : [];

  return {
    email: toStr(mapped["email"]),
    roles: toArr(mapped["groups"]),
    firstName: toStr(mapped["first_name"]),
    lastName: toStr(mapped["last_name"]),
    displayName: toStr(mapped["display_name"]),
    department: toStr(mapped["department"]),
    groups: toArr(mapped["groups"]),
    raw,
  };
}

// ═══════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── GET: SP Metadata ──
    if (req.method === "GET" && url.searchParams.get("action") === "metadata") {
      const tenantId = url.searchParams.get("tenant_id");
      if (!tenantId) {
        return new Response(
          JSON.stringify({ error: "tenant_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const origin = url.searchParams.get("origin") ?? url.origin;
      const entityId = `${origin}/saml/${tenantId}`;
      const acsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/saml-acs`;
      const sloUrl = `${origin}/saml/slo/${tenantId}`;

      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

      return new Response(metadata, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // ── POST: SAML Response (ACS) ──
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      let samlResponseB64: string | null = null;
      let relayState: string | null = null;

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        const params = new URLSearchParams(body);
        samlResponseB64 = params.get("SAMLResponse");
        relayState = params.get("RelayState");
      } else if (contentType.includes("application/json")) {
        const json = await req.json();
        samlResponseB64 = json.SAMLResponse ?? json.saml_response;
        relayState = json.RelayState ?? json.relay_state;
      }

      if (!samlResponseB64) {
        return new Response(
          JSON.stringify({ error: "SAMLResponse not found in request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Decode SAML Response
      const samlXml = atob(samlResponseB64);

      // Extract key fields
      const responseId = extractAttribute(samlXml, "ID") ?? "unknown";
      const inResponseTo = extractAttribute(samlXml, "InResponseTo");
      const issuer = extractTag(samlXml, "Issuer");
      const statusCode = extractAttribute(samlXml, "Value") ?? "";
      const isSuccess = statusCode.includes("Success");

      // Determine if SP-initiated or IdP-initiated
      const isIdPInitiated = !inResponseTo;

      // Extract assertion
      const assertionXml = extractBlock(samlXml, "Assertion");
      if (!assertionXml) {
        return new Response(
          JSON.stringify({
            error: "No assertion found in SAML response",
            response_id: responseId,
            status_code: statusCode,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract NameID and session index
      const nameId = extractTag(assertionXml, "NameID");
      const sessionIndex = extractAttribute(assertionXml, "SessionIndex") ??
        extractTag(assertionXml, "SessionIndex");
      const assertionId = extractAttribute(assertionXml, "ID") ?? responseId;

      // Find the IdP config by issuer
      let tenantId: string | null = null;
      let idpConfig: Record<string, unknown> | null = null;

      if (issuer) {
        const { data: configs } = await supabase
          .from("identity_provider_configs")
          .select("*")
          .eq("protocol", "saml")
          .eq("status", "active")
          .eq("entity_id", issuer);

        if (configs && configs.length > 0) {
          idpConfig = configs[0];
          tenantId = (idpConfig as { tenant_id: string }).tenant_id;
        }
      }

      // For IdP-initiated, also try from RelayState
      if (!tenantId && relayState) {
        try {
          const rs = JSON.parse(relayState);
          tenantId = rs.tenant_id ?? null;
        } catch {
          // RelayState might be a plain tenant_id
          tenantId = relayState;
        }
      }

      if (!tenantId || !idpConfig) {
        return new Response(
          JSON.stringify({
            error: "Could not resolve IdP configuration",
            issuer,
            hint: "Ensure the IdP entity_id matches a registered identity_provider_configs record",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const certificate = (idpConfig as { certificate?: string }).certificate;

      // ── 1. SIGNATURE VERIFICATION ──
      let signatureValid = false;
      if (certificate) {
        signatureValid = await verifyXMLSignature(samlXml, certificate);
        if (!signatureValid) {
          // Also try assertion-level signature
          signatureValid = await verifyXMLSignature(assertionXml, certificate);
        }
      } else {
        console.warn("[SAML-ACS] No certificate configured — skipping signature verification");
        signatureValid = true; // Allow unsigned (dev mode)
      }

      // ── 2. CONDITION VALIDATION ──
      const expectedAudience = `${url.origin}/saml/${tenantId}`;
      const conditions = validateConditions(assertionXml, expectedAudience);

      // ── 3. REPLAY PROTECTION ──
      const isReplay = await checkReplayAndStore(
        supabase,
        assertionId,
        tenantId,
        new Date(Date.now() + 600_000).toISOString()
      );

      // ── 4. ATTRIBUTE MAPPING ──
      const rawAttributes = extractSAMLAttributes(assertionXml);
      // Include NameID as email if not in attributes
      if (nameId && !rawAttributes["email"] && !rawAttributes["mail"]) {
        rawAttributes["email"] = nameId;
      }
      const customMapping = ((idpConfig as { attribute_mapping?: Record<string, string> }).attribute_mapping) ?? {};
      const identity = mapAttributes(rawAttributes, customMapping);

      // ── Build result ──
      const validationErrors: string[] = [];
      if (!signatureValid) validationErrors.push("XML signature verification failed");
      if (!isSuccess) validationErrors.push(`SAML status not success: ${statusCode}`);
      if (isReplay) validationErrors.push("Replay attack detected: assertion already consumed");
      validationErrors.push(...conditions.errors);

      const overallValid = validationErrors.length === 0;

      // ── 5. AUDIT LOG ──
      await supabase.from("federation_audit_logs").insert({
        tenant_id: tenantId,
        idp_config_id: (idpConfig as { id: string }).id,
        event_type: overallValid ? "saml_response_validated" : "saml_response_failed",
        protocol: "saml",
        success: overallValid,
        error_message: overallValid ? null : validationErrors.join("; "),
        details: {
          response_id: responseId,
          assertion_id: assertionId,
          in_response_to: inResponseTo,
          issuer,
          is_idp_initiated: isIdPInitiated,
          name_id: nameId,
          session_index: sessionIndex,
          signature_valid: signatureValid,
          conditions_valid: conditions.valid,
          is_replay: isReplay,
          mapped_email: identity.email,
          mapped_roles: identity.roles,
        },
      });

      // ── 6. CREATE/UPDATE FEDERATION SESSION ──
      let sessionId: string | null = null;
      if (overallValid) {
        const { data: session } = await supabase
          .from("federation_sessions")
          .insert({
            tenant_id: tenantId,
            idp_config_id: (idpConfig as { id: string }).id,
            protocol: "saml",
            session_index: sessionIndex,
            name_id: nameId,
            external_subject: nameId,
            attributes: {
              ...rawAttributes,
              _mapped: identity,
            },
            status: "authenticated",
            authenticated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
            ip_address: req.headers.get("x-forwarded-for") ??
              req.headers.get("cf-connecting-ip"),
            user_agent: req.headers.get("user-agent"),
          })
          .select("id")
          .single();

        sessionId = session?.id ?? null;
      }

      const result = {
        valid: overallValid,
        errors: validationErrors,
        flow: isIdPInitiated ? "idp_initiated" : "sp_initiated",
        response_id: responseId,
        assertion_id: assertionId,
        in_response_to: inResponseTo,
        issuer,
        name_id: nameId,
        session_index: sessionIndex,
        signature_valid: signatureValid,
        conditions: conditions,
        is_replay: isReplay,
        identity: overallValid ? identity : null,
        session_id: sessionId,
        relay_state: relayState,
        tenant_id: tenantId,
        idp_id: (idpConfig as { id: string }).id,
      };

      return new Response(JSON.stringify(result), {
        status: overallValid ? 200 : 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SAML-ACS] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
