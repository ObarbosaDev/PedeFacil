const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_SIZE_BYTES = 3 * 1024 * 1024;

export const PASSWORD_RULE =
  "Use no minimo 8 caracteres, com letra maiuscula, minuscula, numero e simbolo.";

export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function validateImageFile(file?: File) {
  if (!file) {
    return { ok: false, message: "Selecione uma imagem." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Formato invalido. Use JPG, PNG ou WEBP." };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, message: "Arquivo muito grande. Limite de 3MB." };
  }

  return { ok: true as const };
}

