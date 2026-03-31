import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { logAuditEvent } from "@/lib/observability";
import { toast } from "sonner";
import { Bot, MessageCircle, Save } from "lucide-react";

const templateDefinitions = [
  { key: "new_order", label: "Pedido novo", helper: "Dispara quando um pedido é criado." },
  { key: "status_confirmed", label: "Status: confirmado", helper: "Dispara quando o pedido é confirmado." },
  { key: "status_in_preparation", label: "Status: em preparo", helper: "Dispara quando o pedido entra em preparo." },
  { key: "status_ready", label: "Status: pronto", helper: "Dispara quando o pedido fica pronto." },
  { key: "delivery_accepted_by_driver", label: "Entregador aceitou", helper: "Dispara quando um entregador aceita a corrida." },
  { key: "delivery_out_for_delivery", label: "Saiu para entrega", helper: "Dispara quando o entregador sai para rota." },
  { key: "status_delivered", label: "Status: entregue", helper: "Dispara quando o pedido é finalizado." },
  { key: "status_cancelled", label: "Status: cancelado", helper: "Dispara quando o pedido é cancelado." },
  { key: "out_of_hours", label: "Fora do horário", helper: "Mensagem para respostas fora do expediente." },
] as const;

type TemplateKey = (typeof templateDefinitions)[number]["key"];

interface AutomationSettingsForm {
  isEnabled: boolean;
  providerName: string;
  webhookUrl: string;
  webhookSecret: string;
  sendOnNewOrder: boolean;
  sendOnStatusChange: boolean;
  sendOutOfHours: boolean;
  outOfHoursMessage: string;
}

export default function Automations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [settingsForm, setSettingsForm] = useState<AutomationSettingsForm>({
    isEnabled: false,
    providerName: "webhook",
    webhookUrl: "",
    webhookSecret: "",
    sendOnNewOrder: true,
    sendOnStatusChange: true,
    sendOutOfHours: false,
    outOfHoursMessage: "",
  });

  const [templatesForm, setTemplatesForm] = useState<Record<TemplateKey, { text: string; isActive: boolean }>>({
    new_order: { text: "", isActive: true },
    status_confirmed: { text: "", isActive: true },
    status_in_preparation: { text: "", isActive: true },
    status_ready: { text: "", isActive: true },
    delivery_accepted_by_driver: { text: "", isActive: true },
    delivery_out_for_delivery: { text: "", isActive: true },
    status_delivered: { text: "", isActive: true },
    status_cancelled: { text: "", isActive: true },
    out_of_hours: { text: "", isActive: true },
  });

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["whatsapp-automation-settings", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_automation_settings")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!establishment,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-automation-templates", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_message_templates")
        .select("*")
        .eq("establishment_id", establishment!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["whatsapp-automation-events", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_automation_events")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  useEffect(() => {
    if (!settings) return;

    setSettingsForm({
      isEnabled: !!settings.is_enabled,
      providerName: settings.provider_name || "webhook",
      webhookUrl: settings.webhook_url || "",
      webhookSecret: settings.webhook_secret || "",
      sendOnNewOrder: !!settings.send_on_new_order,
      sendOnStatusChange: !!settings.send_on_status_change,
      sendOutOfHours: !!settings.send_out_of_hours,
      outOfHoursMessage: settings.out_of_hours_message || "",
    });
  }, [settings]);

  useEffect(() => {
    if (!templates.length) return;

    const next = { ...templatesForm };
    for (const row of templates as any[]) {
      const key = row.event_key as TemplateKey;
      if (!next[key]) continue;
      next[key] = { text: row.template_text || "", isActive: !!row.is_active };
    }
    setTemplatesForm(next);
  }, [templates]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!establishment) throw new Error("Configure sua loja primeiro.");

      const payload = {
        establishment_id: establishment.id,
        is_enabled: settingsForm.isEnabled,
        provider_name: settingsForm.providerName.trim() || "webhook",
        webhook_url: settingsForm.webhookUrl.trim() || null,
        webhook_secret: settingsForm.webhookSecret.trim() || null,
        send_on_new_order: settingsForm.sendOnNewOrder,
        send_on_status_change: settingsForm.sendOnStatusChange,
        send_out_of_hours: settingsForm.sendOutOfHours,
        out_of_hours_message: settingsForm.outOfHoursMessage.trim() || null,
      };

      const { error } = await (supabase as any)
        .from("whatsapp_automation_settings")
        .upsert(payload, { onConflict: "establishment_id" });
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "store_owner",
        entityType: "establishment",
        entityId: establishment.id,
        action: "automation_settings_saved",
        metadata: {
          automationEnabled: payload.is_enabled,
          providerName: payload.provider_name,
          sendOnNewOrder: payload.send_on_new_order,
          sendOnStatusChange: payload.send_on_status_change,
          sendOutOfHours: payload.send_out_of_hours,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automation-settings"] });
      toast.success("Configurações salvas com sucesso.");
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar as configurações."),
  });

  const saveTemplatesMutation = useMutation({
    mutationFn: async () => {
      if (!establishment) throw new Error("Configure sua loja primeiro.");

      const payload = templateDefinitions.map((template) => ({
        establishment_id: establishment.id,
        event_key: template.key,
        template_text: templatesForm[template.key].text.trim(),
        is_active: templatesForm[template.key].isActive,
      }));

      const hasEmptyActiveTemplate = payload.some((row) => row.is_active && !row.template_text);
      if (hasEmptyActiveTemplate) {
        throw new Error("Preencha o texto de todos os templates ativos.");
      }

      const { error } = await (supabase as any)
        .from("whatsapp_message_templates")
        .upsert(payload, { onConflict: "establishment_id,event_key" });
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "store_owner",
        entityType: "establishment",
        entityId: establishment.id,
        action: "automation_templates_saved",
        metadata: {
          activeTemplateCount: payload.filter((row) => row.is_active).length,
          totalTemplateCount: payload.length,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automation-templates"] });
      toast.success("Templates salvos com sucesso.");
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar os templates."),
  });

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro em "Minha Loja".</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Automação WhatsApp</h1>
          <p className="text-muted-foreground">Configure disparos automáticos para pedidos e status.</p>
        </div>
        <Badge variant={settingsForm.isEnabled ? "default" : "secondary"}>
          {settingsForm.isEnabled ? "Automação ativa" : "Automação pausada"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Conexão e gatilhos
          </CardTitle>
          <CardDescription>
            A integração usa uma URL de webhook para envio. A fila de eventos é gerada automaticamente a cada pedido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Provedor</Label>
              <Input
                value={settingsForm.providerName}
                onChange={(event) => setSettingsForm((prev) => ({ ...prev, providerName: event.target.value }))}
                placeholder="webhook"
              />
            </div>
            <div>
              <Label>Webhook URL</Label>
              <Input
                value={settingsForm.webhookUrl}
                onChange={(event) => setSettingsForm((prev) => ({ ...prev, webhookUrl: event.target.value }))}
                placeholder="https://seu-endpoint.com/webhook"
              />
            </div>
          </div>

          <div>
            <Label>Webhook secret (opcional)</Label>
            <Input
              value={settingsForm.webhookSecret}
              onChange={(event) => setSettingsForm((prev) => ({ ...prev, webhookSecret: event.target.value }))}
              placeholder="Assinatura para validar requisições"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Ativar automação</p>
                <p className="text-xs text-muted-foreground">Se desligar, nada entra na fila.</p>
              </div>
              <Switch
                checked={settingsForm.isEnabled}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, isEnabled: checked }))}
              />
            </label>

            <label className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Novo pedido</p>
                <p className="text-xs text-muted-foreground">Dispara evento ao criar pedido.</p>
              </div>
              <Switch
                checked={settingsForm.sendOnNewOrder}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, sendOnNewOrder: checked }))}
              />
            </label>

            <label className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Mudança de status</p>
                <p className="text-xs text-muted-foreground">Dispara a cada novo status.</p>
              </div>
              <Switch
                checked={settingsForm.sendOnStatusChange}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, sendOnStatusChange: checked }))}
              />
            </label>

            <label className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Mensagem fora do horário</p>
                <p className="text-xs text-muted-foreground">Permite resposta automática fora do expediente.</p>
              </div>
              <Switch
                checked={settingsForm.sendOutOfHours}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, sendOutOfHours: checked }))}
              />
            </label>
          </div>

          {settingsForm.sendOutOfHours && (
            <div>
              <Label>Mensagem fora do horário</Label>
              <Textarea
                value={settingsForm.outOfHoursMessage}
                onChange={(event) => setSettingsForm((prev) => ({ ...prev, outOfHoursMessage: event.target.value }))}
                placeholder="Estamos fechados agora. Assim que abrir, te respondemos aqui."
              />
            </div>
          )}

          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveSettingsMutation.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates de mensagens</CardTitle>
          <CardDescription>
            Use variáveis como {'{order_id}'}, {'{customer_name}'}, {'{status}'} e {'{total}'} para personalizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templateDefinitions.map((template) => (
            <div key={template.key} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.helper}</p>
                </div>
                <Switch
                  checked={templatesForm[template.key].isActive}
                  onCheckedChange={(checked) =>
                    setTemplatesForm((prev) => ({
                      ...prev,
                      [template.key]: { ...prev[template.key], isActive: checked },
                    }))
                  }
                />
              </div>
              <Textarea
                value={templatesForm[template.key].text}
                onChange={(event) =>
                  setTemplatesForm((prev) => ({
                    ...prev,
                    [template.key]: { ...prev[template.key], text: event.target.value },
                  }))
                }
                placeholder="Digite o texto da mensagem"
                rows={3}
              />
            </div>
          ))}

          <Button onClick={() => saveTemplatesMutation.mutate()} disabled={saveTemplatesMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveTemplatesMutation.isPending ? "Salvando..." : "Salvar templates"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Fila de eventos (últimos 10)
          </CardTitle>
          <CardDescription>
            Aqui você acompanha os eventos que serão processados pelo seu webhook de WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento por enquanto.</p>
          ) : (
            events.map((event: any) => (
              <div key={event.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{event.event_key}</p>
                  <p className="text-xs text-muted-foreground">{event.customer_phone} • {formatDate(event.created_at)}</p>
                </div>
                <Badge variant={event.status === "failed" ? "destructive" : "secondary"}>{event.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}


