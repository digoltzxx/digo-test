import { useState } from "react";
import { Monitor, Box, Check, Clock, ShoppingBag, Tag, Percent, Eye, TrendingUp, Users, PlayCircle, User, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ProductRating from "./ProductRating";

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
}

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  affiliationStatus: string | null;
  onAffiliate: () => void;
  salesCount: number;
  affiliatesCount: number;
  conversionRate: number;
}

const MarketplaceProductCard = ({
  product,
  affiliationStatus,
  onAffiliate,
  salesCount,
  affiliatesCount,
  conversionRate,
}: MarketplaceProductCardProps) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Simulated data for rating - in production would come from reviews table
  const rating = Math.random() > 0.3 ? Math.floor(Math.random() * 5) + 1 : 0;
  const reviewCount = rating > 0 ? Math.floor(Math.random() * 10) : 0;
  
  const commissionValue = product.commission_percentage 
    ? (product.price * (product.commission_percentage / 100))
    : 0;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = () => {
    if (!product.commission_percentage) {
      return (
        <div className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-800/80 border border-gray-600/50">
          <span className="text-gray-400 text-sm font-medium">Sem afiliação</span>
        </div>
      );
    }
    return null;
  };

  const handleCardClick = () => {
    setIsDetailOpen(true);
  };

  return (
    <>
      <div 
        className="group relative bg-[#0d1117] rounded-xl border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Gradient border effect on hover */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        {/* Click indicator */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm">
            <Eye className="w-4 h-4 text-white" />
          </div>
        </div>
        
        {/* Product Image */}
        <div className="relative aspect-[16/10] bg-[#161b22] overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1f26] to-[#0d1117]">
              {product.product_type === "digital" ? (
                <Monitor className="w-16 h-16 text-gray-600" />
              ) : (
                <Box className="w-16 h-16 text-gray-600" />
              )}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="text-white font-medium text-sm line-clamp-2 min-h-[40px]">
            {product.name}
          </h3>

          {/* Rating */}
          <ProductRating rating={rating} reviewCount={reviewCount} />

          {/* Commission Info */}
          {product.commission_percentage && (
            <div className="space-y-1">
              <p className="text-gray-400 text-sm">Comissão: {product.commission_percentage}%</p>
              <p className="text-green-400 text-2xl font-bold">
                {formatCurrency(commissionValue)}
              </p>
            </div>
          )}

          {/* Status Badge */}
          <div>
            {getStatusBadge()}
          </div>

          {/* Recent Sales */}
          <div className="flex items-center gap-1.5 text-gray-500 text-xs pt-2 border-t border-gray-800">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{salesCount} vendas recentes</span>
          </div>

          {/* Affiliate Button - only show if not affiliated */}
          {!affiliationStatus && product.commission_percentage && (
            <Button
              size="sm"
              className="w-full mt-2 bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onAffiliate();
              }}
            >
              Afiliar-se
            </Button>
          )}
        </div>
      </div>

      {/* Product Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Product Image */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#0d1117]">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {product.product_type === "digital" ? (
                    <Monitor className="w-24 h-24 text-gray-600" />
                  ) : (
                    <Box className="w-24 h-24 text-gray-600" />
                  )}
                </div>
              )}
            </div>

            {/* Product Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Tag className="w-3.5 h-3.5" />
                  Preço
                </div>
                <p className="text-cyan-400 font-bold">{formatCurrency(product.price)}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Percent className="w-3.5 h-3.5" />
                  Comissão
                </div>
                <p className="text-green-400 font-bold">{product.commission_percentage || 0}%</p>
              </div>
              
              <div className="p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Conversão
                </div>
                <p className="text-purple-400 font-bold">{conversionRate}%</p>
              </div>
              
              <div className="p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Users className="w-3.5 h-3.5" />
                  Afiliados
                </div>
                <p className="text-blue-400 font-bold">{affiliatesCount}</p>
              </div>
            </div>

            {/* Características */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Características</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                  <PlayCircle className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Tipo de conteúdo</p>
                    <p className="text-white text-sm font-medium">
                      {product.product_type === "digital" ? "Curso online" : "Produto Físico"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                  <User className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Produtor</p>
                    <p className="text-white text-sm font-medium">{product.sac_name || "Não informado"}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                  <Tag className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Categoria</p>
                    <p className="text-white text-sm font-medium">{product.category}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                  <CreditCard className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Tipo de pagamento</p>
                    <p className="text-white text-sm font-medium">Pagamento único</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                  <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Material para divulgação</p>
                    <p className="text-white text-sm font-medium">Não</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Descrição</h4>
              <p className="text-gray-400 text-sm leading-relaxed">
                {product.description || "Este produto ainda não possui uma descrição detalhada."}
              </p>
            </div>

            {/* Sales Info */}
            <div className="flex items-center justify-between text-sm text-gray-400 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>{salesCount} vendas recentes</span>
              </div>
              <ProductRating rating={rating} reviewCount={reviewCount} />
            </div>

            {/* Status Actions - New Design */}
            <div className="flex gap-2 pt-2">
              {affiliationStatus === "pending" && (
                <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-semibold">Pendente</span>
                </div>
              )}
              
              {affiliationStatus === "active" && (
                <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-green-500/50 bg-green-500/10">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-semibold">Afiliado</span>
                </div>
              )}

              {!affiliationStatus && product.commission_percentage && (
                <Button 
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-3"
                  onClick={() => {
                    setIsDetailOpen(false);
                    onAffiliate();
                  }}
                >
                  Afiliar-se Agora
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="px-6 border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => setIsDetailOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MarketplaceProductCard;
