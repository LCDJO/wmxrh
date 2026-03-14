/**
 * System Atlas — Layout with sub-navigation tabs
 */
import { Outlet } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { Map, Database, GitBranch, Search, Boxes, AlertTriangle } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Módulos', path: '/platform/structure/atlas/modules', icon: Boxes, description: 'Visão de módulos do sistema' },
  { label: 'Banco de Dados', path: '/platform/structure/atlas/database', icon: Database, description: 'Explorador de tabelas e colunas' },
  { label: 'Relações', path: '/platform/structure/atlas/relations', icon: GitBranch, description: 'Grafo de relações entre tabelas' },
  { label: 'Impacto', path: '/platform/structure/atlas/impact', icon: AlertTriangle, description: 'Análise de impacto de alterações' },
  { label: 'Pesquisa', path: '/platform/structure/atlas/search', icon: Search, description: 'Pesquisa global de campos' },
];

export default function SystemAtlasLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Map className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">System Atlas</h1>
          <p className="text-sm text-muted-foreground">Explorador visual da arquitetura do sistema e do banco de dados</p>
        </div>
      </div>

      <nav className="flex gap-2 border-b border-border pb-0">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent transition-colors hover:text-foreground hover:bg-accent/5 -mb-[1px]"
            activeClassName="text-primary border-primary"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
