import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  establishmentSlug: string;
}

export default function CartDrawer({ open, onClose, establishmentSlug }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, total, itemCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    if (!user) {
      const next = encodeURIComponent(`/loja/${establishmentSlug}/checkout`);
      navigate(`/cliente/login?next=${next}`);
      return;
    }
    navigate(`/loja/${establishmentSlug}/checkout`);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col border-l bg-gradient-to-b from-background to-orange-50/30">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xl font-black">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Seu carrinho
            </span>
            <span className="text-sm font-semibold text-muted-foreground">{itemCount} item(ns)</span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div>
              <p className="font-bold">Ainda está vazio por aqui.</p>
              <p className="text-muted-foreground text-sm mt-1">Escolha seus favoritos e volte para fechar tudo sem pressa.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-3 py-4 pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card shadow-sm">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-sm text-primary font-bold">{formatCurrency(item.price)}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    <span className="sr-only">Diminuir quantidade de {item.name}</span>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    <span className="sr-only">Aumentar quantidade de {item.name}</span>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-full" onClick={() => removeItem(item.id)}>
                    <span className="sr-only">Remover {item.name} do carrinho</span>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="border-t pt-4">
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Resumo do pedido</span>
                <span>{itemCount} item(ns)</span>
              </div>
              <div className="flex items-center justify-between text-xl font-black">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
              <Button className="w-full rounded-full h-11" size="lg" onClick={handleCheckout}>
                Ir para checkout
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
