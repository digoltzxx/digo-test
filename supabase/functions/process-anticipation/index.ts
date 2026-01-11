import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnticipationRequest {
  commission_ids: string[];
  user_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AnticipationRequest = await req.json();
    const { commission_ids } = body;

    if (!commission_ids || commission_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "No commissions selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ANTICIPATION] Processing anticipation for user ${user.id} with ${commission_ids.length} commissions`);

    // ============================================================
    // 1. CHECK FOR PENDING DEBTS
    // ============================================================
    const { data: pendingDebts, error: debtsError } = await supabase
      .from("anticipation_debts")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "partial"]);

    if (debtsError) {
      console.error("[ANTICIPATION] Error checking debts:", debtsError);
      throw debtsError;
    }

    if (pendingDebts && pendingDebts.length > 0) {
      const totalDebt = pendingDebts.reduce((sum, d) => sum + (d.debt_amount - d.cleared_amount), 0);
      
      // Log the blocked attempt
      await supabase.from("anticipation_logs").insert({
        user_id: user.id,
        action: "anticipation_blocked_debt",
        details: { 
          pending_debts: pendingDebts.length, 
          total_debt: totalDebt,
          commission_ids 
        }
      });

      return new Response(
        JSON.stringify({ 
          error: "Você possui débitos pendentes de antecipações anteriores. Regularize antes de solicitar nova antecipação.",
          code: "PENDING_DEBTS",
          total_debt: totalDebt
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 2. FETCH AND VALIDATE COMMISSIONS
    // ============================================================
    const { data: commissions, error: commissionsError } = await supabase
      .from("sale_commissions")
      .select(`
        *,
        sales:sale_id (
          id,
          status,
          refunded_at
        )
      `)
      .in("id", commission_ids)
      .eq("user_id", user.id);

    if (commissionsError) {
      console.error("[ANTICIPATION] Error fetching commissions:", commissionsError);
      throw commissionsError;
    }

    if (!commissions || commissions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma comissão encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each commission
    const validCommissions: typeof commissions = [];
    const invalidReasons: string[] = [];

    for (const commission of commissions) {
      // Check if commission is available (not anticipated or paid)
      if (commission.status !== 'pending' && commission.status !== 'paid') {
        invalidReasons.push(`Comissão ${commission.id.slice(0, 8)} já foi processada (status: ${commission.status})`);
        continue;
      }

      // Check if already anticipated
      if (commission.anticipated_at) {
        invalidReasons.push(`Comissão ${commission.id.slice(0, 8)} já foi antecipada`);
        continue;
      }

      // Check if sale is refunded
      if (commission.sales?.refunded_at) {
        invalidReasons.push(`Comissão ${commission.id.slice(0, 8)} está vinculada a venda reembolsada`);
        continue;
      }

      // Check if sale is approved/paid
      if (!commission.sales || !['paid', 'approved', 'completed'].includes(commission.sales.status)) {
        invalidReasons.push(`Comissão ${commission.id.slice(0, 8)} está vinculada a venda não aprovada`);
        continue;
      }

      validCommissions.push(commission);
    }

    if (validCommissions.length === 0) {
      await supabase.from("anticipation_logs").insert({
        user_id: user.id,
        action: "anticipation_validation_failed",
        details: { reasons: invalidReasons, commission_ids }
      });

      return new Response(
        JSON.stringify({ 
          error: "Nenhuma comissão válida para antecipação",
          reasons: invalidReasons
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 3. GET ANTICIPATION FEE SETTINGS
    // ============================================================
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["anticipation_fee_percentage", "anticipation_min_amount"]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value; });

    const feePercentage = parseFloat(settingsMap["anticipation_fee_percentage"] || "3.5");
    const minAmount = parseFloat(settingsMap["anticipation_min_amount"] || "50");

    // ============================================================
    // 4. CALCULATE TOTALS
    // ============================================================
    const totalOriginalAmount = validCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
    
    if (totalOriginalAmount < minAmount) {
      return new Response(
        JSON.stringify({ 
          error: `Valor mínimo para antecipação é R$ ${minAmount.toFixed(2)}`,
          code: "MIN_AMOUNT_NOT_MET"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalFeeAmount = totalOriginalAmount * (feePercentage / 100);
    const totalAnticipatedAmount = totalOriginalAmount - totalFeeAmount;

    console.log(`[ANTICIPATION] Total: R$ ${totalOriginalAmount.toFixed(2)}, Fee: R$ ${totalFeeAmount.toFixed(2)}, Net: R$ ${totalAnticipatedAmount.toFixed(2)}`);

    // ============================================================
    // 5. CREATE ANTICIPATION RECORD
    // ============================================================
    const { data: anticipation, error: anticipationError } = await supabase
      .from("commission_anticipations")
      .insert({
        user_id: user.id,
        total_original_amount: totalOriginalAmount,
        total_anticipated_amount: totalAnticipatedAmount,
        fee_percentage: feePercentage,
        fee_amount: totalFeeAmount,
        status: "approved",
        approved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (anticipationError) {
      console.error("[ANTICIPATION] Error creating anticipation:", anticipationError);
      throw anticipationError;
    }

    // ============================================================
    // 6. CREATE ANTICIPATION ITEMS AND UPDATE COMMISSIONS
    // ============================================================
    const anticipationItems = validCommissions.map(c => ({
      anticipation_id: anticipation.id,
      commission_id: c.id,
      original_amount: c.commission_amount,
      fee_amount: c.commission_amount * (feePercentage / 100),
      anticipated_amount: c.commission_amount * (1 - feePercentage / 100)
    }));

    const { error: itemsError } = await supabase
      .from("anticipation_items")
      .insert(anticipationItems);

    if (itemsError) {
      console.error("[ANTICIPATION] Error creating items:", itemsError);
      throw itemsError;
    }

    // Update commission statuses to 'anticipated'
    const { error: updateError } = await supabase
      .from("sale_commissions")
      .update({
        status: "anticipated",
        anticipated_at: new Date().toISOString(),
        anticipation_id: anticipation.id
      })
      .in("id", validCommissions.map(c => c.id));

    if (updateError) {
      console.error("[ANTICIPATION] Error updating commissions:", updateError);
      throw updateError;
    }

    // ============================================================
    // 7. UPDATE ANTICIPATION TO COMPLETED
    // ============================================================
    await supabase
      .from("commission_anticipations")
      .update({
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", anticipation.id);

    // ============================================================
    // 8. CREATE AUDIT LOG
    // ============================================================
    await supabase.from("anticipation_logs").insert({
      anticipation_id: anticipation.id,
      user_id: user.id,
      action: "anticipation_completed",
      details: {
        total_original: totalOriginalAmount,
        total_anticipated: totalAnticipatedAmount,
        fee_percentage: feePercentage,
        fee_amount: totalFeeAmount,
        commissions_count: validCommissions.length,
        commission_ids: validCommissions.map(c => c.id)
      }
    });

    // ============================================================
    // 9. CREATE NOTIFICATION
    // ============================================================
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "anticipation",
      title: "Antecipação realizada",
      message: `Sua antecipação de R$ ${totalAnticipatedAmount.toFixed(2)} foi processada com sucesso.`,
      link: "/dashboard/carteira"
    });

    console.log(`[ANTICIPATION] Successfully processed anticipation ${anticipation.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        anticipation_id: anticipation.id,
        total_original: totalOriginalAmount,
        total_anticipated: totalAnticipatedAmount,
        fee_percentage: feePercentage,
        fee_amount: totalFeeAmount,
        commissions_anticipated: validCommissions.length,
        invalid_count: invalidReasons.length,
        invalid_reasons: invalidReasons
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[ANTICIPATION] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao processar antecipação";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});