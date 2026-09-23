/**
 * Módulo: demonstração honesta do painel de pedidos.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: hero da landing.
 * Finalidade: mostrar o resultado operacional antes do cadastro.
 * Motivo: substituir vídeo externo e mockup genérico por uma prévia controlada.
 * Evolução: usar captura real do painel validado no piloto.
 */
import { BellRing, Check, Clock3, PackageCheck, ShoppingBag, UserRound } from "lucide-react";

const orderColumns = [
  {
    label: "Recebidos",
    count: 3,
    accent: "bg-amber-400",
    cards: [
      { id: "#1048", name: "Ana Souza", value: "R$ 68,90", time: "há 2 min" },
      { id: "#1047", name: "Lucas Lima", value: "R$ 42,00", time: "há 5 min" },
    ],
  },
  {
    label: "Em preparo",
    count: 2,
    accent: "bg-orange-500",
    cards: [{ id: "#1046", name: "Marina Alves", value: "R$ 91,50", time: "18 min" }],
  },
  {
    label: "Prontos",
    count: 1,
    accent: "bg-emerald-500",
    cards: [{ id: "#1045", name: "Paulo Reis", value: "R$ 54,80", time: "retirada" }],
  },
] as const;

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-[94%] max-w-6xl" aria-label="Previa do painel de pedidos do Pede Facil">
      <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle,hsla(var(--marketing-primary),0.25),transparent_62%)] blur-2xl" />
      <div className="overflow-hidden rounded-[1.4rem] border border-white/15 bg-[#0c0b0b] shadow-[0_40px_140px_-40px_rgba(0,0,0,0.95)] md:rounded-[1.8rem]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Loja aberta e recebendo pedidos
          </div>
          <BellRing className="size-4 text-white/45" />
        </div>

        <div className="grid min-h-[380px] grid-cols-1 md:grid-cols-[190px_1fr] lg:grid-cols-[220px_1fr]">
          <aside className="hidden border-r border-white/10 bg-black/30 p-4 md:block">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Pede Facil</p>
            <div className="mt-6 space-y-1 text-sm">
              <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 font-semibold text-black">
                <ShoppingBag className="size-4" /> Pedidos
              </div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/46">
                <PackageCheck className="size-4" /> Cardápio
              </div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/46">
                <UserRound className="size-4" /> Clientes
              </div>
            </div>
          </aside>

          <div className="p-4 md:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">Operação de hoje</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">Pedidos em andamento</h3>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">Pedidos</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">26 hoje</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">Ticket médio</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">R$ 57,40</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {orderColumns.map((column) => (
                <div key={column.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${column.accent}`} />
                      <p className="text-xs font-semibold text-white/72">{column.label}</p>
                    </div>
                    <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-white/50">{column.count}</span>
                  </div>
                  <div className="space-y-2">
                    {column.cards.map((order) => (
                      <div key={order.id} className="rounded-xl border border-white/[0.08] bg-[#151313] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">{order.id}</span>
                          <span className="text-[10px] text-white/38">{order.time}</span>
                        </div>
                        <p className="mt-2 truncate text-xs text-white/56">{order.name}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{order.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="liquid-glass absolute -right-1 top-20 hidden w-56 rounded-2xl p-4 text-left shadow-2xl sm:block lg:-right-12">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
            <Check className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-white">Novo pedido confirmado</p>
            <p className="mt-1 text-[11px] leading-4 text-white/50">Pagamento aprovado e cozinha avisada.</p>
          </div>
        </div>
      </div>

      <div className="liquid-glass absolute -bottom-6 left-3 hidden w-52 rounded-2xl p-4 text-left shadow-2xl md:block lg:-left-10">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[hsla(var(--marketing-primary),0.15)] text-[hsl(var(--marketing-primary))]">
            <Clock3 className="size-4" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Tempo de resposta</p>
            <p className="mt-0.5 text-lg font-semibold text-white">2 min 14 s</p>
          </div>
        </div>
      </div>
    </div>
  );
}
