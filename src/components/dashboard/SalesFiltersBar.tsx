import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";
import { ProductOption } from "@/hooks/useAllPeriodsSalesStats";

interface SalesFiltersBarProps {
  productId?: string;
  paymentMethod?: string;
  products: ProductOption[];
  hasActiveFilters: boolean;
  onProductChange: (productId: string | undefined) => void;
  onPaymentMethodChange: (method: string | undefined) => void;
  onClearFilters: () => void;
}

const SalesFiltersBar = ({
  productId,
  paymentMethod,
  products,
  hasActiveFilters,
  onProductChange,
  onPaymentMethodChange,
  onClearFilters,
}: SalesFiltersBarProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filtros:</span>
      </div>

      {/* Filtro por produto */}
      <Select
        value={productId || "all"}
        onValueChange={(value) => onProductChange(value === "all" ? undefined : value)}
      >
        <SelectTrigger className="w-[200px] bg-muted/30 border-border h-9">
          <SelectValue placeholder="Todos os produtos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os produtos</SelectItem>
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro por forma de pagamento */}
      <Select
        value={paymentMethod || "all"}
        onValueChange={(value) => onPaymentMethodChange(value === "all" ? undefined : value)}
      >
        <SelectTrigger className="w-[160px] bg-muted/30 border-border h-9">
          <SelectValue placeholder="Pagamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pix">PIX</SelectItem>
          <SelectItem value="credit_card">Cartão de crédito</SelectItem>
          <SelectItem value="boleto">Boleto</SelectItem>
        </SelectContent>
      </Select>

      {/* Limpar filtros */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
};

export default SalesFiltersBar;
