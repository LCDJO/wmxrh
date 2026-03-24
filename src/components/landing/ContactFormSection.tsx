import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  company: z.string().trim().max(100).optional(),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000),
});

export function ContactFormSection() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: result.data.name,
        email: result.data.email,
        company: result.data.company || null,
        message: result.data.message,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Mensagem enviada com sucesso!");
    } catch {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (submitted) {
    return (
      <section id="contato" className="py-24 px-6 bg-muted/30">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Mensagem enviada!</h2>
          <p className="text-muted-foreground">
            Obrigado pelo contato. Nossa equipe responderá em breve.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", company: "", message: "" }); }}>
            Enviar outra mensagem
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section id="contato" className="py-24 px-6 bg-muted/30">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 space-y-3">
          <Badge variant="outline">Contato</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Fale com nossa equipe</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Tem dúvidas ou quer saber mais? Preencha o formulário e entraremos em contato.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 md:p-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome *</label>
              <Input placeholder="Seu nome completo" value={form.name} onChange={update("name")} maxLength={100} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">E-mail *</label>
              <Input type="email" placeholder="seu@email.com" value={form.email} onChange={update("email")} maxLength={255} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Empresa</label>
            <Input placeholder="Nome da sua empresa (opcional)" value={form.company} onChange={update("company")} maxLength={100} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Mensagem *</label>
            <Textarea
              placeholder="Como podemos ajudá-lo?"
              value={form.message}
              onChange={update("message")}
              rows={5}
              maxLength={2000}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar mensagem
          </Button>
        </form>
      </div>
    </section>
  );
}
