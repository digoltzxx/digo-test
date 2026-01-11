import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Commission {
  id: string;
  sale_id: string;
  user_id: string;
  role: "producer" | "coproducer" | "affiliate";
  commission_type: string;
  commission_percentage: number;
  commission_amount: number;
  sale_amount: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  // Joined data
  product_name?: string;
  buyer_name?: string;
  buyer_email?: string;
}

interface CommissionSummary {
  total_earned: number;
  total_pending: number;
  total_sales: number;
  this_month: number;
}

export function useCoProducerCommissions(userId?: string) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    total_earned: 0,
    total_pending: 0,
    total_sales: 0,
    this_month: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user if not provided
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }

      if (!targetUserId) {
        setError("Usuário não autenticado");
        return;
      }

      // Fetch commissions
      const { data, error: fetchError } = await supabase
        .from("sale_commissions")
        .select(`
          *,
          sale:sales(
            id,
            buyer_name,
            buyer_email,
            product:products(name)
          )
        `)
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data
      const transformedData: Commission[] = (data || []).map((c: any) => ({
        ...c,
        product_name: c.sale?.product?.name,
        buyer_name: c.sale?.buyer_name,
        buyer_email: c.sale?.buyer_email,
      }));

      setCommissions(transformedData);

      // Calculate summary
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalEarned = transformedData
        .filter(c => c.status === "paid")
        .reduce((acc, c) => acc + c.commission_amount, 0);

      const totalPending = transformedData
        .filter(c => c.status === "pending")
        .reduce((acc, c) => acc + c.commission_amount, 0);

      const thisMonth = transformedData
        .filter(c => c.status === "paid" && new Date(c.created_at) >= startOfMonth)
        .reduce((acc, c) => acc + c.commission_amount, 0);

      setSummary({
        total_earned: totalEarned,
        total_pending: totalPending,
        total_sales: transformedData.length,
        this_month: thisMonth,
      });

    } catch (err) {
      console.error("Error fetching commissions:", err);
      setError("Erro ao carregar comissões");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [userId]);

  return {
    commissions,
    summary,
    loading,
    error,
    refetch: fetchCommissions,
  };
}

export function useProductCommissions(productId: string) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all commissions for sales of this product
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id")
        .eq("product_id", productId);

      if (salesError) throw salesError;

      if (!sales || sales.length === 0) {
        setCommissions([]);
        return;
      }

      const saleIds = sales.map(s => s.id);

      const { data, error: fetchError } = await supabase
        .from("sale_commissions")
        .select(`
          *,
          sale:sales(
            id,
            buyer_name,
            buyer_email,
            product:products(name)
          )
        `)
        .in("sale_id", saleIds)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const transformedData: Commission[] = (data || []).map((c: any) => ({
        ...c,
        product_name: c.sale?.product?.name,
        buyer_name: c.sale?.buyer_name,
        buyer_email: c.sale?.buyer_email,
      }));

      setCommissions(transformedData);

    } catch (err) {
      console.error("Error fetching product commissions:", err);
      setError("Erro ao carregar comissões do produto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchCommissions();
    }
  }, [productId]);

  return {
    commissions,
    loading,
    error,
    refetch: fetchCommissions,
  };
}
