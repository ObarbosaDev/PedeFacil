import { CartItem } from "@/hooks/useCart";

interface WhatsAppOrderData {
  storeName: string;
  whatsappNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: "pickup" | "delivery";
  observation?: string;
  items: CartItem[];
  total: number;
}

export function generateWhatsAppMessage(data: WhatsAppOrderData): string {
  const itemLines = data.items
    .map((item) => `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`)
    .join("\n");

  const typeLabel = data.orderType === "pickup" ? "🏪 Retirada" : "🛵 Entrega";

  const message = `🛒 *Novo Pedido - ${data.storeName}*

👤 *Cliente:* ${data.customerName}
📱 *Telefone:* ${data.customerPhone}
📦 *Tipo:* ${typeLabel}
${data.observation ? `📝 *Obs:* ${data.observation}` : ""}

*Itens do Pedido:*
${itemLines}

💰 *Total: R$ ${data.total.toFixed(2)}*

_Pedido enviado via PedeFácil_`;

  return message;
}

export function openWhatsApp(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");
}
