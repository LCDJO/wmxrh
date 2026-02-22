/**
 * EXEMPLO DE USO DO LOGGER
 * 
 * O logger captura automaticamente todos os logs e os exibe no DevConsole.
 * 
 * Para abrir o console visual:
 * - Clique no botão "Console" no canto inferior direito
 * - Ou pressione Ctrl+Shift+L
 */

import { logger } from '@/lib/logger';
import { useEffect } from 'react';

// ═══════════════════════════════════════════════════════════
// EXEMPLO 1: Em qualquer função
// ═══════════════════════════════════════════════════════════

export function minhaFuncao() {
  logger.info('Função iniciada');
  
  try {
    // Seu código aqui
    const resultado = calcularAlgo();
    logger.debug('Cálculo realizado', { resultado });
    return resultado;
  } catch (error) {
    logger.error('Erro ao calcular', { error });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// EXEMPLO 2: Em requisições API
// ═══════════════════════════════════════════════════════════

export async function buscarDados() {
  logger.info('Iniciando busca de dados');
  
  try {
    const response = await fetch('/api/dados');
    const data = await response.json();
    
    logger.info('Dados recebidos com sucesso', { 
      count: data.length,
      timestamp: new Date() 
    });
    
    return data;
  } catch (error) {
    logger.error('Falha ao buscar dados', { 
      error,
      url: '/api/dados' 
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// EXEMPLO 3: Em event handlers
// ═══════════════════════════════════════════════════════════

export function handleSubmit(formData: FormData) {
  logger.info('Formulário enviado', { 
    fields: Object.fromEntries(formData.entries()) 
  });
  
  // Validação
  if (!formData.get('email')) {
    logger.warn('Email não fornecido no formulário');
    return false;
  }
  
  // Processamento
  try {
    processarFormulario(formData);
    logger.info('Formulário processado com sucesso');
    return true;
  } catch (error) {
    logger.error('Erro ao processar formulário', { error });
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// EXEMPLO 4: Em componentes React
// ═══════════════════════════════════════════════════════════

export function MeuComponente() {
  useEffect(() => {
    logger.info('Componente montado: MeuComponente');
    
    return () => {
      logger.debug('Componente desmontado: MeuComponente');
    };
  }, []);
  
  const handleClick = () => {
    logger.info('Botão clicado', { 
      component: 'MeuComponente',
      timestamp: Date.now() 
    });
  };
  
  return <button onClick={handleClick}>Clique aqui</button>;
}

// ═══════════════════════════════════════════════════════════
// EXEMPLO 5: Substituir console.log/error existentes
// ═══════════════════════════════════════════════════════════

// ANTES:
// console.log('Usuário logado:', user);
// console.error('Erro:', error);

// DEPOIS:
// logger.info('Usuário logado', { user });
// logger.error('Erro ao fazer login', { error });

// ═══════════════════════════════════════════════════════════
// NÍVEIS DE LOG DISPONÍVEIS
// ═══════════════════════════════════════════════════════════

export function exemploNiveis() {
  // ERROR - Erros críticos que precisam atenção
  logger.error('Falha na autenticação', { userId: 123 });
  
  // WARN - Avisos sobre comportamento inesperado
  logger.warn('API lenta, levou 5s para responder');
  
  // INFO - Informações gerais sobre o fluxo da aplicação
  logger.info('Usuário navegou para dashboard');
  
  // DEBUG - Informações detalhadas para debugging
  logger.debug('Estado atual', { state: { count: 5 } });
}

// ═══════════════════════════════════════════════════════════
// CONTROLE PROGRAMÁTICO
// ═══════════════════════════════════════════════════════════

export function exemploControle() {
  // Obter todos os logs
  const todosLogs = logger.getLogs();
  console.log('Total de logs:', todosLogs.length);
  
  // Limpar todos os logs
  logger.clearLogs();
  
  // Subscrever para mudanças (em componentes React)
  const unsubscribe = logger.subscribe((logs) => {
    console.log('Logs atualizados:', logs.length);
  });
  
  // Depois, quando não precisar mais
  unsubscribe();
}

// Helpers dummy
function calcularAlgo() { return 42; }
function processarFormulario(data: FormData) { console.log(data); }
