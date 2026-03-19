/**
 * PlatformPermissionGraphBuilder — 3-panel visual editor for platform IAM.
 *
 * [ Permission Library ] [ Graph Canvas ] [ Access Preview ]
 *
 * Node types: RoleNode, PermissionNode, ScopeNode
 * Edge types: grants_permission, inherits_role
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2, RotateCcw, Info } from 'lucide-react';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission, PlatformAccessScope } from '@/pages/platform/security/PlatformSecurity';
import type { GraphNode, GraphEdge } from './types';
import { useGraphLayout } from './useGraphLayout';
import { GraphCanvas } from './GraphCanvas';
import { PermissionLibrary } from './PermissionLibrary';
import { AccessPreview } from './AccessPreview';

interface Props {
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
  scopes: PlatformAccessScope[];
  isSuperAdmin: boolean;
}

export function PlatformPermissionGraphBuilder({ roles, permissions, rolePerms, scopes, isSuperAdmin }: Props) {
  const layoutData = useGraphLayout({ roles, permissions, rolePerms, scopes });

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize from layout
  useEffect(() => {
    setNodes(layoutData.nodes);
    setEdges(layoutData.edges);
  }, [layoutData]);

  // Reset layout
  const resetLayout = useCallback(() => {
    setNodes(layoutData.nodes);
    setSelectedNodeId(null);
  }, [layoutData]);

  // Highlighted nodes — when a node is selected, highlight connected nodes
  const highlightedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const ids = new Set<string>([selectedNodeId]);

    edges.forEach(edge => {
      if (edge.sourceId === selectedNodeId) ids.add(edge.targetId);
      if (edge.targetId === selectedNodeId) ids.add(edge.sourceId);
    });

    return ids;
  }, [selectedNodeId, edges]);

  // Select from library
  const handleSelectPerm = useCallback((permId: string) => {
    const nodeId = `perm-${permId}`;
    setSelectedNodeId(prev => prev === nodeId ? null : nodeId);
  }, []);

  const selectedPermId = selectedNodeId?.startsWith('perm-')
    ? selectedNodeId.replace('perm-', '')
    : null;

  // Stats
  const edgeStats = useMemo(() => {
    const grants = edges.filter(e => e.type === 'grants_permission').length;
    const inherits = edges.filter(e => e.type === 'inherits_role').length;
    return { grants, inherits };
  }, [edges]);

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300',
      isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold font-display">Permission Graph Builder</h3>
          <Badge variant="outline" className="text-[9px] gap-1">
            {nodes.length} nodes
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1">
            {edgeStats.grants} grants
          </Badge>
          {edgeStats.inherits > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-1">
              {edgeStats.inherits} inherits
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetLayout} title="Reset layout">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Sair fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className={cn(
        'grid grid-cols-[220px_1fr_240px]',
        isFullscreen ? 'h-[calc(100%-44px)]' : 'h-[640px]',
      )}>
        {/* Left: Permission Library */}
        <div className="border-r border-border overflow-hidden">
          <PermissionLibrary
            permissions={permissions}
            roles={roles}
            rolePerms={rolePerms}
            selectedPermId={selectedPermId}
            onSelectPerm={handleSelectPerm}
          />
        </div>

        {/* Center: Graph Canvas */}
        <div className="overflow-hidden relative">
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            highlightedNodeIds={highlightedNodeIds}
            onSelectNode={setSelectedNodeId}
            onNodesChange={setNodes}
          />

          {/* Legend overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-background/80 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <div className="w-4 h-[2px] bg-primary/50 rounded" />
              grants_permission
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <div className="w-4 h-[2px] border-t-2 border-dashed border-destructive/50" />
              inherits_role
            </div>
            <Separator orientation="vertical" className="h-3" />
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <div className="w-3 h-3 rounded bg-primary/15 border border-primary/30" />
              Role
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <div className="w-3 h-3 rounded-sm border border-border bg-card" />
              Permission
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <div className="w-3 h-3 rounded-full border border-dashed border-border bg-secondary/50" />
              Scope
            </div>
          </div>
        </div>

        {/* Right: Access Preview */}
        <div className="border-l border-border overflow-hidden">
          <AccessPreview
            selectedNodeId={selectedNodeId}
            nodes={nodes}
            edges={edges}
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
            scopes={scopes}
          />
        </div>
      </div>
    </Card>
  );
}
