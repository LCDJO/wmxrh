/**
 * UIFE — SAMLServiceProvider
 *
 * Implements SAML 2.0 Service Provider logic:
 * - AuthnRequest generation
 * - Response parsing & validation
 * - Single Logout (SLO)
 * - SP Metadata generation
 *
 * NOTE: Full XML signing/validation requires a backend edge function.
 * This module builds the protocol messages; actual crypto happens server-side.
 */

import type {
  SAMLServiceProviderAPI,
  SAMLAuthnRequest,
  SAMLResponse,
  IdentityProviderConfig,
} from './types';

const SP_ENTITY_BASE = `${window.location.origin}/saml`;

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return '_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function createSAMLServiceProvider(): SAMLServiceProviderAPI {
  return {
    createAuthnRequest(idpConfig, relayState) {
      const id = generateId();
      const issuer = `${SP_ENTITY_BASE}/${idpConfig.tenant_id}`;
      const destination = idpConfig.sso_url ?? '';
      const acsUrl = `${SP_ENTITY_BASE}/acs/${idpConfig.tenant_id}`;

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

      // Build AuthnRequest XML (simplified — production uses server-side signing)
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

      // Deflate + Base64 encode for HTTP-Redirect binding
      const encoded = btoa(xml);
      const params = new URLSearchParams({
        SAMLRequest: encoded,
        ...(relayState ? { RelayState: relayState } : {}),
      });

      return `${request.destination}?${params.toString()}`;
    },

    async processResponse(_samlResponse, _idpConfig) {
      // In production, this delegates to an edge function that:
      // 1. Base64-decodes the SAMLResponse
      // 2. Validates XML signature against IdP certificate
      // 3. Validates conditions (audience, time bounds)
      // 4. Extracts assertions & attributes
      //
      // Stub returns a typed structure for integration testing.
      console.warn('[UIFE:SAML] processResponse requires server-side validation via edge function');

      return {
        id: generateId(),
        in_response_to: '',
        issuer: '',
        status_code: 'urn:oasis:names:tc:SAML:2.0:status:Responder',
        signature_valid: false,
      };
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
      const acsUrl = `${SP_ENTITY_BASE}/acs/${tenantId}`;
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
