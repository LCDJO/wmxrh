import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CognitiveIntent, CognitiveResponse } from "./platform-cognitive.types";
import { useToast } from "@/hooks/use-toast";

export function usePlatformCognitive() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CognitiveResponse | null>(null);
  const { toast } = useToast();

  const ask = useCallback(async (intent: CognitiveIntent, context?: Record<string, unknown>) => {
    setLoading(true);
    setResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke("platform-cognitive", {
        body: { intent, context },
      });

      if (error) {
        const msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
        throw new Error(msg);
      }

      if (data?.error) {
        toast({ title: "Cognitive Layer", description: data.error, variant: "destructive" });
        return null;
      }

      setResponse(data as CognitiveResponse);
      return data as CognitiveResponse;
    } catch (e: any) {
      console.error("Cognitive error:", e);
      toast({ title: "Erro", description: e.message ?? "Falha ao obter sugestões", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const clear = useCallback(() => setResponse(null), []);

  return { ask, loading, response, clear };
}
