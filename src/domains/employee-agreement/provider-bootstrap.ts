/**
 * Provider Bootstrap — Registers all signature provider adapters
 *
 * Must be called once at application startup (e.g. in App.tsx or main.tsx).
 * After registration, digitalSignatureAdapter.send() will route correctly.
 */

import { registerSignatureProvider } from './ports';
import { simulationSignerAdapter } from './adapters/simulation-signer';
import { openSignAdapter } from './adapters/opensign-adapter';
import { clicksignAdapter } from './adapters/clicksign-adapter';
import { autentiqueAdapter } from './adapters/autentique-adapter';
import { zapsignAdapter } from './adapters/zapsign-adapter';

let _initialized = false;

export function bootstrapSignatureProviders(): void {
  if (_initialized) return;

  // Simulation is always available (dev/test)
  registerSignatureProvider(simulationSignerAdapter);

  // External providers — adapters are registered eagerly;
  // actual API keys are validated at the edge function level.
  registerSignatureProvider(openSignAdapter);
  registerSignatureProvider(clicksignAdapter);
  registerSignatureProvider(autentiqueAdapter);
  registerSignatureProvider(zapsignAdapter);

  _initialized = true;
  console.log('[SignatureProviders] Bootstrap complete — 5 providers registered.');
}
