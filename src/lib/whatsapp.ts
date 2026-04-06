import { CartItem } from "@/hooks/useCart";

interface WhatsAppOrderData {
  storeName: string;
  whatsappNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: "pickup" | "delivery";
  observation?: string;
  deliveryAddress?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    complement?: string;
    reference?: string;
  };
  items: CartItem[];
  subtotal: number;
  discountAmount?: number;
  deliveryFee?: number;
  serviceFee?: number;
  paymentMethod?: "pix" | "credit_card" | "debit_card" | "cash" | "meal_voucher";
  couponCode?: string;
  total: number;
}

export function generateWhatsAppMessage(data: WhatsAppOrderData): string {
  const itemLines = data.items
    .map((item) => `- ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`)
    .join("\n");

  const typeLabel = data.orderType === "pickup" ? "Retirada" : "Entrega";
  const address = data.deliveryAddress;

  const hasDeliveryAddress =
    data.orderType === "delivery" &&
    !!(address?.street || address?.number || address?.neighborhood || address?.city || address?.state || address?.zipCode);

  const addressBlock = hasDeliveryAddress
    ? `\n*Endereço de entrega:*\n${address?.street || ""}, ${address?.number || "S/N"}\n${address?.neighborhood || ""} - ${address?.city || ""}/${address?.state || ""}\nCEP: ${address?.zipCode || "-"}${address?.complement ? `\nComplemento: ${address.complement}` : ""}${address?.reference ? `\nReferência: ${address.reference}` : ""}\n`
    : "";

  const discountValue = Number(data.discountAmount || 0);
  const deliveryFee = Number(data.deliveryFee || 0);
  const serviceFee = Number(data.serviceFee || 0);
  const couponLine = data.couponCode && discountValue > 0 ? `*Cupom:* ${data.couponCode}\n` : "";
  const discountLine = discountValue > 0 ? `*Desconto:* -R$ ${discountValue.toFixed(2)}\n` : "";
  const deliveryLine = deliveryFee > 0 ? `*Taxa de entrega:* R$ ${deliveryFee.toFixed(2)}\n` : "";
  const serviceLine = serviceFee > 0 ? `*Taxa de serviço:* R$ ${serviceFee.toFixed(2)}\n` : "";

  const paymentLabels: Record<NonNullable<WhatsAppOrderData["paymentMethod"]>, string> = {
    pix: "PIX",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    cash: "Dinheiro",
    meal_voucher: "Vale alimentação",
  };
  const paymentLine = data.paymentMethod ? `*Pagamento:* ${paymentLabels[data.paymentMethod]}\n` : "";

  const message = `*Novo pedido - ${data.storeName}*\n\n*Cliente:* ${data.customerName}\n*Telefone:* ${data.customerPhone}\n*Tipo:* ${typeLabel}\n${addressBlock}${paymentLine}${data.observation ? `*Observações:* ${data.observation}` : ""}\n\n*Itens do pedido:*\n${itemLines}\n\n*Subtotal:* R$ ${data.subtotal.toFixed(2)}\n${couponLine}${discountLine}${deliveryLine}${serviceLine}*Total:* R$ ${data.total.toFixed(2)}\n\n_Pedido enviado via PedeFácil_`;

  return message;
}

export function openWhatsApp(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");
}
