import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o assistente virtual de suporte da RoyalPay, uma plataforma de pagamentos e infoprodutos.

Seu papel é ajudar os usuários com dúvidas e problemas básicos de forma clara, amigável e objetiva.

ÁREAS DE CONHECIMENTO:
1. **Produtos**: Como criar, editar, configurar preços, checkout, order bumps, upsells
2. **Pagamentos**: PIX, cartão de crédito (até 12x), boleto, taxas, prazos
3. **Saques**: Prazo de 24h úteis, via PIX, saldo disponível, antecipação
4. **Afiliados**: Programa de afiliação, comissões, convites, gestão
5. **Integrações**: Webhooks, UTMify, área de membros, automações
6. **Documentos**: Verificação de identidade, aprovação, prazos
7. **Configurações**: Perfil, dados bancários, notificações

DIRETRIZES:
- Responda em português brasileiro
- Seja conciso (máximo 3-4 frases)
- Use formatação simples
- Se não souber a resposta exata, sugira entrar em contato com o suporte humano
- Não invente informações sobre taxas ou valores específicos
- Seja empático e profissional

RESPOSTAS RÁPIDAS COMUNS:
- Criar produto: Menu "Meus Produtos" > "Novo Produto"
- Saques: Processados em até 24h úteis, via PIX
- Verificação: Até 48h para análise de documentos
- Parcelamento: Até 12x no cartão de crédito`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-6), // Keep last 6 messages for context
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "rate_limit",
            reply: "Muitas solicitações no momento. Por favor, aguarde alguns segundos e tente novamente." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "payment_required",
            reply: "Serviço temporariamente indisponível. Um gerente irá atendê-lo em breve." 
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.error("AI gateway error:", response.status, await response.text());
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 
      "Desculpe, não consegui processar sua mensagem. Tente novamente ou aguarde o suporte humano.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support AI error:", error);
    return new Response(
      JSON.stringify({ 
        error: "internal_error",
        reply: "Ocorreu um erro ao processar sua mensagem. Um gerente irá atendê-lo em breve." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
