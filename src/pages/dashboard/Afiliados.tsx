import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Search, ChevronLeft, ChevronRight, Check, X, DollarSign, TrendingUp, UserCheck, Copy, Lock, Ban, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Affiliate {
  id: string;
  user_id: string;
  product_id: string;
  status: string;
  created_at: string;
  product_name?: string;
  product_status?: string;
  product_price?: number;
  product_commission?: number;
  user_email?: string;
  user_name?: string;
  total_sales?: number;
  total_commission?: number;
  owner_earnings?: number;
  affiliate_link?: string;
}

interface Product {
  id: string;
  name: string;
  status: string;
  price: number;
  commission_percentage: number | null;
}

const Afiliados = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ativos");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate stats from affiliates data
  const totalStats = useMemo(() => {
    const activeAffiliates = affiliates.filter(a => a.status === "active");
    return {
      totalAffiliates: activeAffiliates.length,
      totalSales: affiliates.reduce((sum, a) => sum + (a.total_sales || 0), 0),
      totalOwnerEarnings: affiliates.reduce((sum, a) => sum + (a.owner_earnings || 0), 0),
    };
  }, [affiliates]);

  // Count by status for tabs
  const statusCounts = useMemo(() => ({
    active: affiliates.filter(a => a.status === "active").length,
    pending: affiliates.filter(a => a.status === "pending").length,
    refused: affiliates.filter(a => ["refused", "blocked", "cancelled"].includes(a.status)).length,
  }), [affiliates]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's products
      const { data: userProducts } = await supabase
        .from("products")
        .select("id, name, status, price, commission_percentage")
        .eq("user_id", user.id);

      if (userProducts) {
        setProducts([{ id: "all", name: "Todos os produtos", status: "active", price: 0, commission_percentage: null }, ...userProducts]);
      }

      // Fetch affiliations for user's products
      const productIds = userProducts?.map(p => p.id) || [];
      
      if (productIds.length > 0) {
        const { data: affiliationsData } = await supabase
          .from("affiliations")
          .select("*")
          .in("product_id", productIds);

        if (affiliationsData) {
          // Fetch sales data for each affiliation - ONLY APPROVED SALES
          const affiliatesWithDetails = await Promise.all(
            affiliationsData.map(async (aff) => {
              const product = userProducts?.find(p => p.id === aff.product_id);
              
              // Fetch profile for the affiliate
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, email")
                .eq("user_id", aff.user_id)
                .maybeSingle();

              // Fetch ONLY APPROVED sales for this affiliation
              const { data: sales } = await supabase
                .from("affiliate_sales")
                .select("sale_amount, commission_amount, owner_earnings")
                .eq("affiliation_id", aff.id)
                .eq("status", "approved"); // Only count approved sales

              const totalSales = sales?.reduce((sum, s) => sum + Number(s.sale_amount), 0) || 0;
              const totalCommission = sales?.reduce((sum, s) => sum + Number(s.commission_amount), 0) || 0;
              const ownerEarnings = sales?.reduce((sum, s) => sum + Number(s.owner_earnings), 0) || 0;

              // Generate affiliate link
              const affiliateLink = `${window.location.origin}/p/${aff.product_id.slice(0, 8)}?ref=${aff.id.slice(0, 8)}`;

              return {
                ...aff,
                product_name: product?.name || "Produto",
                product_status: product?.status || "active",
                product_price: product?.price || 0,
                product_commission: product?.commission_percentage || 0,
                user_email: profile?.email || "Email não disponível",
                user_name: profile?.full_name || "Afiliado",
                total_sales: totalSales,
                total_commission: totalCommission,
                owner_earnings: ownerEarnings,
                affiliate_link: affiliateLink,
              };
            })
          );

          setAffiliates(affiliatesWithDetails);
        }
      }
    } catch (error) {
      console.error("Error fetching affiliates:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os afiliados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const updateAffiliateStatus = async (affiliationId: string, newStatus: string) => {
    setActionLoading(affiliationId);
    try {
      const { error } = await supabase
        .from("affiliations")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", affiliationId);

      if (error) throw error;

      const statusMessages: Record<string, string> = {
        active: "aprovado",
        refused: "recusado",
        blocked: "bloqueado",
      };

      toast({
        title: "Status atualizado",
        description: `Afiliado ${statusMessages[newStatus] || "atualizado"} com sucesso.`,
      });

      // Update local state instead of refetching
      setAffiliates(prev => 
        prev.map(a => a.id === affiliationId ? { ...a, status: newStatus } : a)
      );
    } catch (error) {
      console.error("Error updating affiliate status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Link copiado!",
        description: "O link de afiliado foi copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const getStatusFilter = (tab: string) => {
    switch (tab) {
      case "ativos":
        return ["active"];
      case "pendentes":
        return ["pending"];
      case "recusados":
        return ["refused", "blocked", "cancelled"];
      default:
        return [];
    }
  };

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter(affiliate => {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch = 
        affiliate.user_name?.toLowerCase().includes(searchLower) ||
        affiliate.user_email?.toLowerCase().includes(searchLower) ||
        affiliate.product_name?.toLowerCase().includes(searchLower);
      const matchesProduct = selectedProduct === "all" || affiliate.product_id === selectedProduct;
      const matchesStatus = getStatusFilter(activeTab).includes(affiliate.status);
      return matchesSearch && matchesProduct && matchesStatus;
    });
  }, [affiliates, debouncedSearch, selectedProduct, activeTab]);

  const totalPages = Math.ceil(filteredAffiliates.length / itemsPerPage);
  const paginatedAffiliates = filteredAffiliates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-bold">Afiliados</h1>

        {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/50 border-border/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-accent/20">
                    <UserCheck className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Afiliados ativos</p>
                    <p className="text-2xl font-bold">{totalStats.totalAffiliates}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-500/20">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total em vendas dos afiliados</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalStats.totalSales)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/20">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Meus ganhos com afiliados</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalStats.totalOwnerEarnings)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setCurrentPage(1); }} className="w-full">
              <TabsList className="bg-transparent border-b border-border/30 rounded-none w-full justify-start h-auto p-0 gap-6">
                <TabsTrigger 
                  value="ativos" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3"
                >
                  Ativos ({statusCounts.active})
                </TabsTrigger>
                <TabsTrigger 
                  value="pendentes" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3"
                >
                  Pendentes ({statusCounts.pending})
                </TabsTrigger>
                <TabsTrigger 
                  value="recusados" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3"
                >
                  Recusados ({statusCounts.refused})
                </TabsTrigger>
              </TabsList>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Pesquisar afiliado..." 
                    className="pl-10 bg-card/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="w-full sm:w-[200px] bg-card/50">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content for all tabs */}
              <TabsContent value={activeTab} className="mt-6">
                {loading ? (
                  <Card className="bg-card/50 border-border/30">
                    <CardContent className="flex items-center justify-center py-16">
                      <p className="text-muted-foreground">Carregando...</p>
                    </CardContent>
                  </Card>
                ) : paginatedAffiliates.length === 0 ? (
                  <Card className="bg-card/50 border-border/30">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="p-4 rounded-full bg-muted/50 mb-4">
                        <Users className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Nenhum afiliado encontrado</h3>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {paginatedAffiliates.map((affiliate) => {
                      const isProductBlocked = affiliate.product_status === "blocked" || affiliate.product_status === "inactive";
                      
                      return (
                      <Card key={affiliate.id} className={`bg-card/50 border-border/30 ${isProductBlocked ? 'opacity-75' : ''}`}>
                        <CardContent className="p-4">
                          {isProductBlocked && (
                            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                              <Lock className="w-4 h-4 text-red-500" />
                              <span className="text-xs text-red-400">
                                Este produto está bloqueado.
                              </span>
                            </div>
                          )}

                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{affiliate.user_name}</h3>
                                <Badge variant={affiliate.status === "active" ? "default" : affiliate.status === "pending" ? "secondary" : "destructive"}>
                                  {affiliate.status === "active" ? "Ativo" : affiliate.status === "pending" ? "Pendente" : "Recusado"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{affiliate.user_email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-muted-foreground">Produto: {affiliate.product_name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {formatCurrency(affiliate.product_price || 0)}
                                </Badge>
                                <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                                  {affiliate.product_commission || 0}% comissão
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-4 md:gap-8 text-center md:text-right">
                              <div>
                                <p className="text-xs text-muted-foreground">Vendas</p>
                                <p className="font-semibold text-green-500">{formatCurrency(affiliate.total_sales || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Comissão</p>
                                <p className="font-semibold text-accent">{formatCurrency(affiliate.total_commission || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Meu ganho</p>
                                <p className="font-semibold text-primary">{formatCurrency(affiliate.owner_earnings || 0)}</p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {actionLoading === affiliate.id ? (
                                <Button size="sm" variant="outline" disabled>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                </Button>
                              ) : (
                                <>
                                  {affiliate.status === "pending" && (
                                    <>
                                      <Button size="sm" variant="default" onClick={() => updateAffiliateStatus(affiliate.id, "active")}>
                                        <Check className="w-4 h-4 mr-1" /> Aprovar
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => updateAffiliateStatus(affiliate.id, "refused")}>
                                        <X className="w-4 h-4 mr-1" /> Recusar
                                      </Button>
                                    </>
                                  )}
                                  {affiliate.status === "active" && !isProductBlocked && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(affiliate.affiliate_link || "")}>
                                            <Copy className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copiar link de afiliado</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => updateAffiliateStatus(affiliate.id, "blocked")}>
                                            <Ban className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Bloquear afiliado</TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Exibindo {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredAffiliates.length)} de {filteredAffiliates.length}
                </p>
                <div className="flex items-center gap-1">
                  <button 
                    className="p-2 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`px-3 py-1 rounded text-sm ${page === currentPage ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    className="p-2 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
      </div>
    </DashboardLayout>
  );
};

export default Afiliados;
