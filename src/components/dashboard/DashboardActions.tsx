import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Package, CreditCard, Link2, X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const DashboardActions = () => {
  const navigate = useNavigate();
  const { dateRange, setDateRange, isFiltered, clearFilter, isTodayView, selectedDateString } = useDateFilter();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const productActions = [
    { 
      icon: Package, 
      label: "Novo Produto Digital", 
      action: () => navigate("/dashboard/produtos?action=new-digital"),
      description: "Infoprodutos, cursos, e-books"
    },
    { 
      icon: CreditCard, 
      label: "Nova Assinatura", 
      action: () => navigate("/dashboard/assinaturas?action=new"),
      description: "Planos recorrentes"
    },
    { 
      icon: Link2, 
      label: "Checkout Rápido", 
      action: () => navigate("/dashboard/produtos?action=checkout"),
      description: "Link de pagamento simples"
    },
  ];

  const formatDateRange = () => {
    if (!dateRange?.from) return "Selecionar período";
    
    const fromFormatted = format(dateRange.from, "dd MMM yyyy", { locale: ptBR });
    
    // Single day selection
    if (!dateRange.to || isSameDay(dateRange.from, dateRange.to)) {
      if (isTodayView) return "Hoje";
      return fromFormatted;
    }
    
    const toFormatted = format(dateRange.to, "dd MMM yyyy", { locale: ptBR });
    return `${fromFormatted} - ${toFormatted}`;
  };

  // Handle single day selection with proper range
  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && !range.to) {
      // Single day selected - set full day range
      const fullDayRange: DateRange = {
        from: startOfDay(range.from),
        to: endOfDay(range.from),
      };
      setDateRange(fullDayRange);
      console.log(`[Calendar] Dia selecionado: ${format(range.from, "yyyy-MM-dd")}`);
    } else if (range?.from && range.to) {
      // Range selected
      const normalizedRange: DateRange = {
        from: startOfDay(range.from),
        to: endOfDay(range.to),
      };
      setDateRange(normalizedRange);
      console.log(`[Calendar] Período selecionado: ${format(range.from, "yyyy-MM-dd")} - ${format(range.to, "yyyy-MM-dd")}`);
    } else {
      setDateRange(range);
    }
  };

  const handleSelectToday = () => {
    const today = new Date();
    const todayRange: DateRange = {
      from: startOfDay(today),
      to: endOfDay(today),
    };
    setDateRange(todayRange);
    setIsCalendarOpen(false);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Products Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-accent/10 border-accent/30 text-accent hover:bg-accent/20 hover:text-accent"
          >
            <Plus className="w-4 h-4" />
            Produtos
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {productActions.map((item) => (
            <DropdownMenuItem 
              key={item.label}
              onClick={item.action}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-accent/10 mt-0.5">
                <item.icon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date Range Picker */}
      <div className="flex items-center gap-1">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "gap-2 min-w-[200px] justify-start border-border/50 hover:border-accent/50",
                isFiltered && !isTodayView && "border-accent/50 bg-accent/5"
              )}
            >
              <Calendar className="w-4 h-4 text-accent" />
              <span className="text-sm">{formatDateRange()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-2 border-b border-border/50">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "w-full justify-start gap-2",
                  isTodayView && "bg-accent/10 text-accent"
                )}
                onClick={handleSelectToday}
              >
                <Check className={cn("w-4 h-4", isTodayView ? "opacity-100" : "opacity-0")} />
                Hoje
              </Button>
            </div>
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={1}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        
        {isFiltered && !isTodayView && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleSelectToday}
            title="Voltar para hoje"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default DashboardActions;
