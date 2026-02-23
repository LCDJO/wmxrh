/**
 * LiveDisplayPair — Public page accessed via QR Code scan from TV.
 * Route: /live-display/pair?code=XXXXXX
 * 
 * If user is logged in → shows display selector + confirm pairing.
 * If not logged in → prompts login, preserving the pairing code in redirect.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DISPLAY_TIPOS } from '@/modules/live-display';
import type { DisplayBoardTipo } from '@/modules/live-display';
import type { Database } from '@/integrations/supabase/types';
import { Tv, Monitor, CheckCircle2, Loader2, LinkIcon, LogIn, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type LiveDisplay = Database['public']['Tables']['live_displays']['Row'];

export default function LiveDisplayPair() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();

  const code = searchParams.get('code')?.toUpperCase() ?? '';

  const [displays, setDisplays] = useState<LiveDisplay[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState('');

  const tenantId = currentTenant?.id;

  // Fetch displays for the tenant
  const fetchDisplays = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('live_displays')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('nome');
    setDisplays(data ?? []);
    if (data && data.length > 0 && !selectedDisplayId) {
      setSelectedDisplayId(data[0].id);
    }
    setLoading(false);
  }, [tenantId, selectedDisplayId]);

  useEffect(() => {
    if (tenantId) fetchDisplays();
  }, [tenantId, fetchDisplays]);

  const handlePair = async () => {
    if (!code || !selectedDisplayId) return;
    setPairing(true);
    setError('');
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('display-pair-confirm', {
        body: { pairing_code: code, display_id: selectedDisplayId },
      });
      if (fnError || result?.error) {
        setError(result?.error ?? fnError?.message ?? 'Erro desconhecido');
      } else {
        setPaired(true);
        toast.success('Display pareado com sucesso!');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setPairing(false);
  };

  // ── Loading states ──
  if (authLoading || (user && tenantLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // ── No code provided ──
  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum código de pareamento encontrado.</p>
            <p className="text-xs text-muted-foreground">Escaneie o QR Code exibido na TV para iniciar o pareamento.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Pareamento de Display</CardTitle>
            <CardDescription>
              Para parear a TV com o código <span className="font-mono font-bold text-primary">{code}</span>, você precisa estar autenticado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => {
                sessionStorage.setItem('redirectAfterLogin', `/live-display/pair?code=${code}`);
                navigate('/auth/login');
              }}
            >
              <LogIn className="h-4 w-4" />
              Fazer login para continuar
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Após o login, você retornará automaticamente para concluir o pareamento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success state ──
  if (paired) {
    const pairedDisplay = displays.find(d => d.id === selectedDisplayId);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-5">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Pareamento concluído!</h2>
              <p className="text-sm text-muted-foreground">
                A TV agora está vinculada ao display{' '}
                <span className="font-semibold text-foreground">{pairedDisplay?.nome}</span>.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              O conteúdo começará a ser exibido automaticamente na TV em instantes.
            </p>
            <Button variant="outline" onClick={() => navigate('/live-display')}>
              Ir para gerenciamento de displays
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main pairing screen ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <LinkIcon className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Parear Display</CardTitle>
          <CardDescription>
            Código capturado: <span className="font-mono font-bold text-primary text-lg">{code}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displays.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <Monitor className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum display configurado.</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/live-display')}>
                Criar um display primeiro
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Selecione o display para vincular à TV:</Label>
                <RadioGroup value={selectedDisplayId} onValueChange={setSelectedDisplayId} className="space-y-2">
                  {displays.map((display) => {
                    const tipoInfo = DISPLAY_TIPOS[display.tipo as DisplayBoardTipo];
                    return (
                      <label
                        key={display.id}
                        htmlFor={`display-${display.id}`}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedDisplayId === display.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <RadioGroupItem value={display.id} id={`display-${display.id}`} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{display.nome}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {tipoInfo?.label ?? display.tipo}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tipoInfo?.description}
                          </p>
                          {display.rotacao_automatica && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Rotação automática: {display.intervalo_rotacao}s
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!selectedDisplayId || pairing}
                onClick={handlePair}
              >
                {pairing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tv className="h-4 w-4" />
                )}
                {pairing ? 'Pareando...' : 'Confirmar pareamento'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
