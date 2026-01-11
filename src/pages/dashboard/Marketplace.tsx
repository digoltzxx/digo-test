import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check, Clock, Monitor, Box, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketplaceProductCard, MarketplaceHeader } from "@/components/marketplace";

const categories = [
  "Todos", "Curso Online", "E-book", "Software", "Template", "Mentoria", "Eletrônicos", "Roupas"
];

interface MarketplaceProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  product_type: string;
  category: string;
  sac_name: string | null;
  commission_percentage: number | null;
  image_url: string | null;
  affiliate_auto_approve: boolean | null;
  sales_count?: number;
  created_at?: string;
  affiliates_count?: number;
  conversion_rate?: number;
}

interface Affiliation {
  product_id: string;
  status: string;
}

type SortOption = "mais-quentes" | "recentes" | "antigos" | "mais-caros" | "mais-baratos" | "nome-az" | "nome-za";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "mais-quentes", label: "Mais quentes" },
  { value: "recentes", label: "Recentes" },
  { value: "antigos", label: "Antigos" },
  { value: "mais-caros", label: "Mais caros" },
  { value: "mais-baratos", label: "Mais baratos" },
  { value: "nome-az", label: "Nome (A-Z)" },
  { value: "nome-za", label: "Nome (Z-A)" },
];

const Marketplace = () => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedSort, setSelectedSort] = useState<SortOption>("mais-quentes");
  const [userAffiliations, setUserAffiliations] = useState<Affiliation[]>([]);
  const [affiliatingProduct, setAffiliatingProduct] = useState<MarketplaceProduct | null>(null);
  const [isAffiliating, setIsAffiliating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMarketplaceProducts();
    fetchUserAffiliations();
  }, []);

  const fetchMarketplaceProducts = async () => {
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, description, price, product_type, category, sac_name, commission_percentage, image_url, affiliate_auto_approve, created_at")
        .eq("marketplace_enabled", true)
        .eq("status", "active");

      if (productsError) throw productsError;

      // Fetch sales count for each product (approved sales only)
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("product_id")
        .eq("status", "approved");

      if (salesError) throw salesError;

      // Fetch affiliates count for each product
      const { data: affiliatesData, error: affiliatesError } = await supabase
        .from("affiliations")
        .select("product_id")
        .eq("status", "active");

      if (affiliatesError) throw affiliatesError;

      // Fetch checkout sessions for conversion rate calculation
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("checkout_sessions")
        .select("product_id, status");

      if (sessionsError) throw sessionsError;

      // Count sales per product
      const salesCountMap: Record<string, number> = {};
      salesData?.forEach((sale) => {
        salesCountMap[sale.product_id] = (salesCountMap[sale.product_id] || 0) + 1;
      });

      // Count affiliates per product
      const affiliatesCountMap: Record<string, number> = {};
      affiliatesData?.forEach((affiliation) => {
        affiliatesCountMap[affiliation.product_id] = (affiliatesCountMap[affiliation.product_id] || 0) + 1;
      });

      // Calculate conversion rate per product (approved sessions / total sessions * 100)
      const sessionsMap: Record<string, { total: number; approved: number }> = {};
      sessionsData?.forEach((session) => {
        if (!sessionsMap[session.product_id]) {
          sessionsMap[session.product_id] = { total: 0, approved: 0 };
        }
        sessionsMap[session.product_id].total += 1;
        if (session.status === "approved") {
          sessionsMap[session.product_id].approved += 1;
        }
      });

      // Map products with all stats
      const productsWithStats = (productsData || []).map((product) => {
        const sessionStats = sessionsMap[product.id] || { total: 0, approved: 0 };
        const conversionRate = sessionStats.total > 0 
          ? (sessionStats.approved / sessionStats.total) * 100 
          : 0;
        
        return {
          ...product,
          sales_count: salesCountMap[product.id] || 0,
          affiliates_count: affiliatesCountMap[product.id] || 0,
          conversion_rate: Math.round(conversionRate * 10) / 10,
        };
      });

      // Sort by sales count descending
      productsWithStats.sort((a, b) => b.sales_count - a.sales_count);

      setProducts(productsWithStats as MarketplaceProduct[]);
    } catch (error) {
      console.error("Error fetching marketplace products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAffiliations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("affiliations")
        .select("product_id, status")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserAffiliations((data as Affiliation[]) || []);
    } catch (error) {
      console.error("Error fetching user affiliations:", error);
    }
  };

  const handleAffiliate = async (product: MarketplaceProduct) => {
    setAffiliatingProduct(product);
  };

  const confirmAffiliation = async () => {
    if (!affiliatingProduct) return;

    setIsAffiliating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para se afiliar.",
          variant: "destructive",
        });
        return;
      }

      // IMPEDIR AUTOAFILIAÇÃO
      const { data: productOwner } = await supabase
        .from("products")
        .select("user_id")
        .eq("id", affiliatingProduct.id)
        .maybeSingle();

      if (productOwner && productOwner.user_id === user.id) {
        toast({
          title: "Ação não permitida",
          description: "Você não pode se afiliar ao seu próprio produto.",
          variant: "destructive",
        });
        setIsAffiliating(false);
        setAffiliatingProduct(null);
        return;
      }

      const affiliationStatus = affiliatingProduct.affiliate_auto_approve ? "active" : "pending";

      const { error } = await supabase.from("affiliations").insert({
        product_id: affiliatingProduct.id,
        user_id: user.id,
        status: affiliationStatus,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Já afiliado",
            description: "Você já está afiliado a este produto.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: affiliationStatus === "active" ? "Afiliação realizada!" : "Solicitação enviada!",
        description: affiliationStatus === "active" 
          ? `Você agora é afiliado de "${affiliatingProduct.name}".`
          : `Sua solicitação de afiliação para "${affiliatingProduct.name}" foi enviada e aguarda aprovação.`,
      });

      fetchUserAffiliations();
    } catch (error: any) {
      console.error("Error affiliating:", error);
      toast({
        title: "Erro ao se afiliar",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsAffiliating(false);
      setAffiliatingProduct(null);
    }
  };

  const getAffiliationStatus = (productId: string) => {
    const affiliation = userAffiliations.find(a => a.product_id === productId);
    if (!affiliation) return null;
    return affiliation.status;
  };

  const filteredAndSortedProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = selectedCategory === "Todos" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (selectedSort) {
        case "mais-quentes":
          return (b.sales_count || 0) - (a.sales_count || 0);
        case "recentes":
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "antigos":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case "mais-caros":
          return b.price - a.price;
        case "mais-baratos":
          return a.price - b.price;
        case "nome-az":
          return a.name.localeCompare(b.name);
        case "nome-za":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 bg-[#0a0d12] min-h-screen p-6 -m-6">
        {/* Search and Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Buscar produtos..." 
              className="pl-10 bg-[#161b22] border-gray-800 text-white placeholder:text-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px] bg-[#161b22] border-gray-700 text-white">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent className="bg-[#161b22] border-gray-700 z-50">
              {categories.map((cat) => (
                <SelectItem 
                  key={cat} 
                  value={cat}
                  className="text-white hover:bg-gray-800 focus:bg-gray-800 focus:text-white"
                >
                  {cat === "Todos" ? "Todas as categorias" : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedSort(option.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                selectedSort === option.value
                  ? "bg-[#161b22] text-white border border-gray-700"
                  : "text-gray-400 hover:text-white hover:bg-[#161b22]/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Header */}
        <MarketplaceHeader
          title={sortOptions.find(o => o.value === selectedSort)?.label || "Mais quentes"}
          subtitle="Todos os produtos"
          productCount={filteredAndSortedProducts.length}
        />

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : filteredAndSortedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAndSortedProducts.map((product) => (
              <MarketplaceProductCard
                key={product.id}
                product={product}
                affiliationStatus={getAffiliationStatus(product.id)}
                onAffiliate={() => handleAffiliate(product)}
                salesCount={product.sales_count || 0}
                affiliatesCount={product.affiliates_count || 0}
                conversionRate={product.conversion_rate || 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-[#161b22] flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum produto encontrado</h3>
            <p className="text-gray-500 text-sm max-w-md">
              {searchQuery || selectedCategory !== "Todos" 
                ? "Nenhum produto encontrado com os filtros selecionados."
                : "Ainda não há produtos disponíveis no marketplace. Volte em breve!"}
            </p>
          </div>
        )}

        {/* Affiliation Dialog */}
        <Dialog open={!!affiliatingProduct} onOpenChange={() => setAffiliatingProduct(null)}>
          <DialogContent className="bg-[#161b22] border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Confirmar Afiliação</DialogTitle>
              <DialogDescription className="text-gray-400">
                Você deseja se afiliar ao produto "{affiliatingProduct?.name}"?
              </DialogDescription>
            </DialogHeader>
            {affiliatingProduct && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-[#0d1117] border border-gray-800">
                  {affiliatingProduct.image_url ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden">
                      <img 
                        src={affiliatingProduct.image_url} 
                        alt={affiliatingProduct.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`p-3 rounded-xl ${affiliatingProduct.product_type === "digital" ? "bg-cyan-500/10" : "bg-purple-500/10"}`}>
                      {affiliatingProduct.product_type === "digital" ? (
                        <Monitor className="w-6 h-6 text-cyan-500" />
                      ) : (
                        <Box className="w-6 h-6 text-purple-500" />
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">{affiliatingProduct.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-green-400 text-sm font-medium">
                        {affiliatingProduct.commission_percentage || 0}% comissão
                      </span>
                      <span className="text-cyan-400 font-medium">
                        {formatCurrency(Number(affiliatingProduct.price))}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400">
                  Ao se afiliar, você receberá um link exclusivo para promover este produto e ganhará{" "}
                  <span className="text-green-400 font-medium">{affiliatingProduct.commission_percentage || 0}%</span>{" "}
                  de comissão por cada venda realizada.
                </p>
                
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => setAffiliatingProduct(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                    onClick={confirmAffiliation}
                    disabled={isAffiliating}
                  >
                    {isAffiliating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      "Confirmar Afiliação"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Marketplace;
