import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    let token: string | null = null;
    let requesterName: string | null = null;
    let requesterEmail: string | null = null;
    let requesterPurpose: string | null = null;
    let privacyAccepted = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json();
      token = body.token;
      requesterName = body.requester_name ?? null;
      requesterEmail = body.requester_email ?? null;
      requesterPurpose = body.requester_purpose ?? null;
      privacyAccepted = body.privacy_accepted === true;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, status: "invalid_token", hash_verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For POST: validate mandatory LGPD fields
    if (req.method === "POST") {
      const missing: string[] = [];
      if (!requesterName?.trim()) missing.push("requester_name");
      if (!requesterEmail?.trim()) missing.push("requester_email");
      if (!requesterPurpose?.trim()) missing.push("requester_purpose");
      if (!privacyAccepted) missing.push("privacy_accepted");

      if (missing.length > 0) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "lgpd_fields_required",
            hash_verified: false,
            missing_fields: missing,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Lookup token
    const { data: tokenRow, error: tokenError } = await supabase
      .from("document_validation_tokens")
      .select("*")
      .eq("token", token)
      .single();

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ valid: false, status: "invalid_token", hash_verified: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status
    let accessResult = "success";

    if (tokenRow.status === "revoked") {
      accessResult = "revoked";
    } else if (tokenRow.status === "expired") {
      accessResult = "expired";
    } else if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      accessResult = "expired";
      await supabase
        .from("document_validation_tokens")
        .update({ status: "expired" })
        .eq("id", tokenRow.id);
    }

    // Verify hash against document vault
    let hashVerified = false;
    let documentName: string | null = null;
    let signedAt: string | null = null;
    let documentHash: string | null = null;
    let versao: number | null = null;

    if (accessResult === "success") {
      const { data: vaultRow } = await supabase
        .from("document_vault")
        .select("nome_documento, hash_documento, created_at, versao")
        .eq("id", tokenRow.document_vault_id)
        .single();

      if (vaultRow) {
        hashVerified = vaultRow.hash_documento === tokenRow.document_hash;
        documentName = vaultRow.nome_documento;
        signedAt = vaultRow.created_at;
        documentHash = vaultRow.hash_documento;
        versao = vaultRow.versao;

        if (!hashVerified) {
          accessResult = "hash_mismatch";
        }
      } else {
        // Fallback: check signed_documents table
        const { data: signedRow } = await supabase
          .from("signed_documents")
          .select("hash_sha256, documento_url, data_assinatura, versao")
          .eq("validation_token", token)
          .eq("ativo", true)
          .single();

        if (signedRow) {
          hashVerified = true;
          documentHash = signedRow.hash_sha256;
          signedAt = signedRow.data_assinatura;
          versao = signedRow.versao;
          documentName = `Documento assinado v${signedRow.versao}`;
        } else {
          accessResult = "invalid_token";
        }
      }
    }

    // Resolve signed_document_id if available
    let signedDocumentId: string | null = null;
    if (accessResult === "success") {
      const { data: sdRow } = await supabase
        .from("signed_documents")
        .select("id")
        .eq("validation_token", token)
        .eq("ativo", true)
        .maybeSingle();
      signedDocumentId = sdRow?.id ?? null;
    }

    // LGPD: Log access attempt with all requester data
    await supabase.from("document_access_logs").insert({
      token_id: tokenRow.id,
      tenant_id: tokenRow.tenant_id,
      signed_document_id: signedDocumentId,
      ip_address: ip,
      user_agent: ua,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_document: requesterEmail,
      requester_purpose: requesterPurpose,
      access_result: accessResult,
      metadata: {
        privacy_accepted: privacyAccepted,
        privacy_accepted_at: new Date().toISOString(),
      },
    });

    const isValid = accessResult === "success" && hashVerified;

    return new Response(
      JSON.stringify({
        valid: isValid,
        status: accessResult,
        hash_verified: hashVerified,
        ...(isValid && {
          document_name: documentName,
          signed_at: signedAt,
          document_hash: documentHash,
          versao: versao,
        }),
      }),
      {
        status: isValid ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[validate-document] Error:", err);
    return new Response(
      JSON.stringify({ valid: false, status: "error", hash_verified: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
