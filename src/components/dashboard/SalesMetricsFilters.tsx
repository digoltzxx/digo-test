import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Filter, X } from "lucide-react";
import { SalesPeriod, ProductOption } from "@/hooks/usePeriodSalesStats";

interface SalesMetricsFiltersProps {
  period: SalesPeriod;
  productId?: string;
  paymentMethod?: string;
  products: ProductOption[];
  onPeriodChange: (period: SalesPeriod) => void;
  onProductChange: (productId: string | undefined) => void;
  onPaymentMethodChange: (method: string | undefined) => void;
  onClearFilters: () => void;
}

const SalesMetricsFilters = ({
  period,
  productId,
  paymentMethod,
  products,
  onPeriodChange,
  onProductChange,
  onPaymentMethodChange,
  onClearFilters,
}: SalesMetricsFiltersProps) => {
  const hasActiveFilters = productId || paymentMethod;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Seletor de período */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
        <Button
          variant={period === "day" ? "default" : "ghost"}
          size="sm"
          onClick={() => onPeriodChange("day")}
          className="h-8 px-3"
        >
          Dia
        </Button>
        <Button
          variant={period === "week" ? "default" : "ghost"}
          size="sm"
          onClick={() => onPeriodChange("week")}
          className="h-8 px-3"
        >
          Semana
        </Button>
        <Button
          variant={period === "month" ? "default" : "ghost"}
          size="sm"
          onClick={() => onPeriodChange("month")}
          className="h-8 px-3"
        >
          Mês
        </Button>
      </div>

      {/* Filtro por produto */}
      <Select
        value={productId || "all"}
        onValueChange={(value) => onProductChange(value === "all" ? undefined : value)}
      >
        <SelectTrigger className="w-[180px] bg-muted/30 border-border h-9">
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
        <SelectTrigger className="w-[140px] bg-muted/30 border-border h-9">
          <SelectValue placeholder="Pagamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pix">PIX</SelectItem>
          <SelectItem value="credit_card">Cartão</SelectItem>
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
          Limpar
        </Button>
      )}
    </div>
  );
};

export default SalesMetricsFilters;
