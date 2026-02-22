/**
 * PlatformCore — Fachada unificada do sistema de Module Federation.
 *
 * Compõe e orquestra todos os subsistemas de federação em uma única API:
 *
 *   PlatformCore
 *    ├── ModuleRegistry          (catálogo & armazenamento de módulos)
 *    ├── ModuleLoader            (lazy-loading dinâmico via React.lazy)
 *    ├── ModuleSandbox           (contextos de execução isolados)
 *    ├── ModuleLifecycleManager  (máquina de estados, grafo de dependências)
 *    ├── ModulePermissionAdapter (bridge de segurança, scoping por tenant)
 *    ├── WidgetRegistry          (sistema de widgets para dashboard)
 *    └── FeatureFlagBridge       (sync módulo → feature flags)
 *
 * Padrão: Composite + Facade — delega para subsistemas especializados
 * enquanto expõe uma interface coesa para consumidores.
 *
 * Fluxo de registro de módulo (register):
 *   1. Registra no ModuleRegistry (catálogo)
 *   2. Se manifest fornecido:
 *      a. Registra manifest no ModuleLoader (lazy-loading)
 *      b. Registra permissões no PermissionAdapter
 *      c. Registra widgets no WidgetRegistry
 *      d. Registra feature flags no FeatureFlagBridge
 *   3. Cria sandbox isolado no SandboxManager
 *   4. Emite evento `platform:module_federated`
 *
 * Fluxo de boot (registerAll):
 *   1. Itera MODULE_FEDERATION_MAP (todas as definições de módulo)
 *   2. Chama register() para cada um
 *   3. Emite `platform:all_modules_registered` com contagem final
 *
 * Decisões de design:
 *   - FeatureFlagBridge aceita um stub quando FeatureLifecycleAPI não está disponível.
 *     Isso permite testes unitários sem dependência do sistema de feature flags real.
 *   - O deactivate() também destrói o sandbox, garantindo cleanup completo.
 *   - O unregister() remove widgets antes do sandbox para evitar referências órfãs.
 *
 * @see MODULE_FEDERATION_MAP — definições estáticas de módulos (module-definitions.ts)
 * @see ModuleManifest — contrato declarativo de cada módulo federado
 */

import type { GlobalEventKernelAPI, ModuleRegistration, ModuleDescriptor, FeatureLifecycleAPI } from '../types';
import { MODULE_FEDERATION_MAP } from './module-definitions';
import { createModuleRegistry, type ModuleRegistryAPI } from './module-registry';
import { createModuleLoader, type ModuleLoaderAPI, type ModuleManifest, type ModuleWidget, type ModuleNavigationEntry, type ModuleLoadContext } from './module-loader';
import { createModuleSandbox, type ModuleSandboxAPI, type SandboxContext } from './module-sandbox';
import { createModuleLifecycleManager, type ModuleLifecycleManagerAPI } from './module-lifecycle-manager';
import { createModulePermissionAdapter, type ModulePermissionAdapterAPI, type PermissionContext } from './module-permission-adapter';
import { createWidgetRegistry, type WidgetRegistryAPI, type WidgetRegistration, type WidgetRenderContext, type WidgetContext, type ResolvedWidget } from './widget-registry';
import { createModuleFeatureFlagBridge, type ModuleFeatureFlagBridgeAPI, type ModuleFeatureFlagDeclaration } from './module-feature-flag-bridge';

/**
 * API pública do PlatformCore.
 *
 * Organizada por responsabilidade:
 *   - Registry: CRUD de módulos
 *   - Lifecycle: ativação/desativação com dependências
 *   - Loader: lazy-loading e resolução contextual
 *   - Sandbox: isolamento de execução
 *   - Permissions: controle de acesso por módulo
 *   - Tenant Scoping: habilitação/desabilitação por tenant
 *   - Widgets: registro e resolução de widgets
 *   - Feature Flags: gerenciamento de flags por módulo
 */
export interface PlatformCoreAPI {
  // ── Registry ───────────────────────────────────────────────
  /** Registra um módulo (e opcionalmente seu manifest) */
  register(mod: ModuleRegistration, manifest?: ModuleManifest): void;
  /** Remove um módulo e todos os seus artefatos (widgets, sandbox, etc.) */
  unregister(key: string): void;
  /** Busca um módulo pelo key (null se não encontrado) */
  get(key: string): ModuleDescriptor | null;
  /** Lista todos os módulos registrados */
  list(): ModuleDescriptor[];
  /** Lista apenas módulos com status 'active' */
  listActive(): ModuleDescriptor[];

  // ── Lifecycle ──────────────────────────────────────────────
  /** Ativa um módulo (requer dependências já ativas) */
  activate(key: string): Promise<void>;
  /** Desativa um módulo (requer que nenhum dependente esteja ativo) */
  deactivate(key: string): Promise<void>;
  /** Ativa um módulo e todas as suas dependências recursivamente */
  activateWithDeps(key: string): Promise<void>;
  /** Desativa um módulo e todos os seus dependentes recursivamente */
  deactivateWithDeps(key: string): Promise<void>;
  /** Ativa apenas se ainda não estiver ativo (idempotente) */
  activateIfNeeded(key: string): Promise<void>;
  /** Retorna o grafo de dependências como lista de adjacência */
  dependencyGraph(): Record<string, string[]>;
  /** Retorna a ordem topológica de ativação para um módulo */
  activationOrder(key: string): string[];

  // ── Loader ─────────────────────────────────────────────────
  /** Obtém React.lazy wrapper para o componente raiz de um módulo */
  getComponent(key: string): React.LazyExoticComponent<React.ComponentType<any>> | null;
  /** Pré-carrega o bundle JS de um módulo sem montar */
  preloadModule(key: string): Promise<void>;
  /** Obtém o manifest completo de um módulo */
  getManifest(key: string): ModuleManifest | null;
  /** Resolve quais módulos devem ser carregados para um contexto */
  resolveForContext(ctx: ModuleLoadContext): ModuleManifest[];
  /** Resolve widgets de um slot para um contexto */
  resolveWidgets(slot: ModuleWidget['slot'], ctx: ModuleLoadContext): ModuleWidget[];
  /** Resolve entradas de navegação para um contexto */
  resolveNavigation(ctx: ModuleLoadContext): ModuleNavigationEntry[];
  /** Registra todos os módulos do MODULE_FEDERATION_MAP de uma vez */
  registerAll(): void;

  // ── Sandbox ────────────────────────────────────────────────
  /** Obtém (ou cria) o sandbox isolado de um módulo */
  sandbox(key: string): SandboxContext;
  /** Destrói o sandbox de um módulo */
  destroySandbox(key: string): void;

  // ── Permissions ────────────────────────────────────────────
  /** Verifica se um contexto pode ativar um módulo */
  canActivate(key: string, ctx: PermissionContext): boolean;
  /** Verifica se um contexto pode acessar um módulo (ativo + permissões) */
  canAccess(key: string, ctx: PermissionContext): boolean;
  /** Lista permissões que faltam para acessar um módulo */
  missingPermissions(key: string, ctx: PermissionContext): string[];
  /** Filtra lista de módulos mantendo apenas os acessíveis */
  filterAccessible(modules: ModuleDescriptor[], ctx: PermissionContext): ModuleDescriptor[];

  // ── Tenant Scoping ─────────────────────────────────────────
  /** Verifica se módulo está habilitado para um tenant */
  isEnabledForTenant(key: string, tenantId: string): boolean;
  /** Habilita módulo para um tenant específico */
  enableForTenant(key: string, tenantId: string): void;
  /** Desabilita módulo para um tenant específico */
  disableForTenant(key: string, tenantId: string): void;
  /** Lista módulos disponíveis para um tenant */
  listForTenant(tenantId: string): ModuleDescriptor[];

  // ── Widgets ────────────────────────────────────────────────
  /** Registra um widget avulso (fora de manifest) */
  registerWidget(widget: WidgetRegistration): void;
  /** Resolve widgets para um contexto de renderização */
  resolveWidgetsForContext(context: WidgetContext, renderCtx: WidgetRenderContext): ResolvedWidget[];

  // ── Feature Flags ──────────────────────────────────────────
  /** Registra declarações de feature flags para um módulo */
  registerModuleFlags(moduleId: string, declarations: ModuleFeatureFlagDeclaration[]): void;
  /** Verifica se uma feature flag está ativa */
  isFeatureEnabled(flag: string, ctx?: { tenantId?: string }): boolean;

  // ── Sub-systems (para uso avançado e testes) ───────────────
  readonly registry: ModuleRegistryAPI;
  readonly loader: ModuleLoaderAPI;
  readonly sandboxManager: ModuleSandboxAPI;
  readonly lifecycle: ModuleLifecycleManagerAPI;
  readonly permissions: ModulePermissionAdapterAPI;
  readonly widgets: WidgetRegistryAPI;
  readonly featureFlags: ModuleFeatureFlagBridgeAPI;
}

/**
 * Factory function que cria uma instância do PlatformCore.
 *
 * @param events          - API do Global Event Kernel para emissão/subscrição de eventos
 * @param featureLifecycle - API do sistema de feature flags (opcional, usa stub se ausente)
 * @returns Instância completa do PlatformCoreAPI
 */
export function createPlatformCore(
  events: GlobalEventKernelAPI,
  featureLifecycle?: FeatureLifecycleAPI,
): PlatformCoreAPI {
  // Inicializar todos os subsistemas com o event kernel compartilhado
  const registry = createModuleRegistry(events);
  const loader = createModuleLoader(events);
  const sandboxManager = createModuleSandbox(events);
  const lifecycle = createModuleLifecycleManager(registry, events);
  const permissions = createModulePermissionAdapter(registry, events);
  const widgetRegistry = createWidgetRegistry(events);

  // FeatureFlagBridge precisa de FeatureLifecycleAPI — usar stub se não fornecido.
  // O stub retorna `false` para todas as flags, garantindo comportamento seguro por padrão.
  const featureStub: FeatureLifecycleAPI = featureLifecycle ?? {
    register: () => {},
    isEnabled: () => false,
    toggle: () => {},
    transitionPhase: () => {},
    list: () => [],
    getPhase: () => null,
    get: () => null,
    listSunsetting: () => [],
    enableForTenant: () => {},
    disableForTenant: () => {},
  };
  const featureFlagBridge = createModuleFeatureFlagBridge(featureStub, events);

  // ── Composed API ─────────────────────────────────────────────

  /**
   * Registra um módulo completo: catálogo + manifest + sandbox.
   * Se manifest fornecido, também registra permissões, widgets e feature flags.
   */
  function register(mod: ModuleRegistration, manifest?: ModuleManifest): void {
    registry.register(mod);
    if (manifest) {
      loader.registerManifest(manifest);
      permissions.registerModulePermissions(manifest);
      widgetRegistry.registerFromManifest(manifest);
      featureFlagBridge.registerFromManifest(manifest);
    }
    sandboxManager.create(mod.key as string);
    events.emit('platform:module_federated', 'PlatformCore', { key: mod.key });
  }

  /**
   * Remove um módulo e limpa todos os artefatos associados.
   * Ordem: widgets → sandbox → registry (para evitar referências pendentes).
   */
  function unregister(key: string): void {
    const moduleWidgets = widgetRegistry.listWidgetsForModule(key);
    for (const w of moduleWidgets) widgetRegistry.unregisterWidget(w.widget_id);
    sandboxManager.destroy(key);
    registry.unregister(key);
  }

  /** Ativa módulo delegando ao lifecycle manager */
  async function activate(key: string): Promise<void> {
    await lifecycle.activate(key);
  }

  /** Desativa módulo e destrói seu sandbox */
  async function deactivate(key: string): Promise<void> {
    await lifecycle.deactivate(key);
    sandboxManager.destroy(key);
  }

  return {
    register,
    unregister,
    get: (key) => registry.get(key),
    list: () => registry.list(),
    listActive: () => lifecycle.listActive(),

    activate,
    deactivate,
    activateWithDeps: (key) => lifecycle.activateWithDeps(key),
    deactivateWithDeps: (key) => lifecycle.deactivateWithDeps(key),
    activateIfNeeded: (key) => lifecycle.activateIfNeeded(key),
    dependencyGraph: () => lifecycle.dependencyGraph(),
    activationOrder: (key) => lifecycle.activationOrder(key),

    getComponent: (key) => loader.getComponent(key),
    preloadModule: (key) => loader.preload(key),
    getManifest: (key) => loader.getManifest(key),
    resolveForContext: (ctx) => loader.resolveForContext(ctx, (k, t) => permissions.isEnabledForTenant(k, t)),
    resolveWidgets: (slot, ctx) => loader.resolveWidgets(slot, ctx, (k, t) => permissions.isEnabledForTenant(k, t)),
    resolveNavigation: (ctx) => loader.resolveNavigation(ctx, (k, t) => permissions.isEnabledForTenant(k, t)),

    /**
     * Boot completo: registra todos os módulos do MODULE_FEDERATION_MAP.
     * Chamado uma vez durante a inicialização da plataforma.
     */
    registerAll() {
      for (const { registration, manifest } of MODULE_FEDERATION_MAP) {
        register(registration, manifest);
      }
      events.emit('platform:all_modules_registered', 'PlatformCore', {
        count: MODULE_FEDERATION_MAP.length,
        keys: MODULE_FEDERATION_MAP.map(m => m.registration.key),
      });
    },

    sandbox: (key) => sandboxManager.create(key),
    destroySandbox: (key) => sandboxManager.destroy(key),

    canActivate: (key, ctx) => permissions.canActivate(key, ctx),
    canAccess: (key, ctx) => permissions.canAccess(key, ctx),
    missingPermissions: (key, ctx) => permissions.missingPermissions(key, ctx),
    filterAccessible: (mods, ctx) => permissions.filterAccessible(mods, ctx),

    isEnabledForTenant: (key, tid) => permissions.isEnabledForTenant(key, tid),
    enableForTenant: (key, tid) => permissions.enableForTenant(key, tid),
    disableForTenant: (key, tid) => permissions.disableForTenant(key, tid),
    listForTenant: (tid) => permissions.listForTenant(tid),

    registerWidget: (w) => widgetRegistry.registerWidget(w),
    resolveWidgetsForContext: (ctx, renderCtx) => widgetRegistry.resolveWidgets(ctx, renderCtx),

    registerModuleFlags: (moduleId, decls) => featureFlagBridge.registerModuleFlags(moduleId, decls),
    isFeatureEnabled: (flag, ctx) => featureFlagBridge.isEnabled(flag, ctx),

    // Subsistemas expostos para uso avançado (testes, debugging, extensões)
    registry,
    loader,
    sandboxManager,
    lifecycle,
    permissions,
    widgets: widgetRegistry,
    featureFlags: featureFlagBridge,
  };
}
