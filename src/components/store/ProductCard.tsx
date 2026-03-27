import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow animate-fade-in">
      {image_url && (
        <div className="aspect-[4/3] overflow-hidden">
          <img src={image_url} alt={name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-base">{name}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>}
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-primary">{formatCurrency(price)}</span>
          <Button
            size="sm"
            disabled={!is_available}
            onClick={() => onAdd({ id, name, price, image_url })}
            className="rounded-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        {!is_available && (
          <p className="text-xs text-destructive mt-1 font-medium">Indisponível</p>
        )}
      </div>
    </div>
  );
}
