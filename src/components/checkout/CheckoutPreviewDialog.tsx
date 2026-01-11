import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import CheckoutColumnsPreview, { ColumnPreviewData } from "./CheckoutColumnsPreview";
import { Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CheckoutPreviewDialogProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CheckoutPreviewDialog = ({
  productId,
  open,
  onOpenChange,
}: CheckoutPreviewDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<ColumnPreviewData | null>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (open && productId) {
      fetchPreviewData();
    }
  }, [open, productId]);

  const fetchPreviewData = async () => {
    setLoading(true);
    try {
      // Fetch product
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      // Fetch checkout settings
      const { data: checkoutSettings } = await supabase
        .from("checkout_settings")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      // Determine product type
      let productType: "digital" | "physical" | "subscription" = "digital";
      if (product.product_type === "fisico") {
        productType = "physical";
      } else if (product.payment_type === "assinatura") {
        productType = "subscription";
      }

      // Calculate values
      const price = product.price || 0;
      const quantity = 1;
      const subtotal = price * quantity;

      // Taxes simulation
      const taxes = [
        { name: "ICMS", rate: 12, amount: subtotal * 0.12 },
      ];
      const totalTaxes = taxes.reduce((acc, t) => acc + t.amount, 0);

      // Shipping for physical products
      let shipping = undefined;
      if (productType === "physical") {
        shipping = {
          method: "PAC - Correios",
          price: 19.90,
          estimatedDays: 7,
        };
      }

      // Subscription info
      let subscription = undefined;
      if (productType === "subscription") {
        const today = new Date();
        subscription = {
          plan: "Mensal",
          interval: "monthly",
          startDate: format(today, "dd/MM/yyyy", { locale: ptBR }),
          nextPaymentDate: format(addMonths(today, 1), "dd/MM/yyyy", { locale: ptBR }),
        };
      }

      // Build preview data
      const data: ColumnPreviewData = {
        products: [
          {
            id: product.id,
            name: product.name,
            type: productType,
            price: price,
            quantity: quantity,
            image_url: product.image_url,
            subscription_interval: productType === "subscription" ? "monthly" : undefined,
          },
        ],
        subtotal: subtotal,
        taxes: taxes,
        shipping: shipping,
        total: subtotal + totalTaxes + (shipping?.price || 0),
        paymentMethod: "pix",
        installments: 1,
        buyer: {
          name: "Cliente Exemplo",
          email: "cliente@exemplo.com",
          document: "123.456.789-00",
          phone: "(11) 99999-9999",
          address: productType === "physical" ? {
            street: "Rua Exemplo",
            number: "123",
            city: "São Paulo",
            state: "SP",
            zipCode: "01234-567",
          } : undefined,
        },
        subscription: subscription,
      };

      setPreviewData(data);
      setSettings({
        primary_color: checkoutSettings?.primary_color || "#3b82f6",
        pix_enabled: checkoutSettings?.pix_enabled ?? true,
        credit_card_enabled: checkoutSettings?.credit_card_enabled ?? true,
        boleto_enabled: checkoutSettings?.boleto_enabled ?? false,
        show_guarantee: checkoutSettings?.show_guarantee ?? true,
        guarantee_days: checkoutSettings?.guarantee_days || 7,
        max_installments: checkoutSettings?.max_installments || 12,
      });
    } catch (error) {
      console.error("Error fetching preview data:", error);
      toast.error("Erro ao carregar pré-visualização");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodChange = (method: "pix" | "credit_card" | "boleto" | "wallet") => {
    if (previewData) {
      setPreviewData({ ...previewData, paymentMethod: method });
    }
  };

  const handleInstallmentsChange = (value: number) => {
    if (previewData) {
      setPreviewData({ ...previewData, installments: value });
    }
  };

  const handleConfirm = () => {
    toast.info("Esta é apenas uma pré-visualização. O checkout real redirecionará para o gateway de pagamento.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-gray-800">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-500" />
            <DialogTitle className="text-white">
              Pré-visualização do Checkout
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-400">
            Visualização completa organizada em colunas com todos os dados do pedido.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : previewData && settings ? (
          <CheckoutColumnsPreview
            data={previewData}
            settings={settings}
            onPaymentMethodChange={handlePaymentMethodChange}
            onInstallmentsChange={handleInstallmentsChange}
            onConfirm={handleConfirm}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            Erro ao carregar pré-visualização
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutPreviewDialog;
