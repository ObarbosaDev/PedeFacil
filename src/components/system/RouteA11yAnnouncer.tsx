import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { logAuditEvent } from "@/lib/observability";

const routeLabels: Record<string, string> = {
  "/": "Tela inicial",
  "/planos": "Planos",
  "/planos/checkout": "Pagamento do plano",
  "/login": "Login do lojista",
  "/registro": "Cadastro do lojista",
  "/cliente/login": "Login do cliente",
  "/cliente/registro": "Cadastro do cliente",
  "/entregador/login": "Login do entregador",
  "/entregador/registro": "Cadastro do entregador",
};

export default function RouteA11yAnnouncer() {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const path = location.pathname;
    const label = routeLabels[path] || `Página ${path}`;
    setAnnouncement(`Você está em: ${label}.`);

    void logAuditEvent({
      actorUserId: null,
      actorRole: "visitor",
      entityType: "route",
      entityId: path,
      action: "route_view",
      metadata: {
        search: location.search || "",
      },
    });
  }, [location.pathname, location.search]);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
