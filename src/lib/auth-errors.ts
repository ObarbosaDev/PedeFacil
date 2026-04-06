export function getFriendlyAuthError(error: unknown) {
  const extractMessage = () => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;

      const errorDescription = (error as { error_description?: unknown }).error_description;
      if (typeof errorDescription === "string" && errorDescription.trim()) return errorDescription;

      const msg = (error as { msg?: unknown }).msg;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    return "Não foi possível autenticar.";
  };

  const rawMessage = extractMessage();
  const message = rawMessage.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos. Confere os dados e tenta de novo.";
  }

  if (message.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Dá uma olhada na caixa de entrada e no spam.";
  }

  if (message.includes("too many requests")) {
    return "Muitas tentativas em sequência. Espera um pouco e tenta novamente.";
  }

  if (message.includes("for security purposes")) {
    return "Por segurança, essa conta foi temporariamente bloqueada. Tenta novamente em alguns minutos.";
  }

  if (message.includes("jwt")) {
    return "Sua sessão expirou ou ficou inválida. Tenta entrar novamente.";
  }

  if (
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("relation") ||
    message.includes("42p01")
  ) {
    return "Estamos finalizando uma atualização. Tenta de novo em alguns instantes.";
  }

  return "Não conseguimos concluir seu acesso agora. Tenta novamente em instantes.";
}
