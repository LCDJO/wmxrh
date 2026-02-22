/**
 * DevConsole - Console visual de logs para desenvolvimento
 * Atalho: Ctrl+Shift+L para abrir/fechar
 */
import { useEffect, useState } from 'react';
import { logger, LogEntry, LogLevel } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Terminal, 
  X, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug
} from 'lucide-react';

const isDev = import.meta.env.DEV;

export function DevConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Atalho de teclado: Ctrl+Shift+L
  useEffect(() => {
    if (!isDev) return;

    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  // Subscrever aos logs
  useEffect(() => {
    if (!isDev) return;
    const unsubscribe = logger.subscribe(setLogs);
    return () => {
      unsubscribe();
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  const getLogIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'warn': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      case 'debug': return <Bug className="h-4 w-4" />;
    }
  };

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'debug': return 'text-gray-500';
    }
  };

  const getLevelBadgeVariant = (level: LogLevel): "default" | "destructive" | "outline" | "secondary" => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'outline';
      case 'info': return 'default';
      case 'debug': return 'secondary';
    }
  };

  if (!isDev) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          size="sm"
          variant="outline"
          className="fixed bottom-4 right-4 z-50 shadow-lg gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Terminal className="h-4 w-4" />
          Console ({logs.length})
        </Button>
      )}

      {/* Console Panel */}
      {isOpen && (
        <Card className="fixed bottom-4 right-4 z-50 w-[600px] h-[500px] shadow-2xl border-2 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              <h3 className="font-semibold text-sm">DevConsole</h3>
              <Badge variant="secondary" className="text-xs">
                {filteredLogs.length} logs
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => logger.clearLogs()}
                className="h-7"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsOpen(false)}
                className="h-7"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 p-2 border-b bg-muted/30">
            {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => (
              <Button
                key={level}
                size="sm"
                variant={filter === level ? 'default' : 'ghost'}
                onClick={() => setFilter(level)}
                className="h-7 text-xs"
              >
                {level}
                {level !== 'all' && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {logs.filter(l => l.level === level).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Logs */}
          <ScrollArea className="flex-1 p-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                Nenhum log ainda
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map(log => {
                  const isExpanded = expandedIds.has(log.id);
                  return (
                    <div
                      key={log.id}
                      className="border rounded-md p-2 hover:bg-muted/50 transition-colors"
                    >
                      <div 
                        className="flex items-start gap-2 cursor-pointer"
                        onClick={() => log.data !== undefined && toggleExpand(log.id)}
                      >
                        {log.data !== undefined && (
                          <div className="mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </div>
                        )}
                        <div className={`mt-0.5 ${getLogColor(log.level)}`}>
                          {getLogIcon(log.level)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={getLevelBadgeVariant(log.level)} className="h-4 text-[10px] px-1.5">
                              {log.level}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1 break-words">{log.message}</p>
                          {isExpanded && log.data !== undefined && (
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.data as Record<string, unknown>, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-2 bg-muted/30 text-[10px] text-muted-foreground text-center">
            Pressione <kbd className="px-1 bg-background border rounded">Ctrl+Shift+L</kbd> para abrir/fechar
          </div>
        </Card>
      )}
    </>
  );
}
