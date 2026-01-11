import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package,
  DollarSign,
  Settings,
  History,
  Eye,
  Code,
  CreditCard,
  ShoppingCart,
  Link as LinkIcon,
  Users,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FileText,
  Calendar,
  Tag,
  Globe,
  Percent,
  Box,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  product_type: string | null;
  category: string | null;
  payment_type: string | null;
  delivery_method: string | null;
  marketplace_enabled: boolean | null;
  sales_page_url: string | null;
  sac_name: string | null;
  sac_email: string | null;
  sac_phone: string | null;
  weight: number | null;
  stock: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  commission_percentage: number | null;
  affiliate_auto_approve: boolean | null;
  subscription_quantity_mode: string | null;
  slug: string | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_grams: number | null;
}

interface ProductSalesStats {
  sales_count: number;
  total_revenue: number;
  net_revenue: number;
  platform_fees: number;
  payment_fees: number;
  affiliate_commissions: number;
}

interface CheckoutSettings {
  pix_enabled: boolean | null;
  credit_card_enabled: boolean | null;
  boleto_enabled: boolean | null;
  max_installments: number | null;
  show_timer: boolean | null;
  timer_minutes: number | null;
  show_guarantee: boolean | null;
  guarantee_days: number | null;
  require_phone: boolean | null;
  require_document: boolean | null;
  require_address: boolean | null;
}

interface ProductLog {
  id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  buyer_email: string | null;
}

interface AdminProductDetailsProps {
  products: Product[];
  onProductsChange?: () => void;
}

export const AdminProductDetails = ({ products, onProductsChange }: AdminProductDetailsProps) => {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [productStats, setProductStats] = useState<Record<string, ProductSalesStats>>({});
  const [checkoutSettings, setCheckoutSettings] = useState<Record<string, CheckoutSettings>>({});
  const [productLogs, setProductLogs] = useState<Record<string, ProductLog[]>>({});
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});
  const [showJsonModal, setShowJsonModal] = useState<string | null>(null);

  const loadProductDetails = async (productId: string) => {
    if (loadingStats[productId]) return;
    setLoadingStats((prev) => ({ ...prev, [productId]: true }));

    try {
      // Load sales stats
      const { data: sales } = await supabase
        .from("sales")
        .select("amount, platform_fee, payment_fee, commission_amount, status")
        .eq("product_id", productId)
        .in("status", ["completed", "approved"]);

      const stats: ProductSalesStats = {
        sales_count: sales?.length || 0,
        total_revenue: sales?.reduce((sum, s) => sum + Number(s.amount), 0) || 0,
        platform_fees: sales?.reduce((sum, s) => sum + Number(s.platform_fee || 0), 0) || 0,
        payment_fees: sales?.reduce((sum, s) => sum + Number(s.payment_fee || 0), 0) || 0,
        affiliate_commissions: sales?.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0) || 0,
        net_revenue: 0,
      };
      stats.net_revenue = stats.total_revenue - stats.platform_fees - stats.payment_fees - stats.affiliate_commissions;
      setProductStats((prev) => ({ ...prev, [productId]: stats }));

      // Load checkout settings
      const { data: checkout } = await supabase
        .from("checkout_settings")
        .select("pix_enabled, credit_card_enabled, boleto_enabled, max_installments, show_timer, timer_minutes, show_guarantee, guarantee_days, require_phone, require_document, require_address")
        .eq("product_id", productId)
        .maybeSingle();

      if (checkout) {
        setCheckoutSettings((prev) => ({ ...prev, [productId]: checkout }));
      }

      // Load product logs
      const { data: logs } = await supabase
        .from("checkout_logs")
        .select("id, event_type, created_at, metadata, buyer_email")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (logs) {
        setProductLogs((prev) => ({ ...prev, [productId]: logs as ProductLog[] }));
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes do produto:", error);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoadingStats((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleExpand = (productId: string) => {
    const isExpanding = expandedProduct !== productId;
    setExpandedProduct(isExpanding ? productId : null);
    if (isExpanding && !productStats[productId]) {
      loadProductDetails(productId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pausado</Badge>;
      case "blocked":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueado</Badge>;
      case "deleted":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Excluído</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProductTypeLabel = (type: string | null) => {
    switch (type) {
      case "digital": return "Digital";
      case "physical": return "Físico";
      case "subscription": return "Assinatura";
      case "service": return "Serviço";
      default: return type || "Não definido";
    }
  };

  const getCheckoutUrl = (product: Product) => {
    const baseUrl = window.location.origin;
    return product.slug 
      ? `${baseUrl}/p/${product.slug}` 
      : `${baseUrl}/checkout/${product.id}`;
  };

  const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      "checkout_started": "Checkout Iniciado",
      "payment_initiated": "Pagamento Iniciado",
      "payment_approved": "Pagamento Aprovado",
      "payment_failed": "Pagamento Falhou",
      "session_expired": "Sessão Expirada",
      "pix_generated": "PIX Gerado",
      "boleto_generated": "Boleto Gerado",
    };
    return labels[eventType] || eventType;
  };

  if (products.length === 0) {
    return (
      <Card className="bg-card/50 border-border/30">
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum produto cadastrado
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Accordion type="single" collapsible className="space-y-3">
        {products.map((product) => (
          <AccordionItem 
            key={product.id} 
            value={product.id}
            className="border border-border/30 rounded-lg bg-card/50 px-4"
          >
            <AccordionTrigger 
              onClick={() => handleExpand(product.id)}
              className="hover:no-underline"
            >
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Package className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {product.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">{formatCurrency(product.price)}</span>
                  {getStatusBadge(product.status)}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(product.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent>
              {loadingStats[product.id] ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="pt-4">
                  {/* Quick Actions */}
                  <div className="flex gap-2 mb-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowJsonModal(product.id)}
                    >
                      <Code className="w-4 h-4 mr-1" />
                      Visualização Técnica (JSON)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadProductDetails(product.id)}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Atualizar Dados
                    </Button>
                  </div>

                  <Tabs defaultValue="details" className="space-y-4">
                    <TabsList className="bg-background/50">
                      <TabsTrigger value="details" className="gap-1 text-xs">
                        <FileText className="w-3 h-3" />
                        Detalhes Completos
                      </TabsTrigger>
                      <TabsTrigger value="financial" className="gap-1 text-xs">
                        <DollarSign className="w-3 h-3" />
                        Financeiro
                      </TabsTrigger>
                      <TabsTrigger value="settings" className="gap-1 text-xs">
                        <Settings className="w-3 h-3" />
                        Configurações
                      </TabsTrigger>
                      <TabsTrigger value="logs" className="gap-1 text-xs">
                        <History className="w-3 h-3" />
                        Histórico/Logs
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab Detalhes Completos */}
                    <TabsContent value="details">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Identificação */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Tag className="w-4 h-4" />
                              Identificação
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ID:</span>
                              <span className="font-mono text-xs">{product.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Slug:</span>
                              <span>{product.slug || "Não definido"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Criado por:</span>
                              <span className="font-mono text-xs">{product.user_id.slice(0, 8)}...</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Informações Gerais */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Informações Gerais
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Nome:</span>
                              <span className="font-medium">{product.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Tipo:</span>
                              <span>{getProductTypeLabel(product.product_type)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Categoria:</span>
                              <span>{product.category || "Não definida"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              {getStatusBadge(product.status)}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Preços e Moeda */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Preço e Pagamento
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Preço:</span>
                              <span className="font-bold text-green-400">{formatCurrency(product.price)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Moeda:</span>
                              <span>BRL (Real)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Tipo Pgto:</span>
                              <span>{product.payment_type || "Avulso"}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Descrição */}
                        <Card className="bg-background/50 md:col-span-2 lg:col-span-3">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Descrição Completa</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {product.description || "Sem descrição"}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Datas */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              Datas
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Criado em:</span>
                              <span>{format(new Date(product.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Atualizado em:</span>
                              <span>{format(new Date(product.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* URLs */}
                        <Card className="bg-background/50 md:col-span-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <LinkIcon className="w-4 h-4" />
                              URLs
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">URL Checkout:</span>
                              <code className="text-xs bg-background p-1 rounded">{getCheckoutUrl(product)}</code>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Página de Vendas:</span>
                              <span className="text-xs">{product.sales_page_url || "Não definida"}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Afiliados */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Configurações de Afiliados
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Programa Ativo:</span>
                              {product.commission_percentage && product.commission_percentage > 0 ? (
                                <Badge className="bg-green-500/20 text-green-400">Ativo</Badge>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desativado</Badge>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Comissão:</span>
                              <span className="font-medium">{product.commission_percentage || 0}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Auto-aprovar:</span>
                              {product.affiliate_auto_approve ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Estoque e Logística */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Box className="w-4 h-4" />
                              Estoque e Logística
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Estoque:</span>
                              <span>{product.stock !== null ? product.stock : "Ilimitado"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Entrega:</span>
                              <span>{product.delivery_method || "Não definido"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Marketplace:</span>
                              {product.marketplace_enabled ? (
                                <Badge className="bg-green-500/20 text-green-400">Ativo</Badge>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desativado</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Dimensões (para produtos físicos) */}
                        {product.product_type === "physical" && (
                          <Card className="bg-background/50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Scale className="w-4 h-4" />
                                Dimensões e Peso
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Peso (g):</span>
                                <span>{product.weight_grams || product.weight || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Alt. (cm):</span>
                                <span>{product.height_cm || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Larg. (cm):</span>
                                <span>{product.width_cm || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Comp. (cm):</span>
                                <span>{product.length_cm || "N/A"}</span>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* SAC */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              Suporte (SAC)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Nome:</span>
                              <span>{product.sac_name || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Email:</span>
                              <span className="text-xs">{product.sac_email || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Telefone:</span>
                              <span>{product.sac_phone || "N/A"}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Tab Financeiro */}
                    <TabsContent value="financial">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Stats Cards */}
                        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/30">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-green-500/20">
                                <ShoppingCart className="w-5 h-5 text-green-400" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Quantidade de Vendas</p>
                                <p className="text-2xl font-bold text-green-400">
                                  {productStats[product.id]?.sales_count || 0}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/30">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/20">
                                <DollarSign className="w-5 h-5 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Faturamento Total (Bruto)</p>
                                <p className="text-2xl font-bold text-blue-400">
                                  {formatCurrency(productStats[product.id]?.total_revenue || 0)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-purple-500/20">
                                <DollarSign className="w-5 h-5 text-purple-400" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Faturamento Líquido</p>
                                <p className={cn(
                                  "text-2xl font-bold",
                                  (productStats[product.id]?.net_revenue || 0) >= 0 ? "text-purple-400" : "text-red-400"
                                )}>
                                  {formatCurrency(productStats[product.id]?.net_revenue || 0)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Detalhamento de Taxas */}
                        <Card className="bg-background/50 md:col-span-2 lg:col-span-3">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Percent className="w-4 h-4" />
                              Detalhamento de Taxas Aplicadas
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tipo de Taxa</TableHead>
                                  <TableHead className="text-right">Valor Total Deduzido</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell>Taxa Plataforma</TableCell>
                                  <TableCell className="text-right text-red-400">
                                    -{formatCurrency(productStats[product.id]?.platform_fees || 0)}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Taxa Gateway/Adquirente</TableCell>
                                  <TableCell className="text-right text-orange-400">
                                    -{formatCurrency(productStats[product.id]?.payment_fees || 0)}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Comissões de Afiliados</TableCell>
                                  <TableCell className="text-right text-purple-400">
                                    -{formatCurrency(productStats[product.id]?.affiliate_commissions || 0)}
                                  </TableCell>
                                </TableRow>
                                <TableRow className="font-bold border-t">
                                  <TableCell>Valor Líquido Recebido</TableCell>
                                  <TableCell className={cn(
                                    "text-right",
                                    (productStats[product.id]?.net_revenue || 0) >= 0 ? "text-green-400" : "text-red-400"
                                  )}>
                                    {formatCurrency(productStats[product.id]?.net_revenue || 0)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Tab Configurações */}
                    <TabsContent value="settings">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Métodos de Pagamento */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Métodos de Pagamento Habilitados
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span>PIX</span>
                              {checkoutSettings[product.id]?.pix_enabled !== false ? (
                                <Badge className="bg-green-500/20 text-green-400">Habilitado</Badge>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desabilitado</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Cartão de Crédito</span>
                              {checkoutSettings[product.id]?.credit_card_enabled !== false ? (
                                <Badge className="bg-green-500/20 text-green-400">Habilitado</Badge>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desabilitado</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Boleto</span>
                              {checkoutSettings[product.id]?.boleto_enabled ? (
                                <Badge className="bg-green-500/20 text-green-400">Habilitado</Badge>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desabilitado</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Máx. Parcelas:</span>
                              <span className="font-medium">{checkoutSettings[product.id]?.max_installments || 12}x</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Configurações do Checkout */}
                        <Card className="bg-background/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Settings className="w-4 h-4" />
                              Configurações do Checkout
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span>Timer</span>
                              {checkoutSettings[product.id]?.show_timer ? (
                                <span className="text-sm">{checkoutSettings[product.id]?.timer_minutes || 15} min</span>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desabilitado</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Garantia</span>
                              {checkoutSettings[product.id]?.show_guarantee ? (
                                <span className="text-sm">{checkoutSettings[product.id]?.guarantee_days || 7} dias</span>
                              ) : (
                                <Badge className="bg-gray-500/20 text-gray-400">Desabilitado</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Exigir Telefone</span>
                              {checkoutSettings[product.id]?.require_phone ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Exigir Documento</span>
                              {checkoutSettings[product.id]?.require_document ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Exigir Endereço</span>
                              {checkoutSettings[product.id]?.require_address ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Assinatura (se aplicável) */}
                        {product.product_type === "subscription" && (
                          <Card className="bg-background/50 md:col-span-2">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Configurações de Assinatura</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Modo Quantidade:</span>
                                <span>{product.subscription_quantity_mode || "Não definido"}</span>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </TabsContent>

                    {/* Tab Histórico/Logs */}
                    <TabsContent value="logs">
                      <Card className="bg-background/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <History className="w-4 h-4" />
                            Logs do Produto (Últimos 50)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {!productLogs[product.id] || productLogs[product.id].length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">Nenhum log encontrado</p>
                          ) : (
                            <ScrollArea className="h-[300px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data/Hora</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Detalhes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {productLogs[product.id].map((log) => (
                                    <TableRow key={log.id}>
                                      <TableCell className="text-xs">
                                        {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                          {getEventTypeLabel(log.event_type)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs">{log.buyer_email || "-"}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {log.metadata ? JSON.stringify(log.metadata).slice(0, 50) + "..." : "-"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Modal JSON Técnico */}
      <Dialog open={!!showJsonModal} onOpenChange={() => setShowJsonModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Visualização Técnica - JSON
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-xs bg-background p-4 rounded-lg overflow-auto">
              {showJsonModal && JSON.stringify(
                {
                  product: products.find(p => p.id === showJsonModal),
                  stats: productStats[showJsonModal],
                  checkoutSettings: checkoutSettings[showJsonModal],
                  recentLogs: productLogs[showJsonModal]?.slice(0, 10)
                },
                null,
                2
              )}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
