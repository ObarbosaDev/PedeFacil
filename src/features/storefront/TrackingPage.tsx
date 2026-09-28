import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/app/api";

type Tracking = {
  order_number: number;
  status: string;
  fulfillment_type: string;
  estimated_minutes: number | null;
  created_at: string;
  updated_at: string;
};
const labels: Record<string, string> = {
  pending_payment: "Aguardando pagamento", received: "Pedido recebido",
  confirmed: "Pedido confirmado", in_preparation: "Em preparação",
  ready: "Pronto", out_for_delivery: "Saiu para entrega",
  delivered: "Entregue", payment_failed: "Pagamento recusado",
  cancelled_by_store: "Cancelado pela loja", cancelled_by_customer: "Cancelado",
  delivery_failed: "Falha na entrega", refunded: "Reembolsado",
};

export function TrackingPage() {
  const { token = "" } = useParams();
  const [order, setOrder] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => void api<Tracking>(`/public/orders/${encodeURIComponent(token)}`)
      .then((result) => { if (active) { setOrder(result); setError(""); } })
      .catch((failure) => { if (active) setError(failure.message); });
    load();
    const interval = window.setInterval(load, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token]);
  return <main className="tracking-page"><Link className="brand" to="/"><img src="/favicon.png" alt="" />Pede<span>Fácil</span></Link><section><span className="eyebrow">Acompanhe seu pedido</span>{error ? <><h1>Não encontramos este pedido.</h1><p>{error}</p></> : !order ? <p>Carregando status...</p> : <><h1>Pedido #{order.order_number}</h1><div className="tracking-status">{labels[order.status] || order.status}</div><p>Esta página atualiza automaticamente. Você pode voltar pelo mesmo link.</p>{order.estimated_minutes && <p>Previsão informada pela loja: {order.estimated_minutes} minutos.</p>}<small>Atualizado em {new Date(order.updated_at).toLocaleString("pt-BR")}</small></>}</section></main>;
}
