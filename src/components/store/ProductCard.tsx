import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";

interface ProductCardProps {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_available: boolean;
  onAdd: (item: { id: string; name: string; price: number; image_url?: string | null }) => void;
}

export default function ProductCard({ id, name, description, price, image_url, is_available, onAdd }: ProductCardProps) {
  return (
    <div className="group bg-card rounded-2xl border shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 animate-fade-in">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-orange-100/70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge className={`rounded-full ${is_available ? "bg-emerald-500 hover:bg-emerald-500" : "bg-zinc-700 hover:bg-zinc-700"}`}>
            {is_available ? "Disponível" : "Esgotado"}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-extrabold text-base leading-tight">{name}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{description}</p>}

        <div className="flex items-center justify-between mt-4">
          <span className="text-lg font-bold text-primary">{formatCurrency(price)}</span>
          <Button
            size="sm"
            disabled={!is_available}
            onClick={() => onAdd({ id, name, price, image_url })}
            className="rounded-full px-4"
          >
            <Plus className="h-4 w-4 mr-1" />
            Quero esse
          </Button>
        </div>

        {!is_available && <p className="text-xs text-destructive mt-2 font-medium">Esse item está indisponível por agora.</p>}
      </div>
    </div>
  );
}
