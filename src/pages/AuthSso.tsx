/**
 * AuthSso — SSO Login page.
 * 
 * Receives `?domain=example.com` and initiates federation login
 * via the ssoService (UIFE → Supabase fallback).
 * 
 * If no IdP is found for the domain, shows a clear error.
 */
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ssoService } from '@/domains/security/sso-ready';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';

type SsoState = 'loading' | 'redirecting' | 'not_found' | 'disabled' | 'error';

export default function AuthSso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const domain = searchParams.get('domain')?.toLowerCase().trim() ?? '';
  const [state, setState] = useState<SsoState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [idpName, setIdpName] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!domain) {
      setState('error');
      setErrorMsg('Domínio não informado. Volte e insira seu email corporativo.');
      return;
    }

    if (attemptedRef.current) return;
    attemptedRef.current = true;

    (async () => {
      try {
        // 1. Check if SSO feature is enabled
        if (!ssoService.isFeatureEnabled()) {
          // Even if feature flag is off, check DB for an active IdP for this domain
          const { data: idpData } = await supabase
            .from('identity_provider_configs')
            .select('id, name, protocol, status')
            .contains('allowed_domains', [domain])
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

          if (!idpData) {
            setState('not_found');
            return;
          }

          // IdP exists but SSO feature flag is off
          setIdpName(idpData.name);
          setState('disabled');
          return;
        }

        // 2. Try SSO login via ssoService (UIFE + Supabase fallback)
        setState('loading');
        const result = await ssoService.signInWithSSO(domain);

        if (result?.url) {
          setState('redirecting');
          window.location.href = result.url;
          return;
        }

        // 3. No IdP found
        setState('not_found');
      } catch (err: any) {
        console.error('[AuthSso] Error:', err);
        setState('error');
        setErrorMsg(err?.message ?? 'Erro inesperado ao iniciar login SSO.');
      }
    })();
  }, [domain]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Login SSO Corporativo</CardTitle>
          {domain && (
            <CardDescription>
              Domínio: <Badge variant="outline" className="font-mono text-xs">{domain}</Badge>
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Loading */}
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Localizando provedor de identidade...</p>
            </div>
          )}

          {/* Redirecting */}
          {state === 'redirecting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Redirecionando para o provedor de identidade...</p>
            </div>
          )}

          {/* Not Found */}
          {state === 'not_found' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-accent-foreground" />
              <div>
                <p className="font-medium">Provedor SSO não encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Nenhum provedor de identidade ativo está configurado para o domínio <strong>{domain}</strong>.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Solicite ao administrador da sua organização que configure o SSO em Configurações → SSO / Federação.
                </p>
              </div>
            </div>
          )}

          {/* Disabled */}
          {state === 'disabled' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="font-medium">SSO configurado mas desabilitado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O provedor <strong>{idpName}</strong> está configurado para este domínio, 
                  mas o recurso SSO está desativado no momento.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Contate o administrador para habilitar o SSO.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">Erro no login SSO</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Back button (always visible except during redirect) */}
          {state !== 'redirecting' && state !== 'loading' && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate('/auth/login')}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
