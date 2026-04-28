import { ExternalLink, LifeBuoy, MessageCircleMore, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildWhatsAppSupportLink, SUPPORT_PHONE_DISPLAY } from "@/lib/support";

type HelpTopic = {
  title: string;
  description: string;
};

type HelpCenterCardProps = {
  title?: string;
  description?: string;
  supportMessage: string;
  topics?: HelpTopic[];
};

export default function HelpCenterCard({
  title = "Central de ajuda rápida",
  description = "Atalhos objetivos para resolver bloqueio de operação sem caçar resposta no escuro.",
  supportMessage,
  topics = [],
}: HelpCenterCardProps) {
  const supportHref = buildWhatsAppSupportLink(supportMessage);

  return (
    <Card className="border-zinc-200 bg-white shadow-[0_20px_70px_-55px_rgba(0,0,0,0.45)]">
      <CardHeader>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
          <LifeBuoy className="h-3.5 w-3.5 text-orange-500" />
          Ajuda real
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topics.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {topics.map((topic) => (
              <div key={topic.title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="font-semibold">{topic.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-700" />
            <div>
              <p className="font-semibold">Suporte oficial</p>
              <p className="mt-1">WhatsApp: {SUPPORT_PHONE_DISPLAY}</p>
            </div>
          </div>
        </div>

        <a href={supportHref} target="_blank" rel="noreferrer" className="inline-block">
          <Button className="rounded-full bg-zinc-900 text-zinc-100 hover:bg-zinc-800">
            <MessageCircleMore className="mr-2 h-4 w-4" />
            Falar com suporte agora
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
