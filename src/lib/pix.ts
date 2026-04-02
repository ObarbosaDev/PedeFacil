type PixPayloadInput = {
  key: string;
  amount: number;
  merchantName: string;
  merchantCity: string;
  txid: string;
  description?: string;
};

function toAsciiUpper(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase();
}

function formatField(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function normalizePixKey(rawKey: string) {
  const key = rawKey.trim();
  const onlyDigits = key.replace(/\D/g, "");
  if (onlyDigits.length === 11 || onlyDigits.length === 14) return onlyDigits;
  return key;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(input: PixPayloadInput) {
  const merchantName = toAsciiUpper(input.merchantName).slice(0, 25);
  const merchantCity = toAsciiUpper(input.merchantCity).slice(0, 15);
  const txid = toAsciiUpper(input.txid).replace(/[^A-Z0-9]/g, "").slice(0, 25) || "PEDENOW";
  const amount = Math.max(0, input.amount).toFixed(2);

  const gui = formatField("00", "BR.GOV.BCB.PIX");
  const key = formatField("01", normalizePixKey(input.key));
  const description = input.description?.trim() ? formatField("02", input.description.trim().slice(0, 99)) : "";
  const merchantAccount = formatField("26", `${gui}${key}${description}`);
  const additionalData = formatField("62", formatField("05", txid));

  const partial =
    formatField("00", "01") +
    merchantAccount +
    formatField("52", "0000") +
    formatField("53", "986") +
    formatField("54", amount) +
    formatField("58", "BR") +
    formatField("59", merchantName) +
    formatField("60", merchantCity) +
    additionalData +
    "6304";

  const crc = crc16Ccitt(partial);
  return `${partial}${crc}`;
}

export function buildPixQrImageUrl(payload: string) {
  const encoded = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encoded}`;
}
