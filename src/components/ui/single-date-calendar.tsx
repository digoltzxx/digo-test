import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// Dias da semana em português (abreviados)
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Meses em português
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface SingleDateCalendarProps {
  /** Data selecionada */
  selectedDate?: Date | null;
  /** Callback quando uma data é selecionada - retorna no formato YYYY-MM-DD */
  onDateSelect?: (date: Date | null, formattedDate: string | null) => void;
  /** Desabilitar datas anteriores a hoje */
  disablePastDates?: boolean;
  /** Classes CSS adicionais */
  className?: string;
  /** Mostrar botão de limpar seleção */
  showClearButton?: boolean;
}

/**
 * Calendário de seleção única de data
 * 
 * Funcionalidades:
 * - Seleção de apenas um dia por vez
 * - Navegação por mês (setas)
 * - Destaque visual para dia atual e dia selecionado
 * - Suporte completo a PT-BR
 * - Retorna data no formato YYYY-MM-DD
 * - Opção para desabilitar datas passadas
 * - Botão para limpar seleção
 * - Acessibilidade (ARIA, navegação por teclado)
 * - Responsivo (desktop e mobile)
 */
export function SingleDateCalendar({
  selectedDate,
  onDateSelect,
  disablePastDates = false,
  className,
  showClearButton = true,
}: SingleDateCalendarProps) {
  // Mês sendo visualizado atualmente
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate || new Date());

  // Gera os dias do calendário para o mês atual
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth]);

  // Navegação entre meses
  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
  }, []);

  // Ir para hoje
  const goToToday = useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  // Handler de seleção de data
  const handleDateClick = useCallback((date: Date) => {
    // Se clicou na mesma data, não faz nada (ou poderia limpar)
    if (selectedDate && isSameDay(date, selectedDate)) {
      return;
    }

    // Formata a data no padrão YYYY-MM-DD
    const formattedDate = format(date, "yyyy-MM-dd");
    onDateSelect?.(date, formattedDate);
  }, [selectedDate, onDateSelect]);

  // Limpar seleção
  const handleClearSelection = useCallback(() => {
    onDateSelect?.(null, null);
  }, [onDateSelect]);

  // Verifica se uma data está desabilitada
  const isDateDisabled = useCallback((date: Date) => {
    if (disablePastDates) {
      return isBefore(startOfDay(date), startOfDay(new Date()));
    }
    return false;
  }, [disablePastDates]);

  // Navegação por teclado
  const handleKeyDown = useCallback((e: React.KeyboardEvent, date: Date) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isDateDisabled(date) && isSameMonth(date, currentMonth)) {
        handleDateClick(date);
      }
    }
  }, [currentMonth, handleDateClick, isDateDisabled]);

  return (
    <div
      className={cn(
        "w-full max-w-[320px] bg-card border border-border rounded-lg p-4 select-none",
        className
      )}
      role="application"
      aria-label="Calendário de seleção de data"
    >
      {/* Header: Navegação e mês/ano */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-foreground">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            type="button"
            onClick={goToToday}
            className="text-xs text-primary hover:underline mt-0.5"
          >
            Hoje
          </button>
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2" role="row">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground uppercase"
            role="columnheader"
            aria-label={day}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1" role="grid">
        {calendarDays.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isTodayDate = isToday(date);
          const isDisabled = isDateDisabled(date) || !isCurrentMonth;

          return (
            <button
              key={index}
              type="button"
              onClick={() => !isDisabled && handleDateClick(date)}
              onKeyDown={(e) => handleKeyDown(e, date)}
              disabled={isDisabled}
              tabIndex={isCurrentMonth && !isDateDisabled(date) ? 0 : -1}
              role="gridcell"
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              aria-label={format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-full text-sm font-medium transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                // Dias fora do mês atual
                !isCurrentMonth && "text-muted-foreground/30 cursor-default",
                // Dias do mês atual
                isCurrentMonth && !isSelected && !isTodayDate && "text-foreground hover:bg-muted cursor-pointer",
                // Dia atual (não selecionado)
                isTodayDate && !isSelected && "bg-primary/20 text-primary font-bold",
                // Dia selecionado
                isSelected && "bg-primary text-primary-foreground font-bold shadow-md",
                // Dias desabilitados
                isDisabled && isCurrentMonth && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer: Data selecionada e botão limpar */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <div className="text-sm">
          {selectedDate ? (
            <span className="text-foreground">
              <span className="text-muted-foreground">Selecionado: </span>
              <span className="font-medium">
                {format(selectedDate, "dd/MM/yyyy")}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nenhuma data selecionada</span>
          )}
        </div>
        
        {showClearButton && selectedDate && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Limpar seleção"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

// Exportar também como default para facilitar importação
export default SingleDateCalendar;
