import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pedefacil.admin.onboarding_welcome_seen";

type OnboardingWelcomeDialogProps = {
  openWhenReady: boolean;
};

export default function OnboardingWelcomeDialog({ openWhenReady }: OnboardingWelcomeDialogProps) {
  const [open, setOpen] = useState(false);

  const shouldOpen = useMemo(() => {
    if (!openWhenReady) return false;
    return localStorage.getItem(STORAGE_KEY) !== "1";
  }, [openWhenReady]);

  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : setOpen(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Primeira passada para colocar a loja no ar</DialogTitle>
          <DialogDescription>
            O jeito mais rápido de sentir valor aqui é: configurar loja, subir cardápio, preparar campanha e validar pedido real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>1. Ajuste os dados da loja e o modo de operação.</p>
          <p>2. Cadastre categorias e produtos suficientes para começar a vender.</p>
          <p>3. Prepare pelo menos uma campanha ou cupom inicial.</p>
          <p>4. Rode o primeiro pedido real e acompanhe tudo no painel.</p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Link to="/admin/loja">
            <Button>Começar por Minha Loja</Button>
          </Link>
          <Button variant="outline" onClick={close}>Fechar por agora</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
