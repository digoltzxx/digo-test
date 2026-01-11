import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  getDaysInMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CurrentMonthCalendarProps {
  /** Eventos ou destaques por data (chave: 'YYYY-MM-DD') */
  events?: Record<string, { count?: number; type?: 'success' | 'warning' | 'info' | 'error' }>;
  /** Callback quando uma data é selecionada */
  onDateSelect?: (date: Date) => void;
  /** Data selecionada */
  selectedDate?: Date;
  /** Classe CSS adicional */
  className?: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CurrentMonthCalendar({
  events = {},
  onDateSelect,
  selectedDate,
  className
}: CurrentMonthCalendarProps) {
  // Estado com a data atual do sistema
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  // Atualizar automaticamente à meia-noite ou quando o mês mudar
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      // Se o mês ou ano mudou, atualiza
      if (
        now.getMonth() !== currentDate.getMonth() ||
        now.getFullYear() !== currentDate.getFullYear()
      ) {
        setCurrentDate(now);
      }
    };

    // Verificar a cada minuto se a data mudou
    const interval = setInterval(checkDateChange, 60000);
    
    // Também verificar quando a janela ganha foco (usuário voltou)
    const handleFocus = () => checkDateChange();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentDate]);

  // Calcular os dias do mês atual
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Informações do mês
  const monthInfo = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const monthName = format(currentDate, 'MMMM', { locale: ptBR });
    const year = format(currentDate, 'yyyy');
    const isLeapYear = (year: number) => {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    };
    
    return {
      daysInMonth,
      monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      year,
      isLeapYear: isLeapYear(currentDate.getFullYear())
    };
  }, [currentDate]);

  const handleDateClick = useCallback((date: Date) => {
    if (isSameMonth(date, currentDate) && onDateSelect) {
      onDateSelect(date);
    }
  }, [currentDate, onDateSelect]);

  const getEventInfo = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return events[key];
  };

  return (
    <div className={cn("bg-card rounded-lg border p-4", className)}>
      {/* Header do calendário */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {monthInfo.monthName} {monthInfo.year}
          </h3>
          <p className="text-xs text-muted-foreground">
            {monthInfo.daysInMonth} dias
            {monthInfo.isLeapYear && currentDate.getMonth() === 1 && ' (ano bissexto)'}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Hoje: {format(new Date(), 'dd/MM', { locale: ptBR })}
        </Badge>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Dias do mês */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const eventInfo = getEventInfo(date);
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              disabled={!isCurrentMonth}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-md text-sm transition-colors",
                // Dias do mês atual
                isCurrentMonth && "hover:bg-accent cursor-pointer",
                // Dias de outros meses (ocultos/esmaecidos)
                !isCurrentMonth && "text-muted-foreground/30 cursor-not-allowed opacity-30",
                // Hoje
                isTodayDate && isCurrentMonth && "bg-primary text-primary-foreground font-bold",
                // Selecionado
                isSelected && isCurrentMonth && !isTodayDate && "bg-accent border-2 border-primary",
                // Com eventos
                eventInfo && isCurrentMonth && !isTodayDate && !isSelected && "bg-muted"
              )}
            >
              <span>{format(date, 'd')}</span>
              
              {/* Indicador de evento */}
              {eventInfo && isCurrentMonth && (
                <div className={cn(
                  "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                  eventInfo.type === 'success' && "bg-green-500",
                  eventInfo.type === 'warning' && "bg-yellow-500",
                  eventInfo.type === 'error' && "bg-red-500",
                  eventInfo.type === 'info' && "bg-blue-500",
                  !eventInfo.type && "bg-primary"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded bg-primary" />
          <span>Hoje</span>
        </div>
        {Object.keys(events).length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Com eventos</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CurrentMonthCalendar;
