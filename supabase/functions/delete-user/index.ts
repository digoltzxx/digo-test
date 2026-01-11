import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create regular client to check the requester's role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get requester's user
    const { data: { user: requester }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !requester) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requester is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.error("User is not admin:", requester.id);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem excluir usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user_id to delete from request body
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "ID do usuário não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent admin from deleting themselves
    if (user_id === requester.id) {
      return new Response(
        JSON.stringify({ error: "Você não pode excluir sua própria conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${requester.id} deleting user ${user_id}`);

    // Delete all related data in order (to respect foreign key constraints)
    
    // 1. Delete user's sales (as seller)
    const { error: salesError } = await supabaseAdmin
      .from("sales")
      .delete()
      .eq("seller_user_id", user_id);
    if (salesError) console.error("Error deleting sales:", salesError);

    // 2. Delete user's products and related data
    const { data: userProducts } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("user_id", user_id);

    if (userProducts && userProducts.length > 0) {
      const productIds = userProducts.map(p => p.id);
      
      // Delete checkout settings
      await supabaseAdmin.from("checkout_settings").delete().in("product_id", productIds);
      
      // Delete product settings
      await supabaseAdmin.from("product_settings").delete().in("product_id", productIds);
      
      // Delete product links
      await supabaseAdmin.from("product_links").delete().in("product_id", productIds);
      
      // Delete product reviews
      await supabaseAdmin.from("product_reviews").delete().in("product_id", productIds);
      
      // Delete social proofs
      await supabaseAdmin.from("social_proofs").delete().in("product_id", productIds);
      
      // Delete order bumps
      await supabaseAdmin.from("order_bumps").delete().in("product_id", productIds);
      
      // Delete campaigns
      await supabaseAdmin.from("campaigns").delete().in("product_id", productIds);
      
      // Delete product offers
      await supabaseAdmin.from("product_offers").delete().in("product_id", productIds);
      
      // Delete abandoned carts
      await supabaseAdmin.from("abandoned_carts").delete().in("product_id", productIds);
      
      // Delete students
      await supabaseAdmin.from("students").delete().in("product_id", productIds);
      
      // Delete subscriptions
      await supabaseAdmin.from("subscriptions").delete().in("product_id", productIds);
      
      // Delete co-producers
      await supabaseAdmin.from("co_producers").delete().in("product_id", productIds);
      
      // Delete affiliations
      await supabaseAdmin.from("affiliations").delete().in("product_id", productIds);
      
      // Delete affiliate sales
      await supabaseAdmin.from("affiliate_sales").delete().in("product_id", productIds);
      
      // Finally delete products
      await supabaseAdmin.from("products").delete().eq("user_id", user_id);
    }

    // 3. Delete user's affiliations (as affiliate)
    await supabaseAdmin.from("affiliations").delete().eq("user_id", user_id);
    
    // 4. Delete affiliate sales (as affiliate)
    await supabaseAdmin.from("affiliate_sales").delete().eq("affiliate_user_id", user_id);

    // 5. Delete bank accounts
    const { data: bankAccounts } = await supabaseAdmin
      .from("bank_accounts")
      .select("id")
      .eq("user_id", user_id);
    
    if (bankAccounts && bankAccounts.length > 0) {
      const bankIds = bankAccounts.map(b => b.id);
      // Delete withdrawals first (they reference bank_accounts)
      await supabaseAdmin.from("withdrawals").delete().in("bank_account_id", bankIds);
    }
    await supabaseAdmin.from("bank_accounts").delete().eq("user_id", user_id);

    // 6. Delete withdrawals (if any remain)
    await supabaseAdmin.from("withdrawals").delete().eq("user_id", user_id);

    // 7. Delete documents
    await supabaseAdmin.from("documents").delete().eq("user_id", user_id);

    // 8. Delete notifications
    await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);

    // 9. Delete support messages
    await supabaseAdmin.from("support_messages").delete().eq("user_id", user_id);

    // 10. Delete user integrations
    await supabaseAdmin.from("user_integrations").delete().eq("user_id", user_id);

    // 11. Delete user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

    // 12. Delete account manager permissions
    await supabaseAdmin.from("account_manager_permissions").delete().eq("user_id", user_id);

    // 13. Delete OTP codes
    await supabaseAdmin.from("otp_codes").delete().eq("user_id", user_id);

    // 14. Delete subscriptions (as subscriber)
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", user_id);

    // 15. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", user_id);
    
    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // 16. Delete auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      // Even if auth deletion fails, we've cleaned up the data
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Dados do usuário excluídos, mas a conta de autenticação pode ainda existir" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully deleted user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Usuário excluído com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Delete user error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao excluir usuário";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
