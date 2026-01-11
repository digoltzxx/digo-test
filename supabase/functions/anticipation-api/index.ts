import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration constants - ONLY defined in backend
const ANTICIPATION_FEE_PERCENTAGE = 15.5;
const MINIMUM_ANTICIPATION_AMOUNT = 50.00;

interface AnticipationRequest {
  action: 'get_data' | 'process_anticipation';
  commission_ids?: string[];
}

interface EligibleCommission {
  id: string;
  sale_id: string;
  commission_amount: number;
  commission_percentage: number;
  role: string;
  status: string;
  created_at: string;
  sale_buyer_name: string | null;
  sale_amount: number | null;
  sale_date: string | null;
  product_name: string | null;
  // Calculated fields
  fee_amount: number;
  net_amount: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[anticipation-api] User: ${userId}, Method: ${req.method}`);

    // Parse request body
    let body: AnticipationRequest = { action: 'get_data' };
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = { action: 'get_data' };
      }
    }

    // =====================================================
    // GET DATA - Return anticipation dashboard data
    // =====================================================
    if (body.action === 'get_data' || req.method === 'GET') {
      console.log('[anticipation-api] Fetching anticipation data');

      // 1. Fetch eligible commissions (approved sales, not anticipated, status pending)
      const { data: commissions, error: commError } = await supabaseAdmin
        .from('sale_commissions')
        .select(`
          id,
          sale_id,
          commission_amount,
          commission_percentage,
          role,
          status,
          created_at,
          anticipated_at,
          sales!inner (
            id,
            buyer_name,
            amount,
            created_at,
            status,
            products (name)
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .is('anticipated_at', null)
        .gte('commission_amount', MINIMUM_ANTICIPATION_AMOUNT);

      if (commError) {
        console.error('Error fetching commissions:', commError);
        throw commError;
      }

      // Filter valid commissions and calculate fees
      // Only include commissions from approved sales (not refunded/cancelled)
      const eligibleCommissions: EligibleCommission[] = (commissions || [])
        .filter(c => {
          const sale = c.sales as any;
          return sale && 
                 ['paid', 'approved', 'completed', 'confirmed'].includes(sale.status);
        })
        .map(c => {
          const sale = c.sales as any;
          const feeAmount = Number((c.commission_amount * (ANTICIPATION_FEE_PERCENTAGE / 100)).toFixed(2));
          const netAmount = Number((c.commission_amount - feeAmount).toFixed(2));
          
          return {
            id: c.id,
            sale_id: c.sale_id,
            commission_amount: c.commission_amount,
            commission_percentage: c.commission_percentage,
            role: c.role,
            status: c.status,
            created_at: c.created_at,
            sale_buyer_name: sale?.buyer_name || null,
            sale_amount: sale?.amount || null,
            sale_date: sale?.created_at || null,
            product_name: sale?.products?.name || null,
            fee_amount: feeAmount,
            net_amount: netAmount
          };
        });

      // 2. Calculate total available
      const totalAvailable = eligibleCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

      // 3. Fetch completed anticipations
      const { data: anticipations, error: antError } = await supabaseAdmin
        .from('commission_anticipations')
        .select(`
          id,
          total_original_amount,
          total_anticipated_amount,
          fee_percentage,
          fee_amount,
          status,
          created_at,
          completed_at,
          anticipation_items (
            id,
            commission_id,
            original_amount,
            anticipated_amount,
            fee_amount
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (antError) {
        console.error('Error fetching anticipations:', antError);
      }

      // 4. Calculate anticipation stats
      const completedAnticipations = (anticipations || []).filter(a => a.status === 'completed');
      const totalAnticipated = completedAnticipations.reduce((sum, a) => sum + a.total_anticipated_amount, 0);
      const quantityAnticipations = completedAnticipations.length;

      // 5. Check for pending debts
      const { data: debts, error: debtsError } = await supabaseAdmin
        .from('anticipation_debts')
        .select('id, debt_amount, cleared_amount, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'partial']);

      if (debtsError) {
        console.error('Error fetching debts:', debtsError);
      }

      const totalDebts = (debts || []).reduce((sum, d) => sum + (d.debt_amount - d.cleared_amount), 0);
      const hasDebts = (debts || []).length > 0;

      // 6. Build response
      const response = {
        // Dashboard KPIs
        disponivel_antecipacao: Number(totalAvailable.toFixed(2)),
        taxa_antecipacao: ANTICIPATION_FEE_PERCENTAGE,
        minimo: MINIMUM_ANTICIPATION_AMOUNT,
        quantidade_antecipacoes: quantityAnticipations,
        total_antecipado: Number(totalAnticipated.toFixed(2)),
        
        // Debt info
        debitos_pendentes: Number(totalDebts.toFixed(2)),
        tem_debitos: hasDebts,
        
        // Available commissions (with calculated fees)
        comissoes: eligibleCommissions,
        
        // Anticipation history
        historico: anticipations || []
      };

      console.log(`[anticipation-api] Returning ${eligibleCommissions.length} eligible commissions, total: ${totalAvailable}`);

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // PROCESS ANTICIPATION - Create anticipation request
    // =====================================================
    if (body.action === 'process_anticipation') {
      const commissionIds = body.commission_ids || [];
      
      if (!commissionIds.length) {
        return new Response(
          JSON.stringify({ error: 'Selecione pelo menos uma comissão para antecipar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[anticipation-api] Processing anticipation for ${commissionIds.length} commissions`);

      // 1. Check for existing debts
      const { data: debts } = await supabaseAdmin
        .from('anticipation_debts')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['pending', 'partial'])
        .limit(1);

      if (debts && debts.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Você possui débitos pendentes. Regularize antes de solicitar nova antecipação.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Fetch and validate commissions
      const { data: commissions, error: commError } = await supabaseAdmin
        .from('sale_commissions')
        .select(`
          id,
          user_id,
          commission_amount,
          status,
          anticipated_at,
          sales!inner (
            id,
            status
          )
        `)
        .in('id', commissionIds)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .is('anticipated_at', null);

      if (commError) {
        console.error('Error fetching commissions for validation:', commError);
        throw commError;
      }

      // Validate all commissions belong to user and are eligible
      if (!commissions || commissions.length !== commissionIds.length) {
        return new Response(
          JSON.stringify({ error: 'Uma ou mais comissões selecionadas não estão disponíveis para antecipação' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate all sales are approved
      const invalidCommissions = commissions.filter(c => {
        const sale = c.sales as any;
        return !sale || 
               !['paid', 'approved', 'completed', 'confirmed'].includes(sale.status);
      });

      if (invalidCommissions.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Algumas comissões pertencem a vendas não aprovadas ou reembolsadas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Calculate totals (ALWAYS on backend)
      const totalOriginal = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
      const feeAmount = Number((totalOriginal * (ANTICIPATION_FEE_PERCENTAGE / 100)).toFixed(2));
      const totalAnticipated = Number((totalOriginal - feeAmount).toFixed(2));

      // Validate minimum amount
      if (totalOriginal < MINIMUM_ANTICIPATION_AMOUNT) {
        return new Response(
          JSON.stringify({ 
            error: `Valor mínimo para antecipação: R$ ${MINIMUM_ANTICIPATION_AMOUNT.toFixed(2)}. Valor selecionado: R$ ${totalOriginal.toFixed(2)}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Generate idempotency key
      const sortedIds = [...commissionIds].sort().join('_');
      const idempotencyKey = `ant_${userId}_${sortedIds}`;

      // Check for duplicate request
      const { data: existingAnt } = await supabaseAdmin
        .from('commission_anticipations')
        .select('id, status')
        .eq('user_id', userId)
        .contains('metadata', { idempotency_key: idempotencyKey })
        .limit(1);

      if (existingAnt && existingAnt.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Esta solicitação de antecipação já foi processada' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 5. Create anticipation record
      const { data: anticipation, error: createError } = await supabaseAdmin
        .from('commission_anticipations')
        .insert({
          user_id: userId,
          total_original_amount: totalOriginal,
          total_anticipated_amount: totalAnticipated,
          fee_percentage: ANTICIPATION_FEE_PERCENTAGE,
          fee_amount: feeAmount,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating anticipation:', createError);
        throw createError;
      }

      console.log(`[anticipation-api] Created anticipation: ${anticipation.id}`);

      // 6. Create anticipation items
      const items = commissions.map(c => ({
        anticipation_id: anticipation.id,
        commission_id: c.id,
        original_amount: c.commission_amount,
        fee_amount: Number((c.commission_amount * (ANTICIPATION_FEE_PERCENTAGE / 100)).toFixed(2)),
        anticipated_amount: Number((c.commission_amount * (1 - ANTICIPATION_FEE_PERCENTAGE / 100)).toFixed(2))
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('anticipation_items')
        .insert(items);

      if (itemsError) {
        console.error('Error creating anticipation items:', itemsError);
        // Rollback anticipation
        await supabaseAdmin.from('commission_anticipations').delete().eq('id', anticipation.id);
        throw itemsError;
      }

      // 7. Mark commissions as anticipated
      const { error: updateError } = await supabaseAdmin
        .from('sale_commissions')
        .update({
          anticipated_at: new Date().toISOString(),
          anticipation_id: anticipation.id,
          status: 'anticipated',
          updated_at: new Date().toISOString()
        })
        .in('id', commissionIds);

      if (updateError) {
        console.error('Error updating commissions:', updateError);
        // Rollback
        await supabaseAdmin.from('anticipation_items').delete().eq('anticipation_id', anticipation.id);
        await supabaseAdmin.from('commission_anticipations').delete().eq('id', anticipation.id);
        throw updateError;
      }

      // 8. Credit balance to user (record balance movement)
      const { error: balanceError } = await supabaseAdmin
        .from('balance_history')
        .insert({
          user_id: userId,
          movement_type: 'credit',
          amount: totalAnticipated,
          balance_before: 0, // Will be calculated by trigger/function
          balance_after: totalAnticipated,
          reference_type: 'anticipation',
          reference_id: anticipation.id,
          description: `Antecipação de ${commissions.length} comissão(ões) - Taxa ${ANTICIPATION_FEE_PERCENTAGE}%`
        });

      if (balanceError) {
        console.error('Error recording balance:', balanceError);
        // Continue - balance can be reconciled later
      }

      // 9. Log audit
      await supabaseAdmin
        .from('financial_audit_logs')
        .insert({
          user_id: userId,
          action_taken: 'ANTICIPATION_COMPLETED',
          entity_type: 'commission_anticipations',
          entity_id: anticipation.id,
          status_received: 'completed',
          status_allowed: true,
          amount: totalAnticipated,
          metadata: {
            original_amount: totalOriginal,
            fee_amount: feeAmount,
            fee_percentage: ANTICIPATION_FEE_PERCENTAGE,
            commissions_count: commissions.length,
            commission_ids: commissionIds
          },
          source: 'anticipation-api',
          reason: 'Antecipação de comissões processada'
        });

      console.log(`[anticipation-api] Anticipation completed: ${anticipation.id}, net: ${totalAnticipated}`);

      return new Response(
        JSON.stringify({
          success: true,
          anticipation_id: anticipation.id,
          total_original: totalOriginal,
          fee_percentage: ANTICIPATION_FEE_PERCENTAGE,
          fee_amount: feeAmount,
          total_anticipated: totalAnticipated,
          commissions_count: commissions.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalid action
    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[anticipation-api] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
