import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Smile, Paperclip, X, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendingFile {
  file: File;
  preview?: string;
}

interface QuickReplyBoxProps {
  onSend: (text: string, attachments?: Array<{ name: string; url: string; type: string }>) => Promise<void>;
  disabled?: boolean;
  isClosed?: boolean;
  sessionId?: string;
  userId: string;
  onTyping?: () => void;
}

export default function QuickReplyBox({
  onSend,
  disabled,
  isClosed,
  sessionId,
  userId,
  onTyping,
}: QuickReplyBoxProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  if (isClosed) {
    return (
      <div className="px-4 py-4 bg-muted/30 text-center border-t border-border">
        <p className="text-xs text-muted-foreground">🔒 Esta conversa foi encerrada</p>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newPending = files.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => {
      const removed = prev[idx];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadFiles = async (): Promise<Array<{ name: string; url: string; type: string }>> => {
    if (!pendingFiles.length || !sessionId) return [];
    const uploaded: Array<{ name: string; url: string; type: string }> = [];
    for (const pf of pendingFiles) {
      const ext = pf.file.name.split('.').pop() ?? 'bin';
      const path = `${userId}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from('chat-attachments')
        .upload(path, pf.file, { contentType: pf.file.type });
      if (error) { toast.error(`Erro ao enviar ${pf.file.name}`); continue; }
      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      uploaded.push({ name: pf.file.name, url: urlData.publicUrl, type: pf.file.type });
    }
    return uploaded;
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingFiles.length) || disabled) return;
    const text = input.trim();
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    setSending(true);
    try {
      const attachments = await uploadFiles();
      await onSend(text || (attachments.length > 0 ? `📎 ${attachments.length} anexo(s)` : ''), attachments.length > 0 ? attachments : undefined);
      pendingFiles.forEach((pf) => pf.preview && URL.revokeObjectURL(pf.preview));
      setPendingFiles([]);
    } catch { setInput(text); }
    finally { setSending(false); textareaRef.current?.focus(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-card shrink-0">
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="relative shrink-0 group animate-in fade-in zoom-in-90 duration-200">
              {pf.preview ? (
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="h-16 w-16 object-cover rounded-xl border border-border shadow-sm"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-border bg-muted flex flex-col items-center justify-center gap-0.5">
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {pf.file.name.split('.').pop()?.toUpperCase()}
                  </span>
                  <span className="text-[8px] text-muted-foreground/60 truncate max-w-[50px]">
                    {pf.file.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removePending(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <div className="flex items-center gap-0.5 shrink-0 pb-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8 hover:text-foreground">
            <Smile className="h-5 w-5" />
          </Button>

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground h-8 w-8 hover:text-foreground"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            placeholder="Digite uma mensagem..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full resize-none rounded-2xl bg-muted/40 border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 placeholder:text-muted-foreground/50 transition-all"
            style={{ maxHeight: '120px', minHeight: '40px' }}
            disabled={disabled || sending}
          />
        </div>

        <div className="shrink-0 pb-1">
          {input.trim() || pendingFiles.length > 0 ? (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sending}
              className="rounded-full h-9 w-9 transition-transform active:scale-90"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
              disabled
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
