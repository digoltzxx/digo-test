import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentSplit {
  id: string;
  sale_id: string;
  user_id: string;
  role: "producer" | "coproducer" | "affiliate" | "platform";
  gross_amount: number;
  net_amount: number;
  fee_amount: number;
  platform_fee: number;
  split_percentage: number;
  status: string;
  processed_at: string | null;
  transferred_at: string | null;
  created_at: string;
  sale?: {
    id: string;
    buyer_name: string;
    amount: number;
    status: string;
    created_at: string;
    product?: {
      name: string;
    };
  };
}

export interface SplitSummary {
  totalGross: number;
  totalNet: number;
  totalFees: number;
  totalPlatformFees: number;
  pendingCount: number;
  processedCount: number;
  transferredCount: number;
}

export function usePaymentSplits(productId?: string) {
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [summary, setSummary] = useState<SplitSummary>({
    totalGross: 0,
    totalNet: 0,
    totalFees: 0,
    totalPlatformFees: 0,
    pendingCount: 0,
    processedCount: 0,
    transferredCount: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchSplits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("payment_splits")
        .select(`
          *,
          sales:sale_id (
            id,
            buyer_name,
            amount,
            status,
            created_at,
            products:product_id (
              name
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (productId) {
        // Filter by product - need to join with sales
        query = query.eq("sales.product_id", productId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedSplits = (data || []).map(split => ({
        ...split,
        sale: split.sales ? {
          id: (split.sales as any).id,
          buyer_name: (split.sales as any).buyer_name,
          amount: (split.sales as any).amount,
          status: (split.sales as any).status,
          created_at: (split.sales as any).created_at,
          product: (split.sales as any).products
        } : undefined
      })) as PaymentSplit[];

      setSplits(formattedSplits);

      // Calculate summary
      const newSummary: SplitSummary = {
        totalGross: 0,
        totalNet: 0,
        totalFees: 0,
        totalPlatformFees: 0,
        pendingCount: 0,
        processedCount: 0,
        transferredCount: 0
      };

      formattedSplits.forEach(split => {
        newSummary.totalGross += split.gross_amount;
        newSummary.totalNet += split.net_amount;
        newSummary.totalFees += split.fee_amount;
        newSummary.totalPlatformFees += split.platform_fee;
        
        if (split.status === "pending") newSummary.pendingCount++;
        else if (split.status === "processed") newSummary.processedCount++;
        else if (split.status === "transferred") newSummary.transferredCount++;
      });

      setSummary(newSummary);
    } catch (error) {
      console.error("Error fetching payment splits:", error);
    }
  }, [productId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSplits();
      setLoading(false);
    };

    loadData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("payment-splits-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_splits" },
        () => fetchSplits()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSplits]);

  return {
    splits,
    summary,
    loading,
    refetch: fetchSplits
  };
}