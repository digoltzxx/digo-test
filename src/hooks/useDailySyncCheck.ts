import { useState, useEffect, useCallback } from "react";
import { format, startOfDay } from "date-fns";

const LAST_SYNC_DATE_KEY = "royalpay_last_sync_date";

interface UseDailySyncCheckReturn {
  lastSyncDate: string | null;
  needsReset: boolean;
  markSynced: () => void;
  currentDate: string;
}

/**
 * Hook para verificar e gerenciar sincronização diária dos dados do painel.
 * Detecta mudança de dia e sinaliza quando os dados precisam ser resetados.
 */
export function useDailySyncCheck(): UseDailySyncCheckReturn {
  const today = startOfDay(new Date());
  const currentDate = format(today, "yyyy-MM-dd");
  
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LAST_SYNC_DATE_KEY);
    }
    return null;
  });

  // Verificar se precisa de reset (data diferente ou nunca sincronizado)
  const needsReset = lastSyncDate !== currentDate;

  // Marcar como sincronizado para o dia atual
  const markSynced = useCallback(() => {
    localStorage.setItem(LAST_SYNC_DATE_KEY, currentDate);
    setLastSyncDate(currentDate);
  }, [currentDate]);

  // Verificar mudança de dia periodicamente (a cada 30 segundos)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = new Date();
      const nowDate = format(startOfDay(now), "yyyy-MM-dd");
      const stored = localStorage.getItem(LAST_SYNC_DATE_KEY);
      
      if (stored !== nowDate) {
        setLastSyncDate(stored);
      }
    }, 30000);

    // Verificar imediatamente ao montar (caso tenha ficado offline durante meia-noite)
    const stored = localStorage.getItem(LAST_SYNC_DATE_KEY);
    if (stored && stored !== currentDate) {
      console.log(`[DailySync] Detectada mudança de dia: ${stored} -> ${currentDate}`);
    }

    return () => clearInterval(checkInterval);
  }, [currentDate]);

  // Monitorar meia-noite em tempo real
  useEffect(() => {
    const scheduleNextMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      return setTimeout(() => {
        console.log("[DailySync] Meia-noite atingida - iniciando novo dia");
        setLastSyncDate(localStorage.getItem(LAST_SYNC_DATE_KEY));
        // Agendar próxima meia-noite
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    const timeoutId = scheduleNextMidnight();
    return () => clearTimeout(timeoutId);
  }, []);

  return {
    lastSyncDate,
    needsReset,
    markSynced,
    currentDate,
  };
}
