import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Smile, Paperclip, X } from 'lucide-react';
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
}

export default function QuickReplyBox({
  onSend,
  disabled,
  isClosed,
  sessionId,
  userId,
}: QuickReplyBoxProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isClosed) {
    return (
      <div className="px-4 py-3 bg-muted/50 text-center border-t border-border">
        <p className="text-xs text-muted-foreground">Esta conversa foi encerrada</p>
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

      if (error) {
        toast.error(`Erro ao enviar ${pf.file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);

      uploaded.push({
        name: pf.file.name,
        url: urlData.publicUrl,
        type: pf.file.type,
      });
    }

    return uploaded;
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingFiles.length) || disabled) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      const attachments = await uploadFiles();
      await onSend(text || (attachments.length > 0 ? `📎 ${attachments.length} anexo(s)` : ''), attachments.length > 0 ? attachments : undefined);
      // Clean up previews
      pendingFiles.forEach((pf) => pf.preview && URL.revokeObjectURL(pf.preview));
      setPendingFiles([]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="border-t border-border bg-card shrink-0">
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="relative shrink-0 group">
              {pf.preview ? (
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="h-14 w-14 object-cover rounded-lg border border-border"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg border border-border bg-muted flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground text-center px-1 truncate">
                    {pf.file.name.split('.').pop()?.toUpperCase()}
                  </span>
                </div>
              )}
              <button
                onClick={() => removePending(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0 h-9 w-9">
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
          className="text-muted-foreground shrink-0 h-9 w-9"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Input
          ref={inputRef}
          placeholder="Digite uma mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
          disabled={disabled || sending}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || (!input.trim() && !pendingFiles.length)}
          className="rounded-full h-9 w-9 shrink-0"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
