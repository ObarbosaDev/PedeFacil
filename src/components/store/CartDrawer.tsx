import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
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
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate(`/loja/${establishmentSlug}/checkout`);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Carrinho ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Seu carrinho está vazio</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-3 py-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-sm text-primary font-semibold">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
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
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
              <Button className="w-full" size="lg" onClick={handleCheckout}>
                Finalizar Pedido
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
