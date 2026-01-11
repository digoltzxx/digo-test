import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Subscription {
  id: string;
  status: string;
  plan_interval: string;
  amount: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface UseSubscriptionAccessResult {
  hasAccess: boolean;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSubscriptionAccess(productId: string | null): UseSubscriptionAccessResult {
  const [hasAccess, setHasAccess] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAccess = async () => {
    if (!productId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        setSubscription(null);
        return;
      }

      // Check subscription access
      const { data: accessData } = await supabase.rpc('check_subscription_access', {
        p_user_id: user.id,
        p_product_id: productId
      });

      setHasAccess(accessData || false);

      // Get active subscription details
      const { data: subData } = await supabase.rpc('get_active_subscription', {
        p_user_id: user.id,
        p_product_id: productId
      });

      if (subData && subData.length > 0) {
        setSubscription(subData[0] as Subscription);
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error('Error checking subscription access:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, [productId]);

  return {
    hasAccess,
    subscription,
    loading,
    error,
    refetch: checkAccess
  };
}

export function useUserSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscriptions([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          products:product_id (
            id,
            name,
            image_url,
            price
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSubscriptions(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const cancelSubscription = async (subscriptionId: string, cancelAtPeriodEnd = true) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: cancelAtPeriodEnd,
          canceled_at: new Date().toISOString(),
          ...(cancelAtPeriodEnd ? {} : { status: 'canceled' })
        })
        .eq('id', subscriptionId);

      if (error) throw error;

      await fetchSubscriptions();
      return { success: true };
    } catch (err) {
      console.error('Error canceling subscription:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  return {
    subscriptions,
    loading,
    error,
    refetch: fetchSubscriptions,
    cancelSubscription
  };
}
