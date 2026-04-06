export const SUPPORT_PHONE_DISPLAY = "+55 (61) 9 8462-9093";
export const SUPPORT_PHONE_E164 = "5561984629093";

export function buildWhatsAppSupportLink(message: string) {
  const text = encodeURIComponent(message.trim());
  return `https://wa.me/${SUPPORT_PHONE_E164}?text=${text}`;
}
