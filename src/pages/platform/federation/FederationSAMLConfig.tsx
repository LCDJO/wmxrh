/**
 * /platform/security/federation/saml-config — SAML Service Provider configuration
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Shield, Download, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function FederationSAMLConfig() {
  const { toast } = useToast();

  const spEntityId = `${window.location.origin}/saml/metadata`;
  const acsUrl = `${window.location.origin}/auth/callback/saml`;
  const sloUrl = `${window.location.origin}/auth/callback/saml/logout`;

  const [attributeMap, setAttributeMap] = useState({
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    first_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    last_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    groups: 'http://schemas.xmlsoap.org/claims/Group',
  });

  function copyToClipboard(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copiado', description: `${label} copiado para a área de transferência.` });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          SAML Configuration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Service Provider SAML 2.0 — endpoints, certificados e attribute mapping.
        </p>
      </div>

      {/* SP Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service Provider Metadata</CardTitle>
          <CardDescription>Forneça estes valores ao Identity Provider.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Entity ID (Issuer)</Label>
            <div className="flex gap-2">
              <Input value={spEntityId} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(spEntityId, 'Entity ID')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">ACS URL (Assertion Consumer Service)</Label>
            <div className="flex gap-2">
              <Input value={acsUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(acsUrl, 'ACS URL')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">SLO URL (Single Logout)</Label>
            <div className="flex gap-2">
              <Input value={sloUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(sloUrl, 'SLO URL')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Separator />

          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download SP Metadata XML
          </Button>
        </CardContent>
      </Card>

      {/* Attribute Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribute Mapping</CardTitle>
          <CardDescription>Mapeamento de atributos SAML para campos da plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(attributeMap).map(([field, uri]) => (
            <div key={field} className="grid grid-cols-3 gap-3 items-center">
              <Label className="text-xs font-medium capitalize">{field.replace('_', ' ')}</Label>
              <Input
                value={uri}
                onChange={(e) => setAttributeMap((prev) => ({ ...prev, [field]: e.target.value }))}
                className="col-span-2 font-mono text-xs"
              />
            </div>
          ))}
          <Button size="sm" className="mt-2">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Salvar Mapeamento
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
