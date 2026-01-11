import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, token } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, message: "URL é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing webhook URL: ${url}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: { 
        message: "Teste de conexão RoyalPay",
        test: true
      }
    };

    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    console.log(`Webhook test response: ${response.status} in ${responseTime}ms`);

    if (response.ok) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Conexão bem sucedida! (${responseTime}ms)`,
          status: response.status,
          responseTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Erro: ${response.status} ${response.statusText}`,
          status: response.status,
          responseTime,
          body: responseText.substring(0, 200)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Falha na conexão: ${errorMessage}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
