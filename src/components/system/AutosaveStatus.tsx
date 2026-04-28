import { CheckCircle2, LoaderCircle, PencilLine } from "lucide-react";

type AutosaveStatusProps = {
  dirty: boolean;
  saving: boolean;
  savedAt?: string | null;
};

export default function AutosaveStatus({ dirty, saving, savedAt }: AutosaveStatusProps) {
  if (saving) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-orange-500" />
        Salvando...
      </div>
    );
  }

  if (dirty) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
        <PencilLine className="h-3.5 w-3.5 text-orange-500" />
        Alterações pendentes
      </div>
    );
  }

  if (savedAt) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Salvo às {savedAt}
      </div>
    );
  }

  return null;
}
