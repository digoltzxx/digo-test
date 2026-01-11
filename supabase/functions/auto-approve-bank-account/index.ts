import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Basic validation functions
const isValidCPF = (cpf: string): boolean => {
  cpf = cpf.replace(/[^\d]/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (parseInt(cpf[9]) !== digit) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return parseInt(cpf[10]) === digit;
};

const isValidCNPJ = (cnpj: string): boolean => {
  cnpj = cnpj.replace(/[^\d]/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  return true;
};

const isValidBankData = (bankAccount: any): { valid: boolean; error?: string } => {
  if (!bankAccount.bank_name || bankAccount.bank_name.trim().length < 2) {
    return { valid: false, error: 'Nome do banco inválido' };
  }
  
  if (!bankAccount.agency || !/^\d{4,5}$/.test(bankAccount.agency.replace(/[^\d]/g, ''))) {
    return { valid: false, error: 'Agência inválida (deve ter 4-5 dígitos)' };
  }
  
  if (!bankAccount.account_number || !/^\d{5,12}$/.test(bankAccount.account_number.replace(/[^\d-]/g, ''))) {
    return { valid: false, error: 'Número da conta inválido' };
  }
  
  if (bankAccount.pix_key) {
    const pixKey = bankAccount.pix_key;
    const pixType = bankAccount.pix_key_type;
    
    if (pixType === 'cpf' && !isValidCPF(pixKey)) {
      return { valid: false, error: 'CPF da chave PIX inválido' };
    }
    if (pixType === 'cnpj' && !isValidCNPJ(pixKey)) {
      return { valid: false, error: 'CNPJ da chave PIX inválido' };
    }
    if (pixType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
      return { valid: false, error: 'Email da chave PIX inválido' };
    }
    if (pixType === 'phone' && !/^\+?[\d\s()-]{10,15}$/.test(pixKey)) {
      return { valid: false, error: 'Telefone da chave PIX inválido' };
    }
  }
  
  return { valid: true };
};

interface ApproveRequest {
  bank_account_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bank_account_id }: ApproveRequest = await req.json();
    
    if (!bank_account_id) {
      return new Response(
        JSON.stringify({ error: 'bank_account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`AUTO_APPROVE_BANK: Processing bank account ${bank_account_id}`);

    // Check if auto-approve is enabled
    const { data: autoApproveSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'auto_approve_bank_accounts')
      .maybeSingle();

    const isAutoApproveEnabled = autoApproveSetting?.value === 'true';

    // Get bank account
    const { data: bankAccount, error: fetchError } = await supabase
      .from('bank_accounts')
      .select('*, profiles:user_id(email, full_name, is_blocked)')
      .eq('id', bank_account_id)
      .maybeSingle();

    if (fetchError || !bankAccount) {
      console.error('AUTO_APPROVE_BANK: Bank account not found', fetchError);
      return new Response(
        JSON.stringify({ error: 'Bank account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already approved
    if (bankAccount.status === 'approved') {
      console.log('AUTO_APPROVE_BANK: Already approved');
      return new Response(
        JSON.stringify({ success: true, status: 'already_approved' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile to check if blocked
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_blocked, email')
      .eq('user_id', bankAccount.user_id)
      .maybeSingle();

    // Check if user is blocked
    if (profile?.is_blocked) {
      console.log('AUTO_APPROVE_BANK: User is blocked, rejecting');
      
      await supabase
        .from('bank_accounts')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', bank_account_id);
      
      await supabase.rpc('log_admin_action', {
        p_user_id: bankAccount.user_id,
        p_action_type: 'bank_account_rejected_blocked_user',
        p_entity_type: 'bank_account',
        p_entity_id: bank_account_id,
        p_details: { reason: 'User is blocked' }
      });
      
      return new Response(
        JSON.stringify({ success: false, status: 'rejected', reason: 'User is blocked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bank data
    const validation = isValidBankData(bankAccount);
    if (!validation.valid) {
      console.log('AUTO_APPROVE_BANK: Validation failed:', validation.error);
      
      await supabase
        .from('bank_accounts')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', bank_account_id);
      
      await supabase.rpc('log_admin_action', {
        p_user_id: bankAccount.user_id,
        p_action_type: 'bank_account_rejected_validation',
        p_entity_type: 'bank_account',
        p_entity_id: bank_account_id,
        p_details: { reason: validation.error }
      });
      
      return new Response(
        JSON.stringify({ success: false, status: 'rejected', reason: validation.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAutoApproveEnabled) {
      // Auto-approve disabled, leave as pending and notify admins
      console.log('AUTO_APPROVE_BANK: Auto-approve disabled, sending notification');
      
      await supabase.rpc('log_admin_action', {
        p_user_id: bankAccount.user_id,
        p_action_type: 'bank_account_pending',
        p_entity_type: 'bank_account',
        p_entity_id: bank_account_id,
        p_details: { 
          bank_name: bankAccount.bank_name,
          user_email: profile?.email
        }
      });

      // Notify admins
      await supabase.functions.invoke('admin-notify', {
        body: {
          type: 'pending_bank_account',
          entity_id: bank_account_id,
          details: {
            user_email: profile?.email,
            bank_name: bankAccount.bank_name,
            agency: bankAccount.agency,
            account_number: bankAccount.account_number
          }
        }
      });

      return new Response(
        JSON.stringify({ success: true, status: 'pending', message: 'Awaiting manual approval' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-approve the bank account
    const { error: updateError } = await supabase
      .from('bank_accounts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', bank_account_id);

    if (updateError) {
      console.error('AUTO_APPROVE_BANK: Update failed', updateError);
      
      // Notify about error
      await supabase.functions.invoke('admin-notify', {
        body: {
          type: 'auto_approve_error',
          entity_id: bank_account_id,
          details: {
            entity_type: 'bank_account',
            error: updateError.message
          }
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to approve bank account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful auto-approval
    await supabase.rpc('log_admin_action', {
      p_user_id: bankAccount.user_id,
      p_action_type: 'bank_account_auto_approved',
      p_entity_type: 'bank_account',
      p_entity_id: bank_account_id,
      p_details: {
        bank_name: bankAccount.bank_name,
        user_email: profile?.email
      }
    });

    // Create notification for user
    await supabase.rpc('create_system_notification', {
      p_user_id: bankAccount.user_id,
      p_title: 'Conta bancária aprovada',
      p_message: `Sua conta ${bankAccount.bank_name} foi aprovada automaticamente.`,
      p_type: 'success'
    });

    console.log('AUTO_APPROVE_BANK: Successfully approved');

    return new Response(
      JSON.stringify({ success: true, status: 'approved' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('AUTO_APPROVE_BANK ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
