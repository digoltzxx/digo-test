# Integração UTMify - Documentação Completa

## Visão Geral

Este documento descreve a integração completa com a UTMify para rastreamento de conversões e atribuição de campanhas de marketing.

---

## 1️⃣ Estrutura de Banco de Dados

### Tabela: `utm_tracking`

```sql
CREATE TABLE public.utm_tracking (
  -- Identificador único do registro
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Referências para rastreabilidade
  user_id UUID,                          -- ID do usuário autenticado
  checkout_session_id UUID,              -- Sessão de checkout associada
  sale_id UUID,                          -- Venda (preenchido após pagamento)
  transaction_id TEXT,                   -- ID da transação no gateway
  
  -- UTMs principais (padrão Google Analytics)
  utm_source TEXT,                       -- Origem: google, facebook, instagram
  utm_medium TEXT,                       -- Meio: cpc, email, social, organic
  utm_campaign TEXT,                     -- Nome da campanha
  utm_content TEXT,                      -- Variação A/B
  utm_term TEXT,                         -- Termo de busca pago
  
  -- Dados de contexto do acesso
  landing_page TEXT,                     -- URL de entrada
  referrer TEXT,                         -- URL de origem
  ip_address INET,                       -- IP do visitante
  user_agent TEXT,                       -- Navegador/dispositivo
  session_id TEXT,                       -- ID da sessão frontend
  
  -- Controle de envio UTMify
  utmify_sent BOOLEAN DEFAULT false,     -- Se foi enviado
  utmify_sent_at TIMESTAMPTZ,            -- Quando foi enviado
  utmify_response JSONB,                 -- Resposta da API
  utmify_error TEXT,                     -- Erro de envio
  utmify_retry_count INTEGER DEFAULT 0,  -- Tentativas
  
  -- Auditoria e imutabilidade
  is_locked BOOLEAN DEFAULT false,       -- Trava após pagamento
  locked_at TIMESTAMPTZ,                 -- Quando travou
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Características de Segurança

- **Imutabilidade**: UTMs são travadas após confirmação de pagamento
- **Auditoria completa**: Todos os campos têm histórico
- **RLS habilitado**: Usuários veem apenas seus dados
- **Trigger de proteção**: Impede alteração de dados travados

---

## 2️⃣ Payload Real de Envio para UTMify

### Endpoint da UTMify

```
POST https://api.utmify.com.br/api/v1/orders
Authorization: Bearer {UTMIFY_API_TOKEN}
Content-Type: application/json
```

### Payload JSON Completo

```json
{
  "orderId": "sale_abc123def456",
  "platform": "RoyalPay",
  "paymentMethod": "credit_card",
  "status": "paid",
  "createdAt": "2026-01-07T11:30:00.000Z",
  "approvedDate": "2026-01-07T11:30:15.000Z",
  "refundedAt": null,
  "customer": {
    "name": "João da Silva",
    "email": "joao@email.com",
    "phone": "+5511999999999",
    "document": "123.456.789-00",
    "country": "BR"
  },
  "products": [
    {
      "id": "prod_xyz789",
      "name": "Curso de Marketing Digital",
      "planName": null,
      "quantity": 1,
      "priceInCents": 19700
    }
  ],
  "trackingParameters": {
    "src": "google",
    "sck": "cpc",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "lancamento-curso-2026",
    "utm_content": "banner-topo",
    "utm_term": "marketing digital"
  },
  "commission": {
    "totalPriceInCents": 19700,
    "gatewayFeeInCents": 394,
    "userCommissionInCents": 17733,
    "currency": "BRL"
  },
  "isTest": false
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `orderId` | string | Identificador único da transação |
| `platform` | string | Nome da plataforma (RoyalPay) |
| `status` | string | Status: paid, refunded, pending |
| `createdAt` | ISO 8601 | Data de criação (UTC) |
| `customer.email` | string | Email do comprador |
| `products[].id` | string | ID do produto |
| `products[].priceInCents` | number | Valor em centavos |
| `commission.totalPriceInCents` | number | Valor total em centavos |
| `commission.currency` | string | Moeda (BRL) |

### Campos de UTM

| Campo | Origem | Exemplo |
|-------|--------|---------|
| `utm_source` | URL param | google, facebook, instagram |
| `utm_medium` | URL param | cpc, email, social, organic |
| `utm_campaign` | URL param | black-friday-2026 |
| `utm_content` | URL param | banner-lateral |
| `utm_term` | URL param | curso marketing |
| `src` | Alias | Mesmo que utm_source |
| `sck` | Alias | Mesmo que utm_medium |

---

## 3️⃣ Fluxo Completo de Integração

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE INTEGRAÇÃO UTMIFY                       │
└─────────────────────────────────────────────────────────────────────────┘

[1] ACESSO INICIAL
    │
    ▼
┌─────────────────────────────────────┐
│  Usuário acessa landing page        │
│  URL: exemplo.com?utm_source=google │
│  &utm_medium=cpc&utm_campaign=lança │
└─────────────────────────────────────┘
    │
    ▼
[2] CAPTURA DE UTMs (Frontend)
    │
    ├─── Extrai UTMs da URL
    ├─── Salva em localStorage
    ├─── Salva em cookie (30 dias)
    └─── Gera session_id único
    │
    ▼
[3] PERSISTÊNCIA NO BANCO
    │
    ├─── INSERT em utm_tracking
    ├─── user_id = null (anônimo)
    ├─── session_id = gerado
    └─── is_locked = false
    │
    ▼
[4] INÍCIO DO CHECKOUT
    │
    ├─── Recupera UTMs do localStorage
    ├─── Cria checkout_session
    ├─── UPDATE utm_tracking SET checkout_session_id
    └─── UTMs incluídas no payload do checkout
    │
    ▼
[5] PROCESSAMENTO DO PAGAMENTO
    │
    ├─── Gateway processa pagamento
    ├─── Retorna transaction_id
    └─── Cria registro em sales
    │
    ▼
[6] CONFIRMAÇÃO VIA WEBHOOK
    │
    ├─── Webhook recebe status = paid
    ├─── UPDATE sales SET status = 'paid'
    ├─── Trigger: is_locked = true
    └─── UPDATE utm_tracking SET sale_id
    │
    ▼
[7] ENVIO PARA UTMIFY (Backend)
    │
    ├─── Monta payload JSON
    ├─── Verifica idempotência
    ├─── POST para UTMify API
    ├─── Registra resposta/erro
    └─── UPDATE utm_tracking SET utmify_sent = true
    │
    ▼
[8] AUDITORIA
    │
    ├─── Log em utmify_logs
    ├─── UTMs travadas (is_locked)
    └─── Histórico preservado

┌─────────────────────────────────────────────────────────────────────────┐
│                              FIM DO FLUXO                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Diagrama de Sequência

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐    ┌────────┐
│Frontend│    │  Backend │    │   DB     │    │ Gateway │    │ UTMify │
└───┬────┘    └────┬─────┘    └────┬─────┘    └────┬────┘    └───┬────┘
    │              │               │               │             │
    │ Captura UTMs │               │               │             │
    │──────────────│               │               │             │
    │              │               │               │             │
    │ Salva local  │               │               │             │
    │──────────────│               │               │             │
    │              │               │               │             │
    │ Inicia checkout              │               │             │
    │──────────────►               │               │             │
    │              │ INSERT utm_tracking           │             │
    │              │───────────────►               │             │
    │              │               │               │             │
    │              │ Processa pagamento            │             │
    │              │───────────────────────────────►             │
    │              │               │               │             │
    │              │               │  Webhook paid │             │
    │              │◄──────────────────────────────│             │
    │              │               │               │             │
    │              │ UPDATE sale + lock UTMs       │             │
    │              │───────────────►               │             │
    │              │               │               │             │
    │              │ POST conversão│               │             │
    │              │───────────────────────────────────────────►│
    │              │               │               │             │
    │              │               │          200 OK            │
    │              │◄──────────────────────────────────────────-│
    │              │               │               │             │
    │              │ LOG sucesso   │               │             │
    │              │───────────────►               │             │
    │              │               │               │             │
```

---

## 4️⃣ Checklist de Validação

### ✅ Captura de UTMs (Frontend)

| # | Item | Status | Validação |
|---|------|--------|-----------|
| 1 | UTMs capturadas da URL | ⬜ | Acessar página com `?utm_source=test` |
| 2 | UTMs salvas em localStorage | ⬜ | Verificar `localStorage.getItem('utms')` |
| 3 | UTMs salvas em cookie | ⬜ | Verificar cookie `utms` no DevTools |
| 4 | UTMs persistem ao navegar | ⬜ | Navegar entre páginas e verificar |
| 5 | UTMs não sobrescritas sem novas | ⬜ | Acessar sem params e verificar persistência |
| 6 | session_id gerado único | ⬜ | Verificar formato UUID |
| 7 | Fallback para cookie | ⬜ | Limpar localStorage e verificar cookie |
| 8 | Captura de referrer | ⬜ | Verificar `document.referrer` |
| 9 | Captura de landing_page | ⬜ | Verificar URL completa salva |

### ✅ Banco de Dados

| # | Item | Status | Validação |
|---|------|--------|-----------|
| 1 | Registro criado em utm_tracking | ⬜ | Query no banco após acesso |
| 2 | Campos UTM preenchidos | ⬜ | Verificar valores não nulos |
| 3 | checkout_session_id associado | ⬜ | Após iniciar checkout |
| 4 | sale_id associado | ⬜ | Após pagamento confirmado |
| 5 | is_locked = true após paid | ⬜ | Verificar flag no banco |
| 6 | Trigger impede alteração | ⬜ | Tentar UPDATE e receber erro |
| 7 | Índices criados | ⬜ | Verificar `\d+ utm_tracking` |
| 8 | RLS funcionando | ⬜ | Query como usuário não-owner |

### ✅ Envio para UTMify

| # | Item | Status | Validação |
|---|------|--------|-----------|
| 1 | Payload montado corretamente | ⬜ | Log do payload antes do envio |
| 2 | Token de autenticação válido | ⬜ | Verificar secret UTMIFY_API_TOKEN |
| 3 | Envio após status = paid | ⬜ | Verificar ordem de execução |
| 4 | Resposta 200 da UTMify | ⬜ | Verificar logs |
| 5 | utmify_sent = true | ⬜ | Query no banco |
| 6 | utmify_sent_at preenchido | ⬜ | Verificar timestamp |
| 7 | Idempotência funciona | ⬜ | Reprocessar webhook |
| 8 | Retry em caso de erro | ⬜ | Simular falha temporária |
| 9 | Erro registrado | ⬜ | Verificar utmify_error |

### ✅ Validação no Painel UTMify

| # | Item | Status | Validação |
|---|------|--------|-----------|
| 1 | Conversão aparece no dashboard | ⬜ | Acessar painel UTMify |
| 2 | Valor correto | ⬜ | Comparar com pagamento real |
| 3 | UTMs corretas | ⬜ | Verificar atribuição |
| 4 | Produto identificado | ⬜ | Verificar nome/ID |
| 5 | Data/hora corretas | ⬜ | Verificar timezone UTC |
| 6 | Sem duplicatas | ⬜ | Verificar conversões únicas |

### ✅ Testes Automatizados

| # | Cenário | Status | Arquivo |
|---|---------|--------|---------|
| 1 | UTMs válidas completas | ⬜ | `utmify-integration.test.ts` |
| 2 | UTMs parciais | ⬜ | `utmify-integration.test.ts` |
| 3 | Sem UTMs (fallback) | ⬜ | `utmify-integration.test.ts` |
| 4 | Pagamento pago | ⬜ | `utmify-integration.test.ts` |
| 5 | Webhook duplicado | ⬜ | `utmify-integration.test.ts` |
| 6 | Erro e retry | ⬜ | `utmify-integration.test.ts` |
| 7 | Payload validation | ⬜ | `utmify-integration.test.ts` |

---

## 5️⃣ Exemplos de Código

### Captura de UTMs (Frontend)

```typescript
import { useUtmTracking } from '@/hooks/useUtmTracking';

function CheckoutPage() {
  const { utms, getUtmsForCheckout } = useUtmTracking();
  
  const handleSubmit = async (formData) => {
    const checkoutPayload = {
      ...formData,
      utms: getUtmsForCheckout() // Inclui todas as UTMs
    };
    
    await createCheckout(checkoutPayload);
  };
}
```

### Envio para UTMify (Backend)

```typescript
// supabase/functions/send-utmify/index.ts

const payload = mapSaleToUtmifyOrder(sale, product, utmTracking);

const response = await fetch('https://api.utmify.com.br/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${UTMIFY_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  throw new Error(`UTMify error: ${response.status}`);
}
```

---

## 6️⃣ Troubleshooting

### Problema: UTMs não aparecem no painel

1. Verificar se `utmify_sent = true` no banco
2. Verificar logs de erro em `utmify_error`
3. Validar token de autenticação
4. Confirmar formato do payload

### Problema: Conversão duplicada

1. Verificar se idempotência está funcionando
2. Checar `utmify_sent` antes de enviar
3. Usar `orderId` único

### Problema: Valor incorreto

1. Verificar se valor está em centavos
2. Confirmar campo `commission.totalPriceInCents`
3. Verificar se desconto foi aplicado corretamente

### Problema: UTMs perdidas

1. Verificar localStorage e cookies
2. Confirmar que UTMs são passadas no checkout
3. Verificar session_id consistente

---

## 7️⃣ Referências

- [Documentação API UTMify](https://docs.utmify.com.br)
- [OpenAPI Specification](./api/openapi.yaml)
- [Testes Automatizados](../src/test/__tests__/utmify-integration.test.ts)
- [Hook useUtmTracking](../src/hooks/useUtmTracking.ts)
- [Edge Function send-utmify](../supabase/functions/send-utmify/index.ts)
