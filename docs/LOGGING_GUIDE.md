# 📋 Sistema de Logs com DevConsole

Sistema completo de logging visual para desenvolvimento e monitoramento.

## 🚀 Como Usar

### 1. Abrir o Console Visual

Existem 2 formas:

- **Botão flutuante**: Clique no botão "Console" no canto inferior direito
- **Atalho de teclado**: Pressione `Ctrl+Shift+L`

### 2. Adicionar Logs no Código

```typescript
import { logger } from '@/lib/logger';

// Informação geral
logger.info('Usuário fez login', { userId: 123 });

// Avisos
logger.warn('API lenta: 5 segundos de resposta');

// Erros
logger.error('Falha ao salvar dados', { error });

// Debug detalhado
logger.debug('Estado do componente', { state });
```

### 3. Níveis de Log

| Nível | Quando usar | Cor |
|-------|-------------|-----|
| `error` | Erros críticos que precisam atenção | 🔴 Vermelho |
| `warn` | Avisos sobre comportamento inesperado | 🟡 Amarelo |
| `info` | Informações gerais do fluxo da aplicação | 🔵 Azul |
| `debug` | Informações detalhadas para debugging | ⚪ Cinza |

## ✨ Funcionalidades do DevConsole

- ✅ **Filtros por nível**: Filtre logs por error, warn, info ou debug
- ✅ **Expansão de dados**: Clique nos logs para ver dados JSON detalhados
- ✅ **Timestamp**: Hora exata de cada log
- ✅ **Limpeza**: Botão para limpar todos os logs
- ✅ **Limite automático**: Mantém apenas os últimos 500 logs
- ✅ **Apenas em DEV**: Console visual só aparece em desenvolvimento

## 📝 Exemplos Práticos

### Em Componentes React

```tsx
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export function MeuComponente() {
  useEffect(() => {
    logger.info('Componente montado: MeuComponente');
    return () => logger.debug('Componente desmontado');
  }, []);

  const handleClick = () => {
    logger.info('Botão clicado', { timestamp: Date.now() });
  };

  return <button onClick={handleClick}>Ação</button>;
}
```

### Em Requisições API

```tsx
async function buscarUsuarios() {
  logger.info('Buscando usuários da API');
  
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    
    logger.info('Usuários carregados', { count: data.length });
    return data;
  } catch (error) {
    logger.error('Falha ao buscar usuários', { error });
    throw error;
  }
}
```

### Substituir console.log/error

```tsx
// ❌ ANTES
console.log('Dados:', data);
console.error('Erro:', error);

// ✅ DEPOIS
logger.info('Dados carregados', { data });
logger.error('Erro ao processar', { error });
```

## 🎯 Vantagens

1. **Visual e organizado**: Interface limpa com filtros e cores
2. **Persistente**: Logs ficam salvos até limpar
3. **Dados estruturados**: Visualize objetos JSON complexos
4. **Zero impacto em produção**: Console só existe em DEV
5. **Não polui o console do browser**: Console separado e organizado

## 🔧 API Programática

```typescript
import { logger } from '@/lib/logger';

// Obter todos os logs
const logs = logger.getLogs();

// Limpar logs
logger.clearLogs();

// Subscrever a mudanças (para componentes personalizados)
const unsubscribe = logger.subscribe((logs) => {
  console.log('Logs atualizados:', logs);
});

// Cancelar subscrição
unsubscribe();
```

## 📦 Arquivos Criados

- [src/lib/logger.ts](../src/lib/logger.ts) - Sistema de logging
- [src/components/shared/DevConsole.tsx](../src/components/shared/DevConsole.tsx) - Interface visual
- [src/lib/logger.example.tsx](../src/lib/logger.example.tsx) - Exemplos de uso

## 🎨 Integração

O DevConsole já está integrado no [App.tsx](../src/App.tsx) e aparece automaticamente em modo desenvolvimento.

Exemplos de uso já implementados no [AuthContext](../src/contexts/AuthContext.tsx):
- Login/logout de usuários
- Cadastro de novos usuários
- Mudanças de estado de autenticação
