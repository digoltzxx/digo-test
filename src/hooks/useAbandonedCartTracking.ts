import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CartData {
  productId: string;
  productName: string;
  amount: number;
  sellerUserId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/**
 * Hook para rastrear carrinhos abandonados
 * - Cria um registro quando o usuário entra no checkout
 * - Remove o registro se a compra for finalizada com sucesso
 * - Mantém o registro se o usuário sair sem comprar (carrinho abandonado)
 */
export const useAbandonedCartTracking = (cartData: CartData | null) => {
  const abandonedCartIdRef = useRef<string | null>(null);
  const hasCreatedRef = useRef(false);

  // Criar registro de carrinho abandonado
  const createAbandonedCart = useCallback(async () => {
    if (!cartData || hasCreatedRef.current) return;
    
    try {
      console.log('[AbandonedCart] Creating cart record for:', cartData.productId);
      
      const { data, error } = await supabase
        .from('abandoned_carts')
        .insert({
          product_id: cartData.productId,
          seller_user_id: cartData.sellerUserId,
          amount: cartData.amount,
          customer_name: cartData.customerName || null,
          customer_email: cartData.customerEmail || null,
          customer_phone: cartData.customerPhone || null,
          recovered: false,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[AbandonedCart] Error creating:', error);
        return;
      }

      if (data) {
        abandonedCartIdRef.current = data.id;
        hasCreatedRef.current = true;
        console.log('[AbandonedCart] Created with ID:', data.id);
        
        // Store in sessionStorage to persist across page navigation
        sessionStorage.setItem('abandoned_cart_id', data.id);
      }
    } catch (err) {
      console.error('[AbandonedCart] Exception:', err);
    }
  }, [cartData]);

  // Atualizar dados do cliente no carrinho
  const updateCustomerData = useCallback(async (
    name?: string, 
    email?: string, 
    phone?: string
  ) => {
    const cartId = abandonedCartIdRef.current || sessionStorage.getItem('abandoned_cart_id');
    if (!cartId) return;

    try {
      const updates: Record<string, string | null> = {};
      if (name) updates.customer_name = name;
      if (email) updates.customer_email = email;
      if (phone) updates.customer_phone = phone;
      
      if (Object.keys(updates).length === 0) return;

      await supabase
        .from('abandoned_carts')
        .update(updates)
        .eq('id', cartId);
        
      console.log('[AbandonedCart] Updated customer data');
    } catch (err) {
      console.error('[AbandonedCart] Error updating:', err);
    }
  }, []);

  // Remover carrinho quando compra for finalizada
  const removeAbandonedCart = useCallback(async () => {
    const cartId = abandonedCartIdRef.current || sessionStorage.getItem('abandoned_cart_id');
    if (!cartId) return;

    try {
      console.log('[AbandonedCart] Removing cart (purchase completed):', cartId);
      
      await supabase
        .from('abandoned_carts')
        .delete()
        .eq('id', cartId);
      
      abandonedCartIdRef.current = null;
      sessionStorage.removeItem('abandoned_cart_id');
      console.log('[AbandonedCart] Cart removed successfully');
    } catch (err) {
      console.error('[AbandonedCart] Error removing:', err);
    }
  }, []);

  // Marcar carrinho como recuperado
  const markAsRecovered = useCallback(async () => {
    const cartId = abandonedCartIdRef.current || sessionStorage.getItem('abandoned_cart_id');
    if (!cartId) return;

    try {
      console.log('[AbandonedCart] Marking as recovered:', cartId);
      
      await supabase
        .from('abandoned_carts')
        .update({ 
          recovered: true, 
          recovered_at: new Date().toISOString() 
        })
        .eq('id', cartId);
      
      abandonedCartIdRef.current = null;
      sessionStorage.removeItem('abandoned_cart_id');
      console.log('[AbandonedCart] Cart marked as recovered');
    } catch (err) {
      console.error('[AbandonedCart] Error marking recovered:', err);
    }
  }, []);

  // Criar carrinho quando cartData estiver disponível
  useEffect(() => {
    if (cartData && cartData.productId && cartData.sellerUserId) {
      createAbandonedCart();
    }
  }, [cartData, createAbandonedCart]);

  // Cleanup: Não remover ao desmontar - é exatamente quando queremos manter!
  // O registro só é removido via removeAbandonedCart() quando a compra é concluída

  return {
    updateCustomerData,
    removeAbandonedCart,
    markAsRecovered,
  };
};
