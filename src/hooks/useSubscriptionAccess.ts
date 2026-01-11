import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMemberAccessStatus } from "@/lib/enrollmentService";

interface SubscriptionAccess {
  hasAccess: boolean;
  accessType: "enrollment" | "subscription" | "none";
  status?: string;
  expiresAt?: string;
  reason?: string;
  loading: boolean;
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    amount: number;
    planInterval: string;
  } | null;
}

/**
 * Hook to check and monitor subscription-based access to a product's member area
 * Automatically syncs with subscription status changes
 */
export const useSubscriptionAccess = (productId: string | null): SubscriptionAccess => {
  const [access, setAccess] = useState<SubscriptionAccess>({
    hasAccess: false,
    accessType: "none",
    loading: true,
  });

  useEffect(() => {
    if (!productId) {
      setAccess({ hasAccess: false, accessType: "none", loading: false });
      return;
    }

    let mounted = true;

    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (mounted) {
            setAccess({ hasAccess: false, accessType: "none", loading: false, reason: "Usuário não autenticado" });
          }
          return;
        }

        // Get user email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", user.id)
          .single();

        const userEmail = profile?.email || user.email || "";

        // Check comprehensive access
        const accessStatus = await getMemberAccessStatus(userEmail, productId, user.id);

        // Get subscription details if exists
        let subscription = null;
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id, status, current_period_end, cancel_at_period_end, amount, plan_interval")
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData) {
          subscription = {
            id: subData.id,
            status: subData.status,
            currentPeriodEnd: subData.current_period_end,
            cancelAtPeriodEnd: subData.cancel_at_period_end,
            amount: subData.amount,
            planInterval: subData.plan_interval,
          };
        }

        if (mounted) {
          setAccess({
            hasAccess: accessStatus.hasAccess,
            accessType: accessStatus.accessType,
            status: accessStatus.status,
            expiresAt: accessStatus.expiresAt,
            reason: accessStatus.reason,
            loading: false,
            subscription,
          });
        }
      } catch (error) {
        console.error("Error checking subscription access:", error);
        if (mounted) {
          setAccess({
            hasAccess: false,
            accessType: "none",
            loading: false,
            reason: "Erro ao verificar acesso",
          });
        }
      }
    };

    checkAccess();

    // Subscribe to subscription changes
    const channel = supabase
      .channel(`subscription-access-${productId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `product_id=eq.${productId}`,
        },
        () => {
          checkAccess();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enrollments",
          filter: `product_id=eq.${productId}`,
        },
        () => {
          checkAccess();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [productId]);

  return access;
};

export default useSubscriptionAccess;
