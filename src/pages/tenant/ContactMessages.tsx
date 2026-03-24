import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Eye, Trash2, Search, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: string;
  notes: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "Nova", variant: "default" },
  read: { label: "Lida", variant: "secondary" },
  replied: { label: "Respondida", variant: "outline" },
  archived: { label: "Arquivada", variant: "destructive" },
};

export default function ContactMessages() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [notes, setNotes] = useState("");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["contact_messages", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContactMessage[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("contact_messages")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact_messages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_messages"] });
      toast.success("Mensagem excluída");
    },
  });

  const openMessage = (msg: ContactMessage) => {
    setSelected(msg);
    setNotes(msg.notes ?? "");
    if (msg.status === "new") {
      updateMutation.mutate({ id: msg.id, updates: { status: "read", read_at: new Date().toISOString() } });
    }
  };

  const saveNotes = () => {
    if (!selected) return;
    updateMutation.mutate(
      { id: selected.id, updates: { notes } },
      { onSuccess: () => toast.success("Notas salvas") },
    );
  };

  const changeStatus = (status: string) => {
    if (!selected) return;
    updateMutation.mutate(
      { id: selected.id, updates: { status } },
      { onSuccess: () => { setSelected(prev => prev ? { ...prev, status } : null); toast.success("Status atualizado"); } },
    );
  };

  const filtered = messages.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s) || m.message.toLowerCase().includes(s);
  });

  const counts = messages.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Mensagens de Contato
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todas as mensagens recebidas pelo formulário de contato
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <Badge key={key} variant="outline" className="gap-1">
              {label}: {counts[key] || 0}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email ou mensagem..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, { label }]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma mensagem encontrada</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(msg => {
                const st = STATUS_LABELS[msg.status] ?? { label: msg.status, variant: "outline" as const };
                return (
                  <TableRow key={msg.id} className={msg.status === "new" ? "font-medium" : ""}>
                    <TableCell>{msg.name}</TableCell>
                    <TableCell className="text-muted-foreground">{msg.email}</TableCell>
                    <TableCell className="text-muted-foreground">{msg.company || "—"}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openMessage(msg)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(msg)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mensagem de {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">E-mail:</span>
                  <p className="font-medium">{selected.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">{selected.company || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Enviado em:</span>
                  <p className="font-medium">{format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Select value={selected.status} onValueChange={changeStatus}>
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, { label }]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Mensagem:</span>
                <div className="mt-1 rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Notas internas:</span>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Adicione notas sobre esta mensagem..." rows={3} />
                <Button size="sm" onClick={saveNotes} disabled={updateMutation.isPending}>
                  Salvar notas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem de {deleteTarget?.name} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
