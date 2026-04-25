import rateLimit from "express-rate-limit";

export function limiter(typeIA: boolean) {
  const windowMs = typeIA ? 5 * 60 * 1000 : 15 * 60 * 1000;
  const max = typeIA ? 30 : 100;
  const message = typeIA
    ? "Estás enviando demasiadas preguntas a la IA. Esperá un momento antes de continuar."
    : "Demasiadas solicitudes desde esta IP. Intenta nuevamente más tarde.";

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
}
