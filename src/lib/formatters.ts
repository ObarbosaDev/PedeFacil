export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  confirmed: "Confirmado",
  in_preparation: "Em Preparo",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  confirmed: "bg-yellow-100 text-yellow-700",
  in_preparation: "bg-orange-100 text-orange-700",
  ready: "bg-green-100 text-green-700",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  cash: "Dinheiro",
  meal_voucher: "Vale-alimentação",
};

export function getDeliveryOperationModeLabel(mode?: string | null): string {
  if (mode === "shared_fleet") return "Base compartilhada";
  if (mode === "hybrid") return "Modo híbrido";
  return "Entrega própria";
}
