import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

type Highlight = {
  icon: LucideIcon;
  text: string;
};

type AuthSplitLayoutProps = {
  leftEyebrow: string;
  leftTitle: string;
  leftDescription: string;
  leftHighlights: Highlight[];
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  formIcon: LucideIcon;
  backTo: string;
  backLabel: string;
  secondaryTo?: string;
  secondaryLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
  leftTone?: "dark" | "slate" | "emerald" | "sky";
  formTone?: "orange" | "emerald" | "sky";
  quickPoints?: string[];
};

export function AuthSplitLayout({
  leftEyebrow,
  leftTitle,
  leftDescription,
  leftHighlights,
  formEyebrow,
  formTitle,
  formDescription,
  formIcon: FormIcon,
  backTo,
  backLabel,
  secondaryTo,
  secondaryLabel,
  footer,
  children,
  leftTone = "slate",
  formTone = "orange",
  quickPoints = [],
}: AuthSplitLayoutProps) {
  const leftToneStyles =
    leftTone === "dark"
      ? {
          panel: "from-zinc-950 via-zinc-900 to-zinc-800 text-zinc-50",
          glowA: "bg-white/10",
          glowB: "bg-zinc-400/20",
        }
      : leftTone === "emerald"
      ? {
          panel: "from-emerald-950 via-emerald-900 to-teal-800 text-emerald-50",
          glowA: "bg-emerald-200/15",
          glowB: "bg-cyan-300/15",
        }
      : leftTone === "sky"
      ? {
          panel: "from-sky-950 via-blue-900 to-cyan-800 text-sky-50",
          glowA: "bg-sky-200/15",
          glowB: "bg-cyan-300/15",
        }
      : {
          panel: "from-zinc-900 via-slate-800 to-slate-700 text-zinc-50",
          glowA: "bg-slate-200/15",
          glowB: "bg-zinc-300/15",
        };

  const formToneStyles =
    formTone === "emerald"
      ? {
          bar: "from-emerald-500 via-emerald-400 to-teal-300",
          chip: "text-zinc-200 bg-zinc-900/75 border-zinc-700/70",
          eyebrow: "text-emerald-300",
          overlay: "bg-[linear-gradient(135deg,rgba(17,24,39,0.24),transparent_34%),linear-gradient(315deg,rgba(39,39,42,0.18),transparent_36%)]",
        }
      : formTone === "sky"
      ? {
          bar: "from-sky-500 via-blue-400 to-cyan-300",
          chip: "text-zinc-200 bg-zinc-900/75 border-zinc-700/70",
          eyebrow: "text-sky-300",
          overlay: "bg-[linear-gradient(135deg,rgba(17,24,39,0.24),transparent_34%),linear-gradient(315deg,rgba(39,39,42,0.18),transparent_36%)]",
        }
      : {
          bar: "from-orange-500 via-amber-400 to-orange-300",
          chip: "text-zinc-200 bg-zinc-900/75 border-zinc-700/70",
          eyebrow: "text-orange-300",
          overlay: "bg-[linear-gradient(135deg,rgba(17,24,39,0.24),transparent_34%),linear-gradient(315deg,rgba(39,39,42,0.18),transparent_36%)]",
        };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#efeee9] auth-stage">
      <a
        href="#auth-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-zinc-900 focus:text-zinc-100 focus:px-4 focus:py-2 focus:rounded-md"
      >
        Ir para o conteúdo principal
      </a>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(148,163,184,0.22),transparent_34%),radial-gradient(circle_at_86%_20%,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_48%_88%,rgba(249,115,22,0.10),transparent_36%)]" />
        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-zinc-300/25 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-zinc-100/50 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(120deg,rgba(17,24,39,0.08)_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <div className="min-h-screen grid lg:grid-cols-2 gap-0 relative z-10">
        <section className="hidden lg:flex p-8 xl:p-12">
          <div className={`w-full rounded-3xl bg-gradient-to-br ${leftToneStyles.panel} p-8 xl:p-10 flex flex-col justify-between border border-white/10 shadow-[0_38px_120px_-62px_rgba(0,0,0,0.85)] relative overflow-hidden auth-left-panel`}>
            <div className={`absolute -right-14 -top-12 h-48 w-48 rounded-full ${leftToneStyles.glowA} blur-3xl pointer-events-none`} />
            <div className={`absolute -left-16 bottom-6 h-44 w-44 rounded-full ${leftToneStyles.glowB} blur-3xl pointer-events-none`} />
            <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(135deg,rgba(255,255,255,0.16),transparent_40%)]" />
            <div>
              <Link to="/" className="inline-flex items-center mb-8" aria-label="Voltar para a página inicial">
                <img src="/logo.png" alt="Logo Pede Fácil" className="h-12 w-auto object-contain" />
              </Link>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/75">{leftEyebrow}</p>
              <h1 className="text-4xl xl:text-5xl font-black leading-[1.02] mt-4 max-w-xl text-balance">{leftTitle}</h1>
              <p className="mt-4 text-base xl:text-lg leading-relaxed text-white/85 max-w-lg text-pretty">{leftDescription}</p>
            </div>

            <div className="space-y-3 mt-8">
              {leftHighlights.map((item) => (
                <div key={item.text} className="rounded-xl bg-black/25 border border-white/15 p-4 flex items-center gap-3 backdrop-blur-sm auth-highlight">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main id="auth-main-content" className="flex items-center justify-center p-6 sm:p-8">
          <Card className="w-full max-w-md border-zinc-800/90 bg-zinc-950/95 backdrop-blur text-zinc-100 shadow-[0_36px_110px_-56px_rgba(0,0,0,0.95)] relative overflow-hidden ring-1 ring-white/5 auth-form-card">
            <div className={`h-1.5 w-full bg-gradient-to-r ${formToneStyles.bar}`} />
            <div className={`absolute inset-0 pointer-events-none ${formToneStyles.overlay}`} />
            <CardContent className="p-6 sm:p-8 relative">
              <div className="lg:hidden mb-5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
                <Link to="/" className="inline-flex items-center" aria-label="Voltar para a página inicial">
                  <img src="/logo.png" alt="Logo Pede Fácil" className="h-8 w-auto object-contain" />
                </Link>
              </div>

              <div className="mb-5 flex items-center justify-between">
                <Link
                  to={backTo}
                  className="inline-flex items-center gap-1 text-sm text-zinc-300 hover:text-white transition-colors font-medium rounded-md px-1.5 py-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </Link>
                {secondaryTo && secondaryLabel ? (
                  <Link
                    to={secondaryTo}
                    className="text-sm text-zinc-300 hover:text-white transition-colors font-medium rounded-md px-1.5 py-1"
                  >
                    {secondaryLabel}
                  </Link>
                ) : null}
              </div>

              <div className="mb-6">
                <p className={`text-sm font-semibold flex items-center gap-2 ${formToneStyles.eyebrow}`}>
                  <FormIcon className="h-4 w-4" />
                  {formEyebrow}
                </p>
                <h2 className="text-[1.65rem] sm:text-3xl font-black mt-2 tracking-tight leading-tight text-zinc-100 text-balance">{formTitle}</h2>
                <p className="text-zinc-300 mt-2 leading-relaxed text-pretty">{formDescription}</p>
              </div>

              {quickPoints.length > 0 ? (
                <div className="mb-5 flex flex-wrap gap-2">
                  {quickPoints.slice(0, 3).map((point) => (
                    <span
                      key={point}
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${formToneStyles.chip}`}
                    >
                      {point}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="auth-input-shell rounded-xl p-1 -m-1 [&_input]:bg-zinc-100 [&_input]:text-zinc-900 [&_input]:border-zinc-300 [&_input::placeholder]:text-zinc-500 [&_input:focus]:ring-zinc-300 [&_input:focus-visible]:ring-zinc-300 [&_button[aria-label]]:text-zinc-600 [&_button[aria-label]]:hover:text-zinc-900">
                {children}
              </div>
              {footer ? <div className="mt-6">{footer}</div> : null}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
