import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildWhatsAppSupportLink, SUPPORT_PHONE_DISPLAY } from "@/lib/support";
import { MessageCircle, Phone, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";

export default function PremiumSupport() {
  const [storeName, setStoreName] = useState("");
  const [subject, setSubject] = useState("Acompanhamento consultivo");
  const [details, setDetails] = useState("");
  const [bestTime, setBestTime] = useState("");

  const priorityMessage = useMemo(() => {
    const name = storeName.trim() || "Minha loja";
    return `Olá! Sou lojista da ${name} e preciso de suporte prioritário no Pede Fácil.`;
  }, [storeName]);

  const consultiveMessage = useMemo(() => {
    const name = storeName.trim() || "Minha loja";
    const when = bestTime.trim() || "Sem horário definido";
    const context = details.trim() || "Sem detalhes adicionais";
    return `Olá! Sou lojista da ${name} e quero acompanhamento consultivo.\n\nTema: ${subject}\nMelhor horário: ${when}\nDetalhes: ${context}`;
  }, [bestTime, details, storeName, subject]);

  const openSupport = (message: string) => {
    window.open(buildWhatsAppSupportLink(message), "_blank", "noopener,noreferrer");
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE_DISPLAY);
      toast.success("Contato de suporte copiado.");
    } catch {
      toast.error("Não rolou copiar agora.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Badge className="rounded-full px-3 py-1">
          <Star className="h-3.5 w-3.5 mr-1" />
          Premium
        </Badge>
        <h1 className="text-3xl font-black">Suporte prioritário</h1>
        <p className="text-muted-foreground">
          Canal direto para suporte da sua operação e acompanhamento consultivo no WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Atendimento prioritário
            </CardTitle>
            <CardDescription>
              Abra uma conversa com o suporte Premium e já entre com contexto da sua loja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeNamePriority">Nome da loja</Label>
              <Input
                id="storeNamePriority"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="Ex.: Açaí da Vila"
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Contato oficial</p>
              <p className="font-semibold mt-1">{SUPPORT_PHONE_DISPLAY}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openSupport(priorityMessage)}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Chamar no WhatsApp
              </Button>
              <Button variant="outline" onClick={copyPhone}>
                <Phone className="h-4 w-4 mr-2" />
                Copiar contato
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Acompanhamento consultivo
            </CardTitle>
            <CardDescription>
              Envie um briefing rápido e abra o atendimento consultivo com mensagem estruturada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Tema principal</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ex.: Conversão no checkout"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bestTime">Melhor horário para contato</Label>
              <Input
                id="bestTime"
                value={bestTime}
                onChange={(event) => setBestTime(event.target.value)}
                placeholder="Ex.: Segunda a sexta, 14h às 18h"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Contexto</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Explique o que você quer melhorar e onde está travando."
                className="min-h-[110px]"
              />
            </div>

            <Button onClick={() => openSupport(consultiveMessage)} className="w-full">
              <MessageCircle className="h-4 w-4 mr-2" />
              Iniciar acompanhamento consultivo
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
