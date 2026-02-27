/**
 * UIFE — SAMLServiceProvider
 *
 * Full SAML 2.0 Service Provider:
 * - SP-initiated login (AuthnRequest → IdP → ACS)
 * - IdP-initiated login (IdP → ACS directly)
 * - Assertion validation via edge function (saml-acs)
 * - Certificate verification (server-side)
 * - Replay attack protection (assertion ID tracking)
 * - Attribute mapping: email → user_email, groups → role_mapping
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  SAMLServiceProviderAPI,
  SAMLAuthnRequest,
  SAMLResponse,
  SAMLAssertion,
  IdentityProviderConfig,
} from './types';

const SP_ENTITY_BASE = `${window.location.origin}/saml`;

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return '_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════
// DEFAULT ATTRIBUTE MAPPINGS
// ═══════════════════════════════════

/**
 * Standard SAML attribute names → internal field names.
 * Custom per-IdP mappings override these defaults.
 */
export const SAML_DEFAULT_ATTRIBUTE_MAP: Record<string, string> = {
  // OASIS standard
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'first_name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'last_name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'display_name',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'groups',
  'http://schemas.xmlsoap.org/claims/Group': 'groups',
  // Common short names
  email: 'email',
  mail: 'email',
  firstName: 'first_name',
  givenName: 'first_name',
  lastName: 'last_name',
  sn: 'last_name',
  displayName: 'display_name',
  cn: 'display_name',
  groups: 'groups',
  memberOf: 'groups',
  role: 'groups',
  department: 'department',
};

/**
 * Maps raw SAML attributes to internal fields using default + custom mappings.
 */
export function mapSAMLAttributes(
  raw: Record<string, string | string[]>,
  customMapping: Record<string, string | undefined> = {},
): SAMLMappedIdentity {
  const merged = { ...SAML_DEFAULT_ATTRIBUTE_MAP, ...customMapping };
  const mapped: Record<string, string | string[]> = {};

  for (const [externalKey, internalKey] of Object.entries(merged)) {
    if (internalKey && raw[externalKey] !== undefined) {
      mapped[internalKey] = raw[externalKey];
    }
  }

  const toStr = (v: string | string[] | undefined): string | null =>
    v ? (Array.isArray(v) ? v[0] : v) : null;
  const toArr = (v: string | string[] | undefined): string[] =>
    v ? (Array.isArray(v) ? v : [v]) : [];

  return {
    user_email: toStr(mapped['email']),
    role_mapping: toArr(mapped['groups']),
    first_name: toStr(mapped['first_name']),
    last_name: toStr(mapped['last_name']),
    display_name: toStr(mapped['display_name']),
    department: toStr(mapped['department']),
    raw_attributes: raw,
  };
}

export interface SAMLMappedIdentity {
  /** Mapped from `email` attribute */
  user_email: string | null;
  /** Mapped from `groups` attribute → role assignment */
  role_mapping: string[];
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  department: string | null;
  raw_attributes: Record<string, string | string[]>;
}

// ═══════════════════════════════════
// ACS RESPONSE (from edge function)
// ═══════════════════════════════════

export interface SAMLACSResult {
  valid: boolean;
  errors: string[];
  flow: 'sp_initiated' | 'idp_initiated';
  response_id: string;
  assertion_id: string;
  in_response_to: string | null;
  issuer: string | null;
  name_id: string | null;
  session_index: string | null;
  signature_valid: boolean;
  conditions: { valid: boolean; errors: string[] };
  is_replay: boolean;
  identity: {
    email: string | null;
    roles: string[];
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    department: string | null;
    groups: string[];
    raw: Record<string, string | string[]>;
  } | null;
  session_id: string | null;
  relay_state: string | null;
  tenant_id: string;
  idp_id: string;
}

// ═══════════════════════════════════
// SAML SERVICE PROVIDER
// ═══════════════════════════════════

export function createSAMLServiceProvider(): SAMLServiceProviderAPI {
  return {
    createAuthnRequest(idpConfig, relayState) {
      const id = generateId();
      const issuer = `${SP_ENTITY_BASE}/${idpConfig.tenant_id}`;
      const destination = idpConfig.sso_url ?? '';
      const acsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/saml-acs`;

      const request: SAMLAuthnRequest = {
        id,
        issuer,
        destination,
        assertion_consumer_service_url: acsUrl,
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        force_authn: false,
        is_passive: false,
        relay_state: relayState,
      };

      return request;
    },

    buildLoginUrl(idpConfig, relayState) {
      const request = this.createAuthnRequest(idpConfig, relayState);

      const xml = `<samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${request.id}"
        Version="2.0"
        IssueInstant="${new Date().toISOString()}"
        Destination="${request.destination}"
        AssertionConsumerServiceURL="${request.assertion_consumer_service_url}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${request.issuer}</saml:Issuer>
        <samlp:NameIDPolicy Format="${request.name_id_format}" AllowCreate="true"/>
      </samlp:AuthnRequest>`;

      // Encode for HTTP-Redirect binding
      const encoded = btoa(xml);

      // Build RelayState with tenant context for IdP-initiated flow support
      const effectiveRelayState = relayState ?? JSON.stringify({
        tenant_id: idpConfig.tenant_id,
        idp_id: idpConfig.id,
        initiated_at: Date.now(),
      });

      const params = new URLSearchParams({
        SAMLRequest: encoded,
        RelayState: effectiveRelayState,
      });

      return `${request.destination}?${params.toString()}`;
    },

    async processResponse(samlResponseB64, idpConfig) {
      // Delegate to server-side edge function for:
      //   1. XML signature verification against IdP certificate
      //   2. Condition validation (audience, time bounds)
      //   3. Replay attack protection (assertion ID tracking)
      //   4. Attribute extraction & mapping

      const { data, error } = await supabase.functions.invoke('saml-acs', {
        body: {
          SAMLResponse: samlResponseB64,
          RelayState: JSON.stringify({
            tenant_id: idpConfig.tenant_id,
            idp_id: idpConfig.id,
          }),
        },
      });

      if (error) {
        console.error('[UIFE:SAML] ACS edge function error:', error);
        return {
          id: generateId(),
          in_response_to: '',
          issuer: '',
          status_code: 'urn:oasis:names:tc:SAML:2.0:status:Responder',
          signature_valid: false,
        };
      }

      const result = data as SAMLACSResult;

      const response: SAMLResponse = {
        id: result.response_id,
        in_response_to: result.in_response_to ?? '',
        issuer: result.issuer ?? '',
        status_code: result.valid
          ? 'urn:oasis:names:tc:SAML:2.0:status:Success'
          : 'urn:oasis:names:tc:SAML:2.0:status:Responder',
        signature_valid: result.signature_valid,
      };

      // Attach assertion if valid
      if (result.valid && result.identity) {
        response.assertion = {
          subject_name_id: result.name_id ?? '',
          subject_name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          session_index: result.session_index ?? '',
          authn_instant: new Date().toISOString(),
          authn_context_class: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
          conditions: {
            not_before: new Date().toISOString(),
            not_on_or_after: new Date(Date.now() + 8 * 3600_000).toISOString(),
            audience_restrictions: [`${SP_ENTITY_BASE}/${idpConfig.tenant_id}`],
          },
          attributes: result.identity.raw,
        };
      }

      return response;
    },

    createLogoutRequest(idpConfig, nameId, sessionIndex) {
      const id = generateId();
      const issuer = `${SP_ENTITY_BASE}/${idpConfig.tenant_id}`;
      const destination = idpConfig.slo_url ?? '';

      const xml = `<samlp:LogoutRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${new Date().toISOString()}"
        Destination="${destination}">
        <saml:Issuer>${issuer}</saml:Issuer>
        <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
        <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>
      </samlp:LogoutRequest>`;

      const encoded = btoa(xml);
      return `${destination}?SAMLRequest=${encodeURIComponent(encoded)}`;
    },

    getMetadata(tenantId) {
      const entityId = `${SP_ENTITY_BASE}/${tenantId}`;
      const acsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/saml-acs`;
      const sloUrl = `${SP_ENTITY_BASE}/slo/${tenantId}`;

      return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="true"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
    },
  };
}
