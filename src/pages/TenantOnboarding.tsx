import { useState } from 'react';
import { useCreateTenant } from '@/domains/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TenantOnboarding() {
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const { toast } = useToast();
  const createMutation = useCreateTenant();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, document: document || null }, {
      onSuccess: () => toast({ title: 'Organização criada!', description: 'Sua organização foi criada com sucesso.' }),
      onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-accent mb-6">
            <Building2 className="h-7 w-7 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">Criar Organização</h1>
          <p className="text-muted-foreground mt-2">
            Configure sua empresa, grupo ou escritório para começar a gerenciar seus recursos humanos.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Organização *</Label>
            <Input id="name" placeholder="Ex: Grupo Alpha, Contabilidade XYZ" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc">CNPJ / CPF</Label>
            <Input id="doc" placeholder="00.000.000/0000-00" value={document} onChange={e => setDocument(e.target.value)} />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? 'Criando...' : 'Criar Organização'}
          </Button>
        </form>
      </div>
    </div>
  );
}
