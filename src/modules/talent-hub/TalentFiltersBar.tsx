import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TalentFiltersBarProps {
  search: string;
  onSearch: (value: string) => void;
}

export function TalentFiltersBar({ search, onSearch }: TalentFiltersBarProps) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Busca inteligente por nome, skill, cidade ou contexto"
          className="pl-9"
        />
      </div>
      <Select defaultValue="all-stage">
        <SelectTrigger>
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-stage">Todas etapas</SelectItem>
          <SelectItem value="novo">Novo</SelectItem>
          <SelectItem value="triagem">Triagem</SelectItem>
          <SelectItem value="entrevista">Entrevista</SelectItem>
          <SelectItem value="proposta">Proposta</SelectItem>
          <SelectItem value="contratado">Contratado</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="all-origin">
        <SelectTrigger>
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-origin">Todas origens</SelectItem>
          <SelectItem value="site">Site</SelectItem>
          <SelectItem value="linkedin">LinkedIn</SelectItem>
          <SelectItem value="importacao">Importação</SelectItem>
          <SelectItem value="indicacao">Indicação</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="all-risk">
        <SelectTrigger>
          <SelectValue placeholder="Risco" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-risk">Qualquer risco</SelectItem>
          <SelectItem value="baixo">Baixo</SelectItem>
          <SelectItem value="médio">Médio</SelectItem>
          <SelectItem value="alto">Alto</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline">Filtros avançados</Button>
    </div>
  );
}
