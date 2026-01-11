import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SaleStatus {
  id: string;
  status: string;
  amount: number;
  buyer_name: string;
  buyer_email: string;
  product_name?: string;
  created_at: string;
  updated_at: string;
}

interface UseSaleStatusPollingOptions {
  saleId: string | null;
  orderId?: string | null;
  transactionId?: string | null;
  enabled?: boolean;
  pollInterval?: number;
  maxPolls?: number;
  onStatusChange?: (newStatus: string, oldStatus: string) => void;
}

interface UseSaleStatusPollingReturn {
  status: SaleStatus | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
  pollCount: number;
  refetch: () => Promise<void>;
}

/**
 * Hook para monitorar status de uma venda com polling e realtime
 * 
 * Features:
 * - Polling automático enquanto status = pending
 * - Atualização via realtime quando status muda
 * - Fallback para API do gateway via edge function
 * - Cancelamento automático de requisições obsoletas
 */
export function useSaleStatusPolling({
  saleId,
  orderId,
  transactionId,
  enabled = true,
  pollInterval = 5000,
  maxPolls = 12, // 1 minuto com intervalos de 5s
  onStatusChange,
}: UseSaleStatusPollingOptions): UseSaleStatusPollingReturn {
  const [status, setStatus] = useState<SaleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  
  const requestIdRef = useRef(0);
  const previousStatusRef = useRef<string | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

  const checkStatus = useCallback(async () => {
    if (!saleId && !orderId && !transactionId) {
      setError("Nenhum identificador de transação fornecido");
      setLoading(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    
    try {
      // Build query params
      const params = new URLSearchParams();
      if (saleId) params.set("sale_id", saleId);
      if (orderId) params.set("order_id", orderId);
      if (transactionId) params.set("transaction_id", transactionId);

      console.log(`[SalePolling] Checking status (request ${currentRequestId}):`, params.toString());

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-transaction?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      // Check if this request is still current
      if (currentRequestId !== requestIdRef.current) {
        console.log(`[SalePolling] Request ${currentRequestId} obsolete, ignoring`);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const newStatus: SaleStatus = {
          id: result.sale_id,
          status: result.status,
          amount: result.amount,
          buyer_name: result.buyer_name,
          buyer_email: result.buyer_email,
          product_name: result.product_name,
          created_at: result.created_at,
          updated_at: new Date().toISOString(),
        };

        // Detect status change
        if (previousStatusRef.current && previousStatusRef.current !== newStatus.status) {
          console.log(`[SalePolling] Status changed: ${previousStatusRef.current} -> ${newStatus.status}`);
          onStatusChange?.(newStatus.status, previousStatusRef.current);
        }
        previousStatusRef.current = newStatus.status;

        setStatus(newStatus);
        setError(null);

        // Continue polling if still pending
        if (newStatus.status === "pending" && pollCount < maxPolls) {
          setIsPolling(true);
          setPollCount(prev => prev + 1);
        } else {
          setIsPolling(false);
        }
      } else {
        setError(result.error || "Transação não encontrada");
      }
    } catch (err: any) {
      // Only set error if request is still current
      if (currentRequestId === requestIdRef.current) {
        console.error("[SalePolling] Error:", err);
        setError(err.message || "Erro ao verificar transação");
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [saleId, orderId, transactionId, pollCount, maxPolls, onStatusChange]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;
    
    setLoading(true);
    setPollCount(0);
    requestIdRef.current = 0;
    previousStatusRef.current = null;
    
    checkStatus();
    
    return () => {
      // Cleanup: invalidate pending requests
      requestIdRef.current++;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [saleId, orderId, transactionId, enabled]);

  // Polling effect
  useEffect(() => {
    if (!isPolling || !enabled || loading) return;

    pollTimeoutRef.current = window.setTimeout(() => {
      checkStatus();
    }, pollInterval);

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [isPolling, enabled, loading, pollInterval, checkStatus]);

  // Realtime subscription for sale updates
  useEffect(() => {
    if (!saleId || !enabled) return;

    console.log(`[SalePolling] Setting up realtime for sale: ${saleId}`);

    const channel = supabase
      .channel(`sale-status-${saleId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `id=eq.${saleId}`,
        },
        (payload) => {
          console.log(`[SalePolling] Realtime update for sale ${saleId}:`, payload.new);
          
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          if (newRecord.status !== oldRecord.status) {
            console.log(`[SalePolling] Status changed via realtime: ${oldRecord.status} -> ${newRecord.status}`);
            onStatusChange?.(newRecord.status, oldRecord.status);
            
            // Update local state
            setStatus(prev => prev ? {
              ...prev,
              status: newRecord.status,
              updated_at: newRecord.updated_at,
            } : null);
            
            // Stop polling if no longer pending
            if (newRecord.status !== "pending") {
              setIsPolling(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log(`[SalePolling] Removing realtime channel for sale: ${saleId}`);
      supabase.removeChannel(channel);
    };
  }, [saleId, enabled, onStatusChange]);

  return {
    status,
    loading,
    error,
    isPolling,
    pollCount,
    refetch: checkStatus,
  };
}
