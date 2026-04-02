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
          line: "rgba(255,255,255,0.22)",
        }
      : leftTone === "emerald"
      ? {
          panel: "from-emerald-950 via-emerald-900 to-teal-800 text-emerald-50",
          glowA: "bg-emerald-200/15",
          glowB: "bg-cyan-300/15",
          line: "rgba(236,253,245,0.22)",
        }
      : leftTone === "sky"
      ? {
          panel: "from-sky-950 via-blue-900 to-cyan-800 text-sky-50",
          glowA: "bg-sky-200/15",
          glowB: "bg-cyan-300/15",
          line: "rgba(224,242,254,0.22)",
        }
      : {
          panel: "from-zinc-900 via-slate-800 to-slate-700 text-zinc-50",
          glowA: "bg-slate-200/15",
          glowB: "bg-zinc-300/15",
          line: "rgba(226,232,240,0.22)",
        };

  const formToneStyles =
    formTone === "emerald"
      ? {
          bar: "from-emerald-500 via-emerald-400 to-teal-300",
          chip: "text-emerald-200 bg-emerald-900/45 border-emerald-700/60",
          eyebrow: "text-emerald-300",
          overlay: "bg-[linear-gradient(135deg,rgba(16,185,129,0.12),transparent_34%),linear-gradient(315deg,rgba(20,184,166,0.08),transparent_36%)]",
        }
      : formTone === "sky"
      ? {
          bar: "from-sky-500 via-blue-400 to-cyan-300",
          chip: "text-sky-200 bg-sky-900/40 border-sky-700/60",
          eyebrow: "text-sky-300",
          overlay: "bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_34%),linear-gradient(315deg,rgba(59,130,246,0.08),transparent_36%)]",
        }
      : {
          bar: "from-orange-500 via-amber-400 to-orange-300",
          chip: "text-orange-200 bg-orange-900/40 border-orange-700/60",
          eyebrow: "text-orange-300",
          overlay: "bg-[linear-gradient(135deg,rgba(249,115,22,0.10),transparent_34%),linear-gradient(315deg,rgba(16,185,129,0.08),transparent_36%)]",
        };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f4f4f1]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(148,163,184,0.20),transparent_38%),radial-gradient(circle_at_86%_18%,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_52%_84%,rgba(59,130,246,0.10),transparent_36%)]" />
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-slate-300/25 blur-3xl" />
        <div className="absolute -bottom-16 right-0 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-zinc-200/30 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,rgba(17,24,39,0.2)_1px,transparent_0)] [background-size:24px_24px]" />
      </div>

      <div className="min-h-screen grid lg:grid-cols-2 gap-0 relative z-10">
        <section className="hidden lg:flex p-8 xl:p-12">
          <div className={`w-full rounded-3xl bg-gradient-to-br ${leftToneStyles.panel} p-8 xl:p-10 flex flex-col justify-between border border-white/10 shadow-[0_38px_120px_-62px_rgba(0,0,0,0.85)] relative overflow-hidden`}>
            <div className={`absolute -right-14 -top-12 h-48 w-48 rounded-full ${leftToneStyles.glowA} blur-3xl pointer-events-none`} />
            <div className={`absolute -left-16 bottom-6 h-44 w-44 rounded-full ${leftToneStyles.glowB} blur-3xl pointer-events-none`} />
            <div
              className="absolute inset-0 opacity-[0.18] [background-size:32px_32px]"
              style={{
                backgroundImage: `linear-gradient(to_right,${leftToneStyles.line}_1px,transparent_1px),linear-gradient(to_bottom,${leftToneStyles.line}_1px,transparent_1px)`,
              }}
            />
            <div>
              <Link to="/" className="inline-flex items-center mb-8" aria-label="Voltar para a página inicial">
                <img src="/logo.png" alt="Logo Pede Fácil" className="h-12 w-auto object-contain" />
              </Link>
              <p className="text-xs uppercase tracking-[0.22em] text-white/75">{leftEyebrow}</p>
              <h1 className="text-4xl xl:text-5xl font-black leading-[1.04] mt-4 max-w-xl">{leftTitle}</h1>
              <p className="mt-4 text-base xl:text-lg text-white/85 max-w-lg">{leftDescription}</p>
            </div>

            <div className="space-y-3 mt-8">
              {leftHighlights.map((item) => (
                <div key={item.text} className="rounded-xl bg-white/10 border border-white/20 p-4 flex items-center gap-3">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8">
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 backdrop-blur text-zinc-100 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.92)] relative overflow-hidden">
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
                <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight text-zinc-100">{formTitle}</h2>
                <p className="text-zinc-300 mt-2">{formDescription}</p>
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

              <div className="[&_input]:bg-zinc-100 [&_input]:text-zinc-900 [&_input]:border-zinc-300 [&_input::placeholder]:text-zinc-500 [&_input:focus]:ring-zinc-300 [&_input:focus-visible]:ring-zinc-300">
                {children}
              </div>
              {footer ? <div className="mt-6">{footer}</div> : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
