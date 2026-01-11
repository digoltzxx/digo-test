import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Withdrawal rate limiting: 15 minutes between withdrawals
const WITHDRAWAL_COOLDOWN_MINUTES = 15;

interface WithdrawalRequest {
  amount: number;
  bank_account_id: string;
  otp_code: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit request size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5000) {
      return new Response(
        JSON.stringify({ error: 'Requisição muito grande' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client for user authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('WITHDRAWAL ERROR: No authorization header');
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.log('WITHDRAWAL ERROR: Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const userEmail = user.email;
    console.log(`WITHDRAWAL: Processing request for user ${userId}`);

    // Service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    const body: WithdrawalRequest = await req.json();
    const { amount, bank_account_id, otp_code } = body;

    console.log(`WITHDRAWAL: Request - Amount: ${amount}, Bank: ${bank_account_id}`);

    // ===== VALIDATION 1: Amount must be > 0 =====
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      console.log('WITHDRAWAL ERROR: Invalid amount:', amount);
      return new Response(
        JSON.stringify({ error: 'Valor do saque deve ser maior que 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== VALIDATION 2: Get system settings =====
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', ['minimum_withdrawal', 'withdrawal_fee', 'auto_approve_withdrawals']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => settingsMap[s.key] = s.value);

    const minWithdrawal = parseFloat(settingsMap['minimum_withdrawal']) || 50;
    const withdrawalFee = parseFloat(settingsMap['withdrawal_fee']) || 10;
    const autoApproveWithdrawals = settingsMap['auto_approve_withdrawals'] === 'true';

    // ===== VALIDATION 3: Amount >= minimum withdrawal =====
    if (amount < minWithdrawal) {
      console.log(`WITHDRAWAL ERROR: Amount ${amount} below minimum ${minWithdrawal}`);
      return new Response(
        JSON.stringify({ 
          error: `Valor abaixo da taxa mínima de saque: R$ ${minWithdrawal.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== VALIDATION 4: Verify OTP code =====
    if (!otp_code || typeof otp_code !== 'string' || otp_code.length !== 6) {
      console.log('WITHDRAWAL ERROR: Invalid OTP code format');
      return new Response(
        JSON.stringify({ error: 'Código OTP inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the OTP to compare with stored hash
    const encoder = new TextEncoder();
    const data = encoder.encode(otp_code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('purpose', 'withdrawal')
      .eq('code_hash', otpHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      console.log('WITHDRAWAL ERROR: OTP not found or expired:', otpError?.message);
      return new Response(
        JSON.stringify({ error: 'Código OTP inválido ou expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('WITHDRAWAL ERROR: Max OTP attempts exceeded');
      return new Response(
        JSON.stringify({ error: 'Número máximo de tentativas excedido. Solicite um novo código.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as used
    await supabaseAdmin
      .from('otp_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    console.log('WITHDRAWAL: OTP verified successfully');

    // ===== VALIDATION 5: Check if user is blocked =====
    const { data: isBlocked } = await supabaseAdmin.rpc('is_user_blocked', {
      p_user_id: userId
    });

    if (isBlocked) {
      console.log('WITHDRAWAL ERROR: User is blocked');
      return new Response(
        JSON.stringify({ error: 'Sua conta está bloqueada. Entre em contato com o suporte.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== VALIDATION 6: Bank account ownership =====
    const { data: bankAccount, error: bankError } = await supabaseAdmin
      .from('bank_accounts')
      .select('id, user_id, status, bank_name')
      .eq('id', bank_account_id)
      .maybeSingle();

    if (bankError || !bankAccount) {
      console.log('WITHDRAWAL ERROR: Bank account not found:', bank_account_id);
      return new Response(
        JSON.stringify({ error: 'Conta bancária não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify bank account belongs to authenticated user
    if (bankAccount.user_id !== userId) {
      console.error(`WITHDRAWAL SECURITY ALERT: User ${userId} attempted to use bank account ${bank_account_id} owned by ${bankAccount.user_id}`);
      return new Response(
        JSON.stringify({ error: 'Conta bancária não pertence a este usuário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify bank account is approved
    if (bankAccount.status !== 'approved') {
      console.log('WITHDRAWAL ERROR: Bank account not approved:', bankAccount.status);
      return new Response(
        JSON.stringify({ error: 'Conta bancária ainda não foi aprovada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('WITHDRAWAL: Bank account verified:', bankAccount.bank_name);

    // ===== VALIDATION 6: Rate limiting (15 minutes cooldown) =====
    const { data: recentWithdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('created_at')
      .eq('user_id', userId)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentWithdrawals && recentWithdrawals.length > 0) {
      const lastWithdrawalTime = new Date(recentWithdrawals[0].created_at);
      const now = new Date();
      const minutesSinceLast = (now.getTime() - lastWithdrawalTime.getTime()) / 1000 / 60;

      if (minutesSinceLast < WITHDRAWAL_COOLDOWN_MINUTES) {
        const remaining = Math.ceil(WITHDRAWAL_COOLDOWN_MINUTES - minutesSinceLast);
        console.log(`WITHDRAWAL ERROR: Rate limit - ${remaining} minutes remaining`);
        return new Response(
          JSON.stringify({ 
            error: `Aguarde ${remaining} minuto(s) para solicitar novo saque. Limite de 1 saque a cada ${WITHDRAWAL_COOLDOWN_MINUTES} minutos.` 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('WITHDRAWAL: Rate limit passed');

    // =====================================
    // CÁLCULO DE SALDO - ESPECÍFICO PARA SAQUE
    // IMPORTANTE: Usar net_amount das vendas (já com taxas de VENDA descontadas)
    // O saque tem sua PRÓPRIA taxa, nunca misturar com taxas de venda
    // =====================================
    
    const { data: sales } = await supabaseAdmin
      .from('sales')
      .select('net_amount')  // net_amount já tem taxas de VENDA descontadas
      .eq('seller_user_id', userId)
      .eq('status', 'approved');

    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('amount, status')
      .eq('user_id', userId);

    // Somar net_amount das vendas (valor líquido após taxas de VENDA)
    const totalLiquidoVendas = sales?.reduce((sum, s) => 
      sum + Number(s.net_amount || 0), 0) || 0;

    // Calculate completed/approved withdrawals
    const completedWithdrawals = withdrawals
      ?.filter(w => w.status === 'completed' || w.status === 'approved')
      .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Calculate pending withdrawals (these are already reserved)
    const pendingWithdrawals = withdrawals
      ?.filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Função de arredondamento monetário
    const arredondarMoeda = (valor: number): number => Math.round(valor * 100) / 100;

    // Saldo disponível = total líquido vendas - saques completados - saques pendentes
    const availableBalance = arredondarMoeda(Math.max(totalLiquidoVendas - completedWithdrawals - pendingWithdrawals, 0));

    console.log('=== CÁLCULO DE SALDO DISPONÍVEL - CONTEXTO: SAQUE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log(`Total líquido vendas (net_amount com taxas de VENDA já descontadas): R$ ${totalLiquidoVendas.toFixed(2)}`);
    console.log(`Saques completados: R$ ${completedWithdrawals.toFixed(2)}`);
    console.log(`Saques pendentes: R$ ${pendingWithdrawals.toFixed(2)}`);
    console.log(`Saldo disponível: R$ ${totalLiquidoVendas.toFixed(2)} - R$ ${completedWithdrawals.toFixed(2)} - R$ ${pendingWithdrawals.toFixed(2)} = R$ ${availableBalance.toFixed(2)}`);
    console.log('NOTA: Taxa de SAQUE será calculada separadamente sobre o valor solicitado');
    console.log('======================================================');

    // ===== VALIDATION 8: Balance must be > 0 =====
    if (availableBalance <= 0) {
      console.log('WITHDRAWAL ERROR: No available balance');
      return new Response(
        JSON.stringify({ error: 'Saldo deve ser maior que 0 para solicitar saque' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== VALIDATION 9: Amount cannot exceed available balance =====
    if (amount > availableBalance) {
      console.log(`WITHDRAWAL ERROR: Amount ${amount} exceeds balance ${availableBalance}`);
      return new Response(
        JSON.stringify({ 
          error: `Valor solicitado maior que o saldo disponível. Saldo atual: R$ ${availableBalance.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================
    // CÁLCULO DE TAXA - ESPECÍFICO PARA SAQUE
    // Fórmula: valor_liquido_saque = valor_saque - taxa_saque
    // REGRA: Taxa de saque é descontada do valor solicitado
    // =====================================
    
    // Taxa percentual de saque (padrão: 0%)
    const withdrawalFeePercent = 0;
    const withdrawalFeePercentValue = arredondarMoeda((amount * withdrawalFeePercent) / 100);
    
    // Taxa fixa de saque
    const withdrawalFeeFixed = arredondarMoeda(withdrawalFee);
    
    // Total da taxa de saque
    const totalWithdrawalFee = arredondarMoeda(withdrawalFeePercentValue + withdrawalFeeFixed);
    
    // Valor líquido do saque (o que o usuário recebe)
    const netAmount = arredondarMoeda(Math.max(amount - totalWithdrawalFee, 0));

    console.log('=== CÁLCULO DE TAXAS - OPERAÇÃO: SAQUE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log(`Passo 1 - Valor solicitado: R$ ${amount.toFixed(2)}`);
    console.log(`Passo 2 - Taxa percentual saque (${withdrawalFeePercent}%): R$ ${withdrawalFeePercentValue.toFixed(2)}`);
    console.log(`Passo 3 - Taxa fixa saque: R$ ${withdrawalFeeFixed.toFixed(2)}`);
    console.log(`Passo 4 - Total taxa saque: R$ ${totalWithdrawalFee.toFixed(2)}`);
    console.log(`Passo 5 - Valor líquido (recebido pelo usuário): R$ ${amount.toFixed(2)} - R$ ${totalWithdrawalFee.toFixed(2)} = R$ ${netAmount.toFixed(2)}`);
    console.log('Fórmula SAQUE: valor_liquido_saque = valor_saque - taxa_saque_percentual - taxa_saque_fixa');
    console.log('NOTA: O saldo é debitado pelo valor solicitado (R$ ' + amount.toFixed(2) + ')');
    console.log('==========================================');

    // Validação: valor líquido do saque não pode ser zero ou negativo
    if (netAmount <= 0) {
      console.log(`WITHDRAWAL ERROR: Net amount is zero or negative: ${netAmount}`);
      return new Response(
        JSON.stringify({ 
          error: `Taxa de saque (R$ ${totalWithdrawalFee.toFixed(2)}) maior ou igual ao valor solicitado` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`WITHDRAWAL: Creating withdrawal - Amount: ${amount}, Fee: ${totalWithdrawalFee}, Net: ${netAmount}, AutoApprove: ${autoApproveWithdrawals}`);

    // Determine initial status based on auto-approve setting
    const initialStatus = autoApproveWithdrawals ? 'approved' : 'pending';

    const { data: newWithdrawal, error: insertError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        user_id: userId,
        bank_account_id: bank_account_id,
        amount: amount,
        fee: totalWithdrawalFee,
        net_amount: netAmount,
        status: initialStatus
      })
      .select()
      .single();

    if (insertError) {
      console.error('WITHDRAWAL ERROR: Insert failed:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar solicitação de saque' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`WITHDRAWAL SUCCESS: Created withdrawal ${newWithdrawal.id} for user ${userId} with status ${initialStatus}`);

    // Log the action
    try {
      await supabaseAdmin.rpc('log_admin_action', {
        p_user_id: userId,
        p_action_type: autoApproveWithdrawals ? 'withdrawal_auto_approved' : 'withdrawal_pending',
        p_entity_type: 'withdrawal',
        p_entity_id: newWithdrawal.id,
        p_details: {
          amount,
          fee: totalWithdrawalFee,
          net_amount: netAmount,
          bank_name: bankAccount.bank_name
        }
      });
    } catch (logError) {
      console.error('WITHDRAWAL: Failed to log action:', logError);
    }

    // Create notification for user
    try {
      if (autoApproveWithdrawals) {
        await supabaseAdmin.rpc('create_system_notification', {
          p_user_id: userId,
          p_title: 'Saque aprovado automaticamente',
          p_message: `Seu saque de R$ ${netAmount.toFixed(2)} foi aprovado e será processado em breve.`,
          p_type: 'success'
        });
      } else {
        await supabaseAdmin.rpc('create_system_notification', {
          p_user_id: userId,
          p_title: 'Saque solicitado',
          p_message: `Seu saque de R$ ${netAmount.toFixed(2)} foi registrado e está aguardando aprovação.`,
          p_type: 'info'
        });

        // Notify admins about pending withdrawal
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        
        await fetch(`${supabaseUrl}/functions/v1/admin-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            type: 'pending_withdrawal',
            entity_id: newWithdrawal.id,
            details: {
              user_email: userEmail,
              amount,
              net_amount: netAmount
            }
          })
        });
      }
    } catch (notifError) {
      console.error('WITHDRAWAL: Failed to create notification:', notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: autoApproveWithdrawals ? 'Saque aprovado automaticamente' : 'Saque solicitado com sucesso',
        withdrawal: {
          id: newWithdrawal.id,
          amount: amount,
          fee: totalWithdrawalFee,
          net_amount: netAmount,
          status: initialStatus,
          bank_name: bankAccount.bank_name
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WITHDRAWAL FATAL ERROR:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
