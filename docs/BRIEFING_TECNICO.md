# 📋 BRIEFING TÉCNICO PROFISSIONAL
## Sistema de Pagamentos Digital - Plataforma SaaS

---

# 1️⃣ VISÃO GERAL DO SISTEMA

## 🎯 Objetivo
Plataforma de vendas digitais com processamento de pagamentos, gestão de comissões, coprodução, split de pagamentos e área de membros, oferecendo checkout customizável e gestão financeira completa.

## 👥 Público-Alvo
- **Produtores digitais**: Criadores de cursos, ebooks, mentorias
- **Afiliados**: Promotores de produtos de terceiros
- **Coprodutores**: Parceiros de produtos compartilhados
- **Compradores**: Consumidores finais

## 💰 Tipo de Operação Financeira
- Vendas avulsas (PIX, Boleto, Cartão de Crédito)
- Assinaturas recorrentes
- Split de pagamentos (produtor + afiliado + coprodutor)
- Antecipação de recebíveis
- Saques para conta bancária

## 🔄 Fluxo Principal de Dinheiro
```
COMPRADOR → GATEWAY → PLATAFORMA → SPLIT → PRODUTORES/AFILIADOS → SAQUE → BANCO
```

## ⚠️ Pontos Críticos de Segurança
1. **Nunca calcular valores no frontend**
2. **Validação de cupons apenas no backend**
3. **Webhooks idempotentes com signature validation**
4. **RLS obrigatória em todas as tabelas financeiras**
5. **Auditoria imutável de todas operações**
6. **Rate limiting em endpoints sensíveis**

## 📊 Requisitos Não Funcionais

| Requisito | Especificação |
|-----------|---------------|
| **Performance** | < 200ms para APIs críticas |
| **Disponibilidade** | 99.9% uptime |
| **Escalabilidade** | Suporte a 10k transações/hora |
| **Segurança** | PCI-DSS compliance ready |
| **Auditoria** | Logs imutáveis por 5 anos |

---

# 2️⃣ BRIEFING TÉCNICO - FRONTEND

## 🛠️ Stack Recomendada
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod
- **Routing**: React Router v6
- **Charts**: Recharts

## 📄 Estrutura de Páginas

### Checkout
```
/checkout/:productSlug
/checkout/:productSlug?aff=:affiliateCode
/checkout/success/:transactionId
/checkout/upsell/:saleId
/checkout/downsell/:saleId
```

### Dashboard Financeiro
```
/dashboard
/dashboard/vendas
/dashboard/carteira
/dashboard/produtos
/dashboard/afiliados
/dashboard/relatorios
```

### Gestão de Produtos
```
/dashboard/produtos/:id/editar
/dashboard/produtos/:id/checkout-editor
/dashboard/produtos/:id/campanhas
/dashboard/produtos/:id/cupons
```

## 🚫 Responsabilidades do Frontend - PROIBIÇÕES

```typescript
// ❌ NUNCA FAZER - Cálculos financeiros
const total = price * quantity - discount; // PROIBIDO

// ✅ CORRETO - Consumir do backend
const { data } = await supabase.functions.invoke('calculate-total', {
  body: { productId, quantity, couponCode }
});
const total = data.calculated_total; // Backend calculou
```

```typescript
// ❌ NUNCA FAZER - Confiar em preços do frontend
fetch('/api/checkout', {
  body: JSON.stringify({ price: 99.90 }) // PROIBIDO
});

// ✅ CORRETO - Enviar apenas IDs
fetch('/api/checkout', {
  body: JSON.stringify({ productId: 'uuid', couponCode: 'CUPOM10' })
});
```

## 📊 Estados e Comportamentos

### Status de Transação
```typescript
type TransactionStatus = 
  | 'pending'      // Aguardando pagamento (PIX/Boleto)
  | 'approved'     // Pago e confirmado
  | 'failed'       // Falha no pagamento
  | 'refunded'     // Reembolsado
  | 'cancelled'    // Cancelado
  | 'chargeback';  // Contestação

// Mapeamento visual
const statusConfig = {
  pending:    { color: 'yellow', label: 'Pendente' },
  approved:   { color: 'green',  label: 'Aprovado' },
  failed:     { color: 'red',    label: 'Falhou' },
  refunded:   { color: 'purple', label: 'Reembolsado' },
  cancelled:  { color: 'gray',   label: 'Cancelado' },
  chargeback: { color: 'red',    label: 'Chargeback' },
};
```

### Status de Cupom
```typescript
type CouponValidation = 
  | { valid: true, discount: number, discountType: 'percent' | 'fixed' }
  | { valid: false, reason: 'expired' | 'max_uses' | 'invalid' | 'min_value' };
```

### Status de Comissão
```typescript
type CommissionStatus = 
  | 'pending'      // Aguardando liberação
  | 'available'    // Disponível para saque
  | 'anticipated'  // Foi antecipada
  | 'withdrawn'    // Já sacada
  | 'blocked';     // Bloqueada (chargeback/refund)
```

---

# 3️⃣ BRIEFING TÉCNICO - BACKEND

## 🛠️ Stack
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth
- **Functions**: Supabase Edge Functions (Deno)
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime

## 🔐 Segurança Obrigatória

### RLS em Todas as Tabelas Financeiras
```sql
-- Usuário só vê suas próprias vendas
CREATE POLICY "Users view own sales" ON sales
  FOR SELECT USING (auth.uid() = seller_user_id);

-- Usuário só saca seu próprio saldo
CREATE POLICY "Users withdraw own balance" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Triggers Financeiras
```sql
-- Trigger para impedir DELETE em tabelas financeiras
CREATE OR REPLACE FUNCTION prevent_financial_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DELETE not allowed on financial tables';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_delete_sales
  BEFORE DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
```

## 📡 Webhooks Idempotentes

```typescript
// Edge Function: process-webhook
async function handleWebhook(payload: WebhookPayload) {
  // 1. Validar assinatura
  if (!validateSignature(payload, secret)) {
    return { status: 401, error: 'Invalid signature' };
  }
  
  // 2. Verificar idempotência
  const existing = await supabase
    .from('webhook_logs')
    .select('id')
    .eq('transaction_id', payload.transaction_id)
    .eq('event_type', payload.event)
    .maybeSingle();
  
  if (existing.data) {
    return { status: 200, message: 'Already processed' };
  }
  
  // 3. Processar em transação
  // 4. Registrar log
}
```

## 📝 Auditoria Financeira

```sql
CREATE TABLE financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log é APPEND-ONLY
REVOKE UPDATE, DELETE ON financial_audit_logs FROM PUBLIC;
```

---

# 4️⃣ MODELOS DE DADOS - JSON MOCKADOS (COERENTES COM GATEWAY FINANCEIRO)

> ⚠️ **Regras dos Mocks:**
> - Valores coerentes entre campos relacionados
> - Status realistas para fluxo de pagamento
> - Relacionamentos consistentes via IDs
> - Datas em formato ISO 8601 (UTC)
> - IDs no formato UUID v4

---

## 👤 Usuário
```json
{
  "id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "name": "João Silva",
  "email": "joao@email.com",
  "document": "12345678901",
  "document_type": "cpf",
  "phone": "+5511999999999",
  "role": "producer",
  "status": "active",
  "email_verified": true,
  "created_at": "2026-01-05T12:00:00Z",
  "updated_at": "2026-01-05T12:00:00Z"
}
```

---

## 📦 Produto
```json
{
  "id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
  "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "name": "Curso Marketing Pro",
  "slug": "curso-marketing-pro",
  "description": "Aprenda marketing digital do zero ao avançado",
  "price": 497.00,
  "promotional_price": null,
  "currency": "BRL",
  "category": "curso_online",
  "status": "active",
  "affiliate_enabled": true,
  "affiliate_commission_percent": 40.00,
  "co_production_enabled": false,
  "max_installments": 12,
  "delivery_type": "member_area",
  "created_at": "2026-01-01T08:00:00Z",
  "updated_at": "2026-01-05T10:30:00Z"
}
```

---

## 🛒 Checkout Session
```json
{
  "id": "cs-f7e6d5c4-b3a2-9180-7654-321098fedcba",
  "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
  "buyer_name": "Maria Santos",
  "buyer_email": "maria@cliente.com",
  "buyer_document": "98765432100",
  "amount": 497.00,
  "payment_method": "credit_card",
  "status": "completed",
  "affiliate_code": null,
  "coupon_code": "DESCONTO50",
  "discount_amount": 50.00,
  "final_amount": 447.00,
  "session_started_at": "2026-01-05T12:00:00Z",
  "payment_approved_at": "2026-01-05T12:05:00Z",
  "metadata": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "device": "mobile",
    "ip": "189.45.123.78"
  }
}
```

---

## 💳 Transação / Venda
```json
{
  "id": "tx_9f8e7d6c",
  "transaction_id": "TXN_2026010512050000001",
  "checkout_session_id": "cs-f7e6d5c4-b3a2-9180-7654-321098fedcba",
  "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
  "seller_user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "buyer_name": "Maria Santos",
  "buyer_email": "maria@cliente.com",
  "buyer_document": "98765432100",
  "amount": 497.00,
  "discount": 50.00,
  "final_amount": 447.00,
  "gateway_fee": 17.87,
  "platform_fee": 44.70,
  "seller_amount": 384.43,
  "payment_method": "credit_card",
  "installments": 3,
  "status": "paid",
  "wallet_status": "available",
  "affiliate_user_id": null,
  "affiliate_commission": 0,
  "paid_at": "2026-01-05T12:05:00Z",
  "release_at": "2026-01-19T12:05:00Z",
  "created_at": "2026-01-05T12:05:00Z"
}
```

### 📐 Cálculo de Valores (Regra de Coerência)
```
Quando Tipo de operação = Venda:
├── final_amount = amount - discount
│   └── 447.00 = 497.00 - 50.00 ✓
├── gateway_fee = final_amount × 4% (exemplo)
│   └── 17.87 = 447.00 × 0.04 ✓
├── platform_fee = final_amount × 10% (exemplo)
│   └── 44.70 = 447.00 × 0.10 ✓
└── seller_amount = final_amount - gateway_fee - platform_fee
    └── 384.43 = 447.00 - 17.87 - 44.70 ✓
```

---

## 🎟️ Cupom
```json
{
  "id": "cp_001",
  "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
  "code": "DESCONTO50",
  "name": "Desconto R$50 Lançamento",
  "type": "fixed",
  "value": 50.00,
  "max_uses": 100,
  "used": 23,
  "max_uses_per_user": 1,
  "min_order_value": 100.00,
  "starts_at": "2026-01-01T00:00:00Z",
  "ends_at": "2026-01-31T23:59:59Z",
  "active": true,
  "created_at": "2025-12-28T10:00:00Z"
}
```

---

## 📊 Uso de Cupom
```json
{
  "id": "usage-a1b2c3d4-e5f6-7890-abcd-111111111111",
  "coupon_id": "cp_001",
  "sale_id": "tx_9f8e7d6c",
  "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
  "coupon_code": "DESCONTO50",
  "original_amount": 497.00,
  "discount_applied": 50.00,
  "final_amount": 447.00,
  "discount_type": "fixed",
  "discount_value": 50.00,
  "status": "used",
  "used_at": "2026-01-05T12:05:00Z",
  "created_at": "2026-01-05T12:00:00Z"
}
```

---

## 🤝 Comissão / Split
```json
{
  "transaction_id": "tx_9f8e7d6c",
  "total_amount": 447.00,
  "splits": [
    {
      "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
      "role": "producer",
      "percent": 86.00,
      "amount": 384.43,
      "status": "pending"
    },
    {
      "user_id": "coprodutor-2222-3333-4444-555555555555",
      "role": "co_producer",
      "percent": 0,
      "amount": 0,
      "status": "n/a"
    },
    {
      "user_id": "platform",
      "role": "platform",
      "percent": 10.00,
      "amount": 44.70,
      "status": "collected"
    },
    {
      "user_id": "gateway",
      "role": "gateway",
      "percent": 4.00,
      "amount": 17.87,
      "status": "collected"
    }
  ],
  "created_at": "2026-01-05T12:05:00Z"
}
```

---

## 💰 Comissão Individual
```json
{
  "id": "comm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "sale_id": "tx_9f8e7d6c",
  "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "role": "producer",
  "gross_amount": 384.43,
  "platform_fee": 0,
  "net_amount": 384.43,
  "commission_percent": 86.00,
  "status": "pending",
  "release_at": "2026-01-19T12:05:00Z",
  "anticipated": false,
  "withdrawn": false,
  "created_at": "2026-01-05T12:05:00Z"
}
```

---

## 💸 Saque
```json
{
  "id": "wd-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "bank_account_id": "ba-11111111-2222-3333-4444-555555555555",
  "amount": 384.43,
  "fee": 3.90,
  "net_amount": 380.53,
  "status": "completed",
  "pix_key": "12345678901",
  "pix_key_type": "cpf",
  "requested_at": "2026-01-20T10:00:00Z",
  "processed_at": "2026-01-20T10:05:32Z",
  "completed_at": "2026-01-20T10:05:32Z",
  "idempotency_key": "wd-2026-01-20-user-8c4c2c4a-384"
}
```

---

## ⚡ Antecipação
```json
{
  "id": "ant-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "commissions_count": 1,
  "gross_amount": 384.43,
  "fee_percent": 15.50,
  "fee_amount": 59.59,
  "net_amount": 324.84,
  "status": "completed",
  "commission_ids": [
    "comm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  ],
  "requested_at": "2026-01-06T14:00:00Z",
  "approved_at": "2026-01-06T14:00:05Z",
  "completed_at": "2026-01-06T14:00:10Z",
  "created_at": "2026-01-06T14:00:00Z"
}
```

---

## 👁️ Prova Social
```json
{
  "id": "sp-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
  "type": "purchase",
  "buyer_name": "M***a S.",
  "buyer_location": "São Paulo, SP",
  "amount": 447.00,
  "product_name": "Curso Marketing Pro",
  "time_ago": "há 2 minutos",
  "is_real": true,
  "sale_id": "tx_9f8e7d6c",
  "created_at": "2026-01-05T12:05:00Z"
}
```

---

## 📅 Evento de Calendário
```json
{
  "id": "evt-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "title": "Lançamento do Produto",
  "description": "Abertura de carrinho do curso Marketing Pro",
  "event_date": "2026-01-15",
  "event_time": "20:00",
  "event_type": "launch",
  "color": "#3B82F6",
  "is_all_day": false,
  "reminder_minutes": 60,
  "metadata": {
    "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
    "expected_revenue": 50000.00
  },
  "created_at": "2026-01-01T10:00:00Z"
}
```

---

## 📡 Webhook do Gateway
```json
{
  "event": "payment.approved",
  "transaction_id": "TXN_2026010512050000001",
  "external_reference": "tx_9f8e7d6c",
  "amount": 44700,
  "amount_paid": 44700,
  "payment_method": "credit_card",
  "installments": 3,
  "status": "approved",
  "payer": {
    "name": "Maria Santos",
    "email": "maria@cliente.com",
    "document": "98765432100",
    "document_type": "cpf"
  },
  "metadata": {
    "product_id": "b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111",
    "checkout_session_id": "cs-f7e6d5c4-b3a2-9180-7654-321098fedcba"
  },
  "created_at": "2026-01-05T12:05:00Z",
  "signature": "sha256=a1b2c3d4e5f6789012345678901234567890abcdef"
}
```

---

## 📋 Log de Auditoria
```json
{
  "id": "log-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "user_id": "8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11",
  "action_type": "sale_completed",
  "entity_type": "sale",
  "entity_id": "tx_9f8e7d6c",
  "old_values": {
    "status": "pending"
  },
  "new_values": {
    "status": "paid",
    "amount": 447.00,
    "payment_method": "credit_card"
  },
  "ip_address": "189.45.123.78",
  "user_agent": "Mozilla/5.0...",
  "source": "webhook",
  "created_at": "2026-01-05T12:05:00Z"
}
```

---

# 4.1️⃣ OPENAPI / SWAGGER (ESPECIFICAÇÃO OFICIAL)

```yaml
openapi: 3.0.3
info:
  title: Gateway de Pagamentos API
  version: v1
  description: |
    API oficial do gateway financeiro.
    
    ## Autenticação
    Todas as requisições devem incluir o header `Authorization: Bearer {token}`.
    
    ## Versionamento
    - `/v1` → versão estável
    - `/v2` → novas features (sem quebrar v1)
    
    ## Rate Limiting
    - 100 requests/minuto por IP
    - 1000 requests/hora por usuário

servers:
  - url: https://karrbdetuiiymfwymwaq.supabase.co/functions/v1
    description: Produção

paths:
  /process-checkout:
    post:
      summary: Processar checkout e criar transação
      tags: [Checkout]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CheckoutRequest'
      responses:
        '200':
          description: Checkout processado com sucesso
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CheckoutResponse'
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Não autenticado

  /validate-coupon:
    post:
      summary: Validar cupom de desconto
      tags: [Cupons]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CouponValidationRequest'
      responses:
        '200':
          description: Resultado da validação
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CouponValidationResponse'

  /process-withdrawal:
    post:
      summary: Solicitar saque
      tags: [Financeiro]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WithdrawalRequest'
      responses:
        '200':
          description: Saque processado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WithdrawalResponse'

  /process-anticipation:
    post:
      summary: Solicitar antecipação de comissões
      tags: [Financeiro]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AnticipationRequest'
      responses:
        '200':
          description: Antecipação processada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AnticipationResponse'

  /podpay-webhook:
    post:
      summary: Webhook do gateway de pagamento
      tags: [Webhooks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WebhookPayload'
      responses:
        '200':
          description: Webhook processado

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    CheckoutRequest:
      type: object
      required:
        - product_id
        - payment_method
        - buyer
      properties:
        product_id:
          type: string
          format: uuid
        quantity:
          type: integer
          default: 1
        coupon_code:
          type: string
          nullable: true
        affiliate_code:
          type: string
          nullable: true
        payment_method:
          type: string
          enum: [pix, credit_card, boleto]
        buyer:
          $ref: '#/components/schemas/BuyerInfo'
        card:
          $ref: '#/components/schemas/CardInfo'

    BuyerInfo:
      type: object
      required:
        - name
        - email
        - document
      properties:
        name:
          type: string
        email:
          type: string
          format: email
        document:
          type: string
        phone:
          type: string

    CardInfo:
      type: object
      properties:
        number:
          type: string
        holder_name:
          type: string
        expiry_month:
          type: string
        expiry_year:
          type: string
        cvv:
          type: string
        installments:
          type: integer

    CheckoutResponse:
      type: object
      properties:
        success:
          type: boolean
        sale_id:
          type: string
        transaction_id:
          type: string
        status:
          type: string
          enum: [approved, pending]
        pix_code:
          type: string
          nullable: true
        pix_qrcode:
          type: string
          nullable: true
        amount:
          type: object
          properties:
            original:
              type: number
            discount:
              type: number
            final:
              type: number

    CouponValidationRequest:
      type: object
      required:
        - product_id
        - coupon_code
        - amount
      properties:
        product_id:
          type: string
        coupon_code:
          type: string
        amount:
          type: number

    CouponValidationResponse:
      type: object
      properties:
        valid:
          type: boolean
        discount_type:
          type: string
        discount_value:
          type: number
        discount_amount:
          type: number
        final_amount:
          type: number
        reason:
          type: string
          nullable: true

    WithdrawalRequest:
      type: object
      required:
        - amount
        - bank_account_id
        - otp_code
      properties:
        amount:
          type: number
        bank_account_id:
          type: string
        otp_code:
          type: string

    WithdrawalResponse:
      type: object
      properties:
        success:
          type: boolean
        withdrawal_id:
          type: string
        amount:
          type: number
        fee:
          type: number
        net_amount:
          type: number
        status:
          type: string

    AnticipationRequest:
      type: object
      required:
        - commission_ids
      properties:
        commission_ids:
          type: array
          items:
            type: string

    AnticipationResponse:
      type: object
      properties:
        success:
          type: boolean
        anticipation_id:
          type: string
        gross_amount:
          type: number
        fee_percent:
          type: number
        fee_amount:
          type: number
        net_amount:
          type: number

    WebhookPayload:
      type: object
      properties:
        event:
          type: string
        transaction_id:
          type: string
        amount:
          type: integer
        status:
          type: string
        signature:
          type: string

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          default: false
        error:
          type: string
        message:
          type: string
```

---

# 4.2️⃣ CONTRATOS DE API VERSIONADOS

## 📌 Estratégia de Versionamento

| Versão | Status | Descrição |
|--------|--------|-----------|
| `/v1`  | Estável | Versão atual em produção |
| `/v2`  | Preview | Novas features (beta) |

### Regras de Ouro
1. **Nunca alterar contratos antigos** - Apenas adicionar campos
2. **Deprecation gradual** - 6 meses de aviso antes de remover
3. **Backward compatible** - v2 deve aceitar payloads v1
4. **Changelog obrigatório** - Documentar toda mudança

---

## 📌 Contrato: Processar Pagamento

### Request
```json
{
  "product_id": "uuid",
  "coupon_code": "string|null",
  "affiliate_code": "string|null",
  "payment_method": "pix|credit_card|boleto",
  "buyer": {
    "name": "string",
    "email": "string",
    "document": "string"
  }
}
```

### Response (Sucesso)
```json
{
  "success": true,
  "transaction_id": "string",
  "status": "pending|paid|failed",
  "checkout_url": "string",
  "amount": {
    "original": 497.00,
    "discount": 50.00,
    "final": 447.00
  }
}
```

### Response (Erro)
```json
{
  "success": false,
  "error": "invalid_coupon|payment_failed|product_unavailable",
  "message": "string"
}
```

---

## 📌 Campos NUNCA Confiáveis (Frontend)

| Campo | Razão | Ação Backend |
|-------|-------|--------------|
| `price` | Pode ser manipulado | Buscar do banco |
| `discount_amount` | Pode ser falsificado | Calcular no backend |
| `total` | Pode ser alterado | Calcular no backend |
| `commission` | Sensível | Calcular no backend |
| `balance` | Crítico | Consultar no backend |
| `is_admin` | Segurança | Verificar via RLS |
| `user_id` | Identidade | Usar `auth.uid()` |

---

# 4.3️⃣ DOCUMENTAÇÃO DE ONBOARDING PARA DEVS

## 🚀 Visão Geral do Sistema

Este gateway financeiro gerencia:
- ✅ **Checkout** - Processamento de vendas
- ✅ **Pagamentos** - PIX, Cartão, Boleto
- ✅ **Split automático** - Divisão entre partes
- ✅ **Coprodução** - Parceria de produtos
- ✅ **Afiliados** - Comissionamento
- ✅ **Saques** - Transferência para banco
- ✅ **Antecipação** - Recebimento antecipado
- ✅ **Auditoria** - Logs imutáveis

---

## 🧩 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 18 + Vite + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | TanStack Query + Zustand |
| **Backend** | Supabase + PostgreSQL |
| **Auth** | Supabase Auth (JWT) |
| **Functions** | Supabase Edge Functions (Deno) |
| **Pagamentos** | Gateway externo (webhook) |
| **Auditoria** | SQL Triggers |

---

## 🔄 Fluxo de Pagamento

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  FRONTEND   │───▶│   BACKEND   │───▶│   GATEWAY   │
│  (Checkout) │    │ (Validação) │    │ (Pagamento) │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                              │
                   ┌─────────────┐    ┌───────▼──────┐
                   │   SALDO     │◀───│   WEBHOOK    │
                   │ (Disponível)│    │ (Confirmação)│
                   └──────┬──────┘    └──────────────┘
                          │
              ┌───────────▼───────────┐
              │     TRIGGERS SQL      │
              │  - Cria comissão      │
              │  - Split automático   │
              │  - Log de auditoria   │
              └───────────────────────┘
```

### Etapas Detalhadas

1. **Frontend cria checkout** → Envia produto + buyer + método
2. **Backend valida** → Cupom, estoque, valores
3. **Gateway processa** → PIX/Cartão/Boleto
4. **Webhook confirma** → Backend recebe evento
5. **Triggers executam** → Comissão + Split + Log
6. **Saldo disponível** → Após período de segurança

---

## 🔐 Regras de Ouro

### ❌ NUNCA FAZER

```typescript
// ❌ Calcular valores no frontend
const total = price - discount;

// ❌ Confiar em dados do cliente
const { price, userId } = req.body;

// ❌ Deletar dados financeiros
DELETE FROM sales WHERE id = '...';

// ❌ Editar registros financeiros
UPDATE sales SET amount = 0 WHERE id = '...';
```

### ✅ SEMPRE FAZER

```typescript
// ✅ Buscar valores do backend
const { data } = await supabase.functions.invoke('calculate-total');

// ✅ Usar auth.uid() para identidade
const userId = auth.uid();

// ✅ Gerar log para toda ação
await logAuditEvent('action', entity, changes);

// ✅ Validar webhook com assinatura
if (!validateSignature(payload, secret)) throw Error;
```

---

## 🧪 Ambiente de Teste

### Configuração

```bash
# .env.local
VITE_SUPABASE_URL=https://karrbdetuiiymfwymwaq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Dados de Teste

Use os JSONs mockados desta documentação:
- Usuário: `8c4c2c4a-3f5a-4e9b-b8e6-9e9b4c0d8b11`
- Produto: `b1d0bfa1-2c6e-4a3e-9b7d-9c1d8b9e1111`
- Transação: `tx_9f8e7d6c`
- Cupom: `DESCONTO50`

### Webhooks Simulados

```bash
# Simular aprovação de pagamento
curl -X POST https://karrbdetuiiymfwymwaq.supabase.co/functions/v1/podpay-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.approved","transaction_id":"tx_test","amount":44700}'
```

---

## 📋 Checklist de Segurança

### RLS (Row Level Security)

- [ ] Tabela `sales` - Usuário vê apenas suas vendas
- [ ] Tabela `withdrawals` - Usuário acessa apenas seus saques
- [ ] Tabela `commissions` - Filtrado por user_id
- [ ] Tabela `products` - Owner pode editar
- [ ] Tabela `audit_logs` - Somente INSERT

### Triggers

- [ ] `prevent_financial_delete` - Bloqueia DELETE
- [ ] `create_commission_on_sale` - Auto-comissão
- [ ] `log_financial_changes` - Auditoria

### Edge Functions

- [ ] CORS configurado
- [ ] Validação de entrada (Zod)
- [ ] Rate limiting
- [ ] Logs estruturados

---

## 🎯 Por Que Isso É Crítico

| Benefício | Impacto |
|-----------|---------|
| **Integração fácil** | Novos devs produtivos em 1 dia |
| **Reduz bugs** | Regras claras = menos erros |
| **Escalável** | Pronto para fintech/marketplace |
| **Padronizado** | Integrações externas simples |
| **Auditável** | Compliance e confiança |
| **Seguro** | Proteção contra fraudes |

---

# 5️⃣ ADAPTAÇÃO POR MODELO DE NEGÓCIO

## 🏦 FINTECH

### Diferenças de Regra
| Aspecto | Implementação |
|---------|--------------|
| **Compliance** | KYC obrigatório antes de qualquer operação |
| **Auditoria** | Logs imutáveis com retenção de 5+ anos |
| **Saque** | Cooldown de 24h, limite diário, verificação OTP |
| **Antecipação** | Aprovação manual para valores > R$ 10.000 |
| **Segurança** | 2FA obrigatório, IP whitelist |

### Regras Adicionais
```typescript
// Fintech: Saldo separado por tipo
interface FintechBalance {
  available: number;      // Pode sacar
  pending: number;        // Aguardando liberação
  retained: number;       // Retido por segurança
  anticipated: number;    // Já antecipado
  blocked: number;        // Bloqueado (chargeback)
}

// Fintech: Limites rígidos
const FINTECH_LIMITS = {
  daily_withdrawal: 10000,
  monthly_withdrawal: 100000,
  min_withdrawal: 50,
  max_withdrawal_per_tx: 5000,
  withdrawal_cooldown_hours: 24,
  anticipation_fee: 15.5,
  min_anticipation: 100,
};
```

---

## 💻 SaaS

### Diferenças de Regra
| Aspecto | Implementação |
|---------|--------------|
| **Cobrança** | Recorrente mensal/anual |
| **Trial** | 7-14 dias grátis |
| **Planos** | Múltiplos tiers com features |
| **Upgrade** | Pro-rata automático |
| **Churn** | Métricas de retenção |

### Regras Adicionais
```typescript
// SaaS: Subscription
interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  cancelled_at: string | null;
}

// SaaS: Métricas
interface SaaSMetrics {
  mrr: number;           // Monthly Recurring Revenue
  arr: number;           // Annual Recurring Revenue
  churn_rate: number;    // Taxa de cancelamento
  ltv: number;           // Lifetime Value
  cac: number;           // Customer Acquisition Cost
}
```

---

## 🏛️ BANCO DIGITAL

### Diferenças de Regra
| Aspecto | Implementação |
|---------|--------------|
| **Ledger** | Double-entry bookkeeping |
| **Saldo** | Real-time, nunca negativo |
| **Histórico** | Statement completo |
| **Regulação** | BACEN compliance |
| **Transações** | Rastreabilidade total |

### Regras Adicionais
```typescript
// Banco Digital: Ledger Entry
interface LedgerEntry {
  id: string;
  account_id: string;
  entry_type: 'debit' | 'credit';
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: 'transfer' | 'payment' | 'deposit' | 'withdrawal' | 'fee';
  reference_id: string;
  description: string;
  created_at: string;
}

// Banco Digital: Conta
interface BankAccount {
  id: string;
  user_id: string;
  account_number: string;
  branch: string;
  balance: number;
  available_balance: number;
  blocked_balance: number;
  status: 'active' | 'blocked' | 'closed';
  type: 'checking' | 'savings';
}
```

---

## 🛒 MARKETPLACE

### Diferenças de Regra
| Aspecto | Implementação |
|---------|--------------|
| **Sellers** | Múltiplos vendedores |
| **Split** | Automático por venda |
| **Comissão** | Marketplace + Afiliado |
| **Saque** | Individual por seller |
| **Disputa** | Mediação obrigatória |

### Regras Adicionais
```typescript
// Marketplace: Split automático
interface MarketplaceSplit {
  sale_id: string;
  total_amount: number;
  marketplace_fee_percent: number;
  splits: Array<{
    seller_id: string;
    role: 'seller' | 'affiliate' | 'marketplace';
    percent: number;
    amount: number;
    payout_status: 'pending' | 'available' | 'withdrawn';
  }>;
}

// Marketplace: Seller
interface Seller {
  id: string;
  user_id: string;
  store_name: string;
  category: string;
  rating: number;
  total_sales: number;
  balance: number;
  commission_rate: number;
  status: 'pending' | 'approved' | 'suspended';
}
```

---

# 6️⃣ CONTRATOS FRONTEND ↔ BACKEND

## 🛒 Checkout

### POST `/functions/v1/process-checkout`
```typescript
// Request
{
  "product_id": "uuid",
  "quantity": 1,
  "coupon_code": "DESCONTO10" | null,
  "affiliate_code": "joao-123" | null,
  "payment_method": "pix" | "credit_card" | "boleto",
  "buyer": {
    "name": "string",       // Obrigatório
    "email": "string",      // Obrigatório
    "document": "string",   // Obrigatório
    "phone": "string"       // Opcional
  },
  "card": {                 // Apenas se credit_card
    "number": "string",
    "holder_name": "string",
    "expiry_month": "string",
    "expiry_year": "string",
    "cvv": "string",
    "installments": number
  }
}

// Response 200
{
  "success": true,
  "sale_id": "uuid",
  "transaction_id": "TXN_...",
  "status": "approved" | "pending",
  "payment_method": "pix" | "credit_card" | "boleto",
  "pix_code": "string" | null,      // Se PIX
  "pix_qrcode": "string" | null,    // Se PIX
  "boleto_url": "string" | null,    // Se Boleto
  "boleto_barcode": "string" | null,// Se Boleto
  "amount": {
    "original": 297.00,
    "discount": 29.70,
    "final": 267.30
  },
  "redirect_url": "/checkout/success/uuid"
}

// Response 400
{
  "success": false,
  "error": "invalid_coupon" | "insufficient_stock" | "payment_failed",
  "message": "Cupom inválido ou expirado"
}
```

### POST `/functions/v1/validate-coupon`
```typescript
// Request
{
  "product_id": "uuid",
  "coupon_code": "DESCONTO10",
  "amount": 297.00
}

// Response 200
{
  "valid": true,
  "discount_type": "percent",
  "discount_value": 10.00,
  "discount_amount": 29.70,
  "final_amount": 267.30
}

// Response 200 (inválido)
{
  "valid": false,
  "reason": "expired" | "max_uses" | "min_value" | "invalid",
  "message": "Este cupom expirou"
}
```

## 💰 Saque

### POST `/functions/v1/process-withdrawal`
```typescript
// Request
{
  "amount": 500.00,
  "bank_account_id": "uuid",
  "otp_code": "123456"  // Verificação OTP
}

// Response 200
{
  "success": true,
  "withdrawal_id": "uuid",
  "amount": 500.00,
  "fee": 4.90,
  "net_amount": 495.10,
  "status": "processing",
  "estimated_completion": "2024-12-06T10:00:00Z"
}

// Response 400
{
  "success": false,
  "error": "insufficient_balance" | "cooldown" | "invalid_otp" | "limit_exceeded",
  "message": "Saldo insuficiente para este saque",
  "details": {
    "available_balance": 350.00,
    "requested_amount": 500.00
  }
}
```

## ⚡ Antecipação

### POST `/functions/v1/process-anticipation`
```typescript
// Request
{
  "commission_ids": ["uuid", "uuid", "uuid"]
}

// Response 200
{
  "success": true,
  "anticipation_id": "uuid",
  "commissions_count": 3,
  "gross_amount": 1500.00,
  "fee_percent": 15.50,
  "fee_amount": 232.50,
  "net_amount": 1267.50,
  "status": "completed",
  "credited_to_balance": true
}

// Response 400
{
  "success": false,
  "error": "invalid_commissions" | "already_anticipated" | "min_amount",
  "message": "Uma ou mais comissões já foram antecipadas"
}
```

## 📊 Status HTTP

| Status | Significado |
|--------|-------------|
| `200` | Sucesso |
| `400` | Erro de validação / regra de negócio |
| `401` | Não autenticado |
| `403` | Não autorizado (RLS) |
| `404` | Recurso não encontrado |
| `409` | Conflito (idempotência) |
| `429` | Rate limit excedido |
| `500` | Erro interno |

## ⚠️ Campos NUNCA Confiáveis (Vindos do Frontend)

```typescript
// ❌ NUNCA aceitar do frontend:
interface NeverTrust {
  price: number;           // Sempre buscar do banco
  discount_amount: number; // Sempre calcular no backend
  total: number;           // Sempre calcular no backend
  commission: number;      // Sempre calcular no backend
  balance: number;         // Sempre consultar no backend
  is_admin: boolean;       // Sempre verificar no backend
  user_id: string;         // Sempre usar auth.uid()
}

// ✅ ACEITAR do frontend (mas validar):
interface CanAccept {
  product_id: string;      // Validar existência
  coupon_code: string;     // Validar no backend
  quantity: number;        // Validar limites
  payment_method: string;  // Validar permitidos
  buyer: BuyerInfo;        // Validar formato
}
```

---

# 🎯 CHECKLIST DE IMPLEMENTAÇÃO

## Frontend
- [ ] Nenhum cálculo financeiro
- [ ] Consumo de APIs idempotentes
- [ ] Loading/Error/Success states
- [ ] Preview 100% fiel ao checkout
- [ ] Validação de formulários com Zod
- [ ] Polling para status de pagamento

## Backend
- [ ] RLS em todas tabelas financeiras
- [ ] Triggers de proteção DELETE
- [ ] Webhooks idempotentes
- [ ] Logs de auditoria imutáveis
- [ ] Cálculos centralizados
- [ ] Validação de assinaturas

## Segurança
- [ ] Rate limiting
- [ ] OTP para operações sensíveis
- [ ] Validação de entrada
- [ ] Sanitização de dados
- [ ] CORS configurado
- [ ] Secrets em variáveis de ambiente
