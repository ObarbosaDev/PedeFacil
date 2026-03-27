import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { generateWhatsAppMessage, openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag } from "lucide-react";

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Mínimo 2 caracteres").max(100),
  customerPhone: z.string().min(10, "Telefone inválido").max(20),
  orderType: z.enum(["pickup", "delivery"]),
  observation: z.string().max(500).optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();

  const { data: establishment } = useQuery({
    queryKey: ["public-establishment", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: "", customerPhone: "", orderType: "pickup", observation: "" },
  });

  const orderMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      // Create customer
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({ name: data.customerName, phone: data.customerPhone })
        .select()
        .single();
      if (custErr) throw custErr;

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          establishment_id: establishment!.id,
          customer_id: customer.id,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          order_type: data.orderType as any,
          observation: data.observation || null,
          total,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Loyalty: add points
      await supabase.from("loyalty_accounts").upsert(
        {
          customer_id: customer.id,
          establishment_id: establishment!.id,
          points: Math.floor(total),
        },
        { onConflict: "customer_id,establishment_id" }
      );

      return { order, data };
    },
    onSuccess: (result) => {
      const message = generateWhatsAppMessage({
        storeName: establishment!.name,
        whatsappNumber: establishment!.whatsapp,
        customerName: result.data.customerName,
        customerPhone: result.data.customerPhone,
        orderType: result.data.orderType,
        observation: result.data.observation,
        items,
        total,
      });

      openWhatsApp(establishment!.whatsapp, message);
      clearCart();
      toast.success("Pedido enviado com sucesso!");
      navigate(`/loja/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao enviar pedido"),
  });

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Carrinho vazio</h2>
          <p className="text-muted-foreground mb-4">Adicione itens ao carrinho antes de finalizar.</p>
          <Button onClick={() => navigate(`/loja/${slug}`)}>Voltar ao Cardápio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/loja/${slug}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar ao Cardápio
        </Button>

        <h1 className="text-3xl font-bold">Finalizar Pedido</h1>

        {/* Order summary */}
        <Card>
          <CardHeader><CardTitle>Resumo do Pedido</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Checkout form */}
        <Card>
          <CardHeader><CardTitle>Seus Dados</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => orderMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="customerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl><Input placeholder="Seu nome" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="customerPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone / WhatsApp *</FormLabel>
                    <FormControl><Input placeholder="(11) 99999-8888" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="orderType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de pedido *</FormLabel>
                    <FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pickup" id="pickup" />
                          <Label htmlFor="pickup">🏪 Retirada</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="delivery" id="delivery" />
                          <Label htmlFor="delivery">🛵 Entrega</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="observation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl><Textarea placeholder="Alguma observação sobre o pedido?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" size="lg" disabled={orderMutation.isPending}>
                  {orderMutation.isPending ? "Enviando..." : "📱 Enviar Pedido via WhatsApp"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
