import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildWhatsAppSupportLink, SUPPORT_PHONE_DISPLAY } from "@/lib/support";
import { AlertTriangle, MessageCircle, Phone, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";

type IncidentKey = "payment_not_updated" | "order_stuck" | "delivery_late";

const INCIDENT_TEMPLATES: Record<IncidentKey, { title: string; message: string }> = {
  payment_not_updated: {
    title: "Pagou e nao caiu",
    message:
      "Preciso de suporte urgente: pagamento aprovado, mas status nao atualizou no sistema. Ja tentei revalidar e continua pendente.",
  },
  order_stuck: {
    title: "Pedido travado",
    message:
      "Preciso de ajuda: pedido travou no fluxo e nao avancou no painel. Pode verificar o status desse pedido?",
  },
  delivery_late: {
    title: "Entrega atrasada",
    message:
      "Preciso de apoio: entrega esta atrasada e cliente aguardando retorno. Quero orientacao para resolver agora.",
  },
};

export default function PremiumSupport() {
  const [storeName, setStoreName] = useState("");
  const [subject, setSubject] = useState("Ajuste de operacao");
  const [details, setDetails] = useState("");
  const [bestTime, setBestTime] = useState("");

  const priorityMessage = useMemo(() => {
    const name = storeName.trim() || "Minha loja";
    return `Ola! Sou lojista da ${name} e preciso de suporte prioritario no Pede Facil.`;
  }, [storeName]);

  const consultiveMessage = useMemo(() => {
    const name = storeName.trim() || "Minha loja";
    const when = bestTime.trim() || "Sem horario definido";
    const context = details.trim() || "Sem detalhes adicionais";
    return `Ola! Sou lojista da ${name} e quero acompanhamento consultivo.\n\nTema: ${subject}\nMelhor horario: ${when}\nDetalhes: ${context}`;
  }, [bestTime, details, storeName, subject]);

  const openSupport = (message: string) => {
    window.open(buildWhatsAppSupportLink(message), "_blank", "noopener,noreferrer");
  };

  const openIncident = (key: IncidentKey) => {
    const baseName = storeName.trim() || "Minha loja";
    const text = `Incidente: ${INCIDENT_TEMPLATES[key].title}\nLoja: ${baseName}\n\n${INCIDENT_TEMPLATES[key].message}`;
    openSupport(text);
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE_DISPLAY);
      toast.success("Contato de suporte copiado.");
    } catch {
      toast.error("Nao rolou copiar agora.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Badge className="rounded-full px-3 py-1">
          <Star className="h-3.5 w-3.5 mr-1" />
          Premium
        </Badge>
        <h1 className="text-3xl font-black">Suporte prioritario</h1>
        <p className="text-muted-foreground">
          Canal direto no WhatsApp para suporte operacional e acompanhamento da sua loja.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Atendimento prioritario
            </CardTitle>
            <CardDescription>
              Abra a conversa com contexto da sua loja e acelere o atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeNamePriority">Nome da loja</Label>
              <Input
                id="storeNamePriority"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="Ex.: Acai da Vila"
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
              Envie um briefing rapido e abra consultoria de melhoria da operacao.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Tema principal</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ex.: Conversao no checkout"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bestTime">Melhor horario para contato</Label>
              <Input
                id="bestTime"
                value={bestTime}
                onChange={(event) => setBestTime(event.target.value)}
                placeholder="Ex.: Segunda a sexta, 14h as 18h"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Contexto</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Me diga rapido o que voce quer melhorar."
                className="min-h-[110px]"
              />
            </div>

            <Button onClick={() => openSupport(consultiveMessage)} className="w-full">
              <MessageCircle className="h-4 w-4 mr-2" />
              Iniciar acompanhamento
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Playbook de incidentes
          </CardTitle>
          <CardDescription>
            Se der problema na operacao, use um botao abaixo e ja manda o chamado com texto pronto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(INCIDENT_TEMPLATES) as IncidentKey[]).map((key) => (
            <div key={key} className="rounded-xl border bg-muted/20 p-3 space-y-3">
              <p className="font-semibold">{INCIDENT_TEMPLATES[key].title}</p>
              <Button onClick={() => openIncident(key)} className="w-full" variant="outline">
                Abrir chamado
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

