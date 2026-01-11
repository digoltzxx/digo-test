import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  DiagnosticHeader, 
  StatusCard, 
  SmartChecklist, 
  ErrorBlock, 
  ActionBlock,
  ToneSelector,
  type ChecklistItem,
  type ActionType,
} from './diagnostic';
import { 
  InternalErrorCode, 
  getSuggestedActions,
  DiagnosticResult,
  DiagnosticStatus,
} from '@/lib/deliveryMessages';
import { Search, RefreshCw, Package, RotateCcw, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDefaultTone, getMessage as getTonedMessage } from '@/lib/communicationTone';

const deliveryTypeLabels = {
  payment_only: 'Apenas Pagamento',
  email: 'Entrega por Email',
  member_area: 'Área de Membros',
};

export function DiagnosticScreen() {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = async () => {
    if (!searchValue.trim()) {
      toast.error('Digite um email ou ID para buscar');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let saleData: any = null;
      let subscriptionData: any = null;
      let productData: any = null;
      let deliveryLogs: any[] = [];

      // Search by email
      if (searchValue.includes('@')) {
        const { data: sales } = await supabase
          .from('sales')
          .select('*, products(*)')
          .eq('buyer_email', searchValue.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (sales?.length) {
          saleData = sales[0];
          productData = saleData.products;
        }

        const { data: memberAccess } = await supabase
          .from('member_access')
          .select('*, products(*)')
          .eq('user_email', searchValue.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(1);

        if (memberAccess?.length && !saleData) {
          productData = memberAccess[0].products;
        }
      } else {
        // Search by ID
        const { data: sale } = await supabase
          .from('sales')
          .select('*, products(*)')
          .or(`id.eq.${searchValue},transaction_id.eq.${searchValue}`)
          .single();
        
        if (sale) {
          saleData = sale;
          productData = sale.products;
        } else {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('*, products(*)')
            .eq('id', searchValue)
            .single();
          
          if (sub) {
            subscriptionData = sub;
            productData = sub.products;
          }
        }
      }

      if (!saleData && !subscriptionData && !productData) {
        toast.error('Nenhum registro encontrado');
        setLoading(false);
        return;
      }

      // Get delivery logs
      const userEmail = saleData?.buyer_email || searchValue;
      const { data: logs } = await supabase
        .from('delivery_logs')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(10);
      
      deliveryLogs = logs || [];

      // Build diagnostic result
      const isSubscription = productData?.payment_type === 'subscription' || !!subscriptionData;
      const deliveryMethod = productData?.delivery_method as 'payment_only' | 'email' | 'member_area' | null;

      // Payment status
      const paymentOk = saleData?.status === 'paid' || saleData?.status === 'approved' || saleData?.status === 'completed';
      const paymentStatus: DiagnosticStatus = {
        label: 'Pagamento confirmado',
        status: paymentOk ? 'ok' : 
                saleData?.status === 'pending' ? 'pending' : 'error',
        errorCode: !paymentOk ? 'PAYMENT_NOT_CONFIRMED' : undefined,
        details: saleData ? `Status: ${saleData.status}` : 'Venda não encontrada',
        canResolve: saleData?.status === 'pending',
        needsEscalation: false,
      };

      // Delivery status
      const lastDeliveryLog = deliveryLogs[0];
      const deliveryFailed = lastDeliveryLog?.delivery_status === 'failed';
      const deliveryOk = lastDeliveryLog?.delivery_status === 'delivered';
      const deliveryStatus: DiagnosticStatus = {
        label: 'Entrega realizada',
        status: !deliveryMethod ? 'warning' :
                deliveryOk ? 'ok' :
                deliveryFailed ? 'error' : 'pending',
        errorCode: !deliveryMethod ? 'PRODUCT_DELIVERY_NOT_CONFIGURED' :
                   deliveryFailed ? 'DELIVERY_PROCESS_FAILED' : undefined,
        details: lastDeliveryLog 
          ? `Última tentativa: ${format(new Date(lastDeliveryLog.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
          : 'Nenhuma tentativa registrada',
        canResolve: deliveryFailed,
        needsEscalation: !deliveryMethod,
      };

      // Subscription status (if applicable)
      let subscriptionStatus: DiagnosticStatus | undefined;
      if (isSubscription) {
        const subData = subscriptionData || (await supabase
          .from('subscriptions')
          .select('*')
          .eq('product_id', productData?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()).data;

        const subActive = subData?.status === 'active';
        subscriptionStatus = {
          label: 'Assinatura ativa',
          status: subActive ? 'ok' :
                  subData?.status === 'pending' ? 'pending' : 
                  subData?.status === 'canceled' ? 'warning' : 'error',
          errorCode: !subActive ? 
                     (subData?.status === 'canceled' ? 'SUBSCRIPTION_CANCELED' : 
                      subData?.status === 'expired' ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_NOT_ACTIVE') : undefined,
          details: subData ? `Status: ${subData.status}` : 'Assinatura não encontrada',
          canResolve: subData?.status === 'pending' || subData?.status !== 'active',
          needsEscalation: !subData,
        };
      }

      // Email status (if applicable)
      let emailStatus: DiagnosticStatus | undefined;
      if (deliveryMethod === 'email') {
        const emailLog = deliveryLogs.find(l => l.delivery_type === 'email');
        const emailOk = emailLog?.delivery_status === 'delivered';
        emailStatus = {
          label: 'Email enviado',
          status: emailOk ? 'ok' :
                  emailLog?.delivery_status === 'failed' ? 'error' : 'pending',
          errorCode: emailLog?.delivery_status === 'failed' ? 'EMAIL_SEND_FAILED' : undefined,
          details: emailLog?.error_message || 'Verificar logs detalhados',
          canResolve: true,
          needsEscalation: !emailLog,
        };
      }

      // Member access status (if applicable)
      let memberAccessStatus: DiagnosticStatus | undefined;
      if (deliveryMethod === 'member_area') {
        const { data: access } = await supabase
          .from('member_access')
          .select('*')
          .eq('product_id', productData?.id)
          .eq('user_email', userEmail.toLowerCase())
          .single();

        const accessOk = access?.access_status === 'active';
        memberAccessStatus = {
          label: 'Acesso à área de membros',
          status: accessOk ? 'ok' :
                  access ? 'warning' : 'error',
          errorCode: !access ? 'MEMBERS_ACCESS_NOT_GRANTED' : undefined,
          details: access 
            ? `Status: ${access.access_status}, desde ${format(new Date(access.granted_at), 'dd/MM/yyyy', { locale: ptBR })}`
            : 'Acesso não encontrado',
          canResolve: !access,
          needsEscalation: false,
        };
      }

      // Extract last error from logs
      const lastError = deliveryLogs.find(l => l.error_message);
      let lastErrorCode: InternalErrorCode | undefined;
      if (lastError?.error_message) {
        const match = lastError.error_message.match(/^([A-Z_]+):/);
        if (match) {
          lastErrorCode = match[1] as InternalErrorCode;
        }
      }

      // Calculate overall status
      const statuses = [paymentStatus, deliveryStatus, subscriptionStatus, emailStatus, memberAccessStatus]
        .filter(Boolean) as DiagnosticStatus[];
      
      const hasError = statuses.some(s => s.status === 'error');
      const hasWarning = statuses.some(s => s.status === 'warning');
      const overallStatus = hasError ? 'error' : hasWarning ? 'warning' : 'ok';

      // Can resolve internally?
      const canResolve = statuses.some(s => s.canResolve);
      const needsEscalation = statuses.some(s => s.needsEscalation);

      // Build suggested actions
      const suggestedActions: string[] = [];
      if (paymentStatus.status !== 'ok') {
        suggestedActions.push('✔ Verificar status do pagamento no gateway');
      }
      if (deliveryStatus.status === 'error') {
        suggestedActions.push('✔ Reprocessar entrega manualmente');
      }
      if (subscriptionStatus?.status === 'error') {
        suggestedActions.push('✔ Verificar status da assinatura');
      }
      if (emailStatus?.status === 'error') {
        suggestedActions.push('✔ Reenviar email manualmente');
      }
      if (memberAccessStatus?.status === 'error') {
        suggestedActions.push('✔ Liberar acesso manualmente');
      }
      if (needsEscalation) {
        suggestedActions.push('❗ Escalar para equipe técnica');
      }
      if (suggestedActions.length === 0) {
        suggestedActions.push('✔ Nenhuma ação necessária');
      }

      setResult({
        userEmail: userEmail.toLowerCase(),
        userName: saleData?.buyer_name,
        productId: productData?.id || '',
        productName: productData?.name,
        deliveryType: deliveryMethod,
        isSubscription,
        paymentStatus,
        deliveryStatus,
        subscriptionStatus,
        emailStatus,
        memberAccessStatus,
        overallStatus,
        lastErrorCode,
        lastErrorAt: lastError?.created_at,
        canResolveInternally: canResolve,
        needsTechnicalEscalation: needsEscalation,
        suggestedActions,
      });

    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error('Erro ao executar diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: ActionType) => {
    // Placeholder for action handlers
    switch (action) {
      case 'reprocess_delivery':
        toast.info('Funcionalidade de reprocessamento em desenvolvimento');
        break;
      case 'resend_email':
        toast.info('Funcionalidade de reenvio de email em desenvolvimento');
        break;
      case 'revalidate_subscription':
        toast.info('Funcionalidade de revalidação em desenvolvimento');
        break;
      case 'grant_access':
        toast.info('Funcionalidade de liberação de acesso em desenvolvimento');
        break;
      case 'escalate':
        toast.info('Abrindo canal de escalonamento...');
        break;
    }
  };

  const buildChecklistItems = (): ChecklistItem[] => {
    if (!result) return [];
    
    const items: ChecklistItem[] = [
      {
        id: 'payment',
        label: 'Pagamento confirmado',
        status: result.paymentStatus.status,
        errorCode: result.paymentStatus.errorCode,
      },
      {
        id: 'delivery',
        label: 'Entrega realizada',
        status: result.deliveryStatus.status,
        errorCode: result.deliveryStatus.errorCode,
      },
      {
        id: 'product_config',
        label: 'Produto configurado corretamente',
        status: result.deliveryType ? 'ok' : 'error',
        errorCode: !result.deliveryType ? 'PRODUCT_DELIVERY_NOT_CONFIGURED' : undefined,
      },
    ];

    if (result.subscriptionStatus) {
      items.push({
        id: 'subscription',
        label: 'Assinatura ativa',
        status: result.subscriptionStatus.status,
        errorCode: result.subscriptionStatus.errorCode,
      });
    }

    if (result.memberAccessStatus) {
      items.push({
        id: 'member_access',
        label: 'Acesso liberado à área de membros',
        status: result.memberAccessStatus.status,
        errorCode: result.memberAccessStatus.errorCode,
      });
    }

    if (result.emailStatus) {
      items.push({
        id: 'email',
        label: 'Email enviado com sucesso',
        status: result.emailStatus.status,
        errorCode: result.emailStatus.errorCode,
      });
    }

    return items;
  };

  const getEnabledActions = (): ActionType[] => {
    if (!result) return [];
    
    const actions: ActionType[] = [];
    
    if (result.deliveryStatus.status === 'error') {
      actions.push('reprocess_delivery');
    }
    if (result.emailStatus?.status === 'error') {
      actions.push('resend_email');
    }
    if (result.subscriptionStatus?.status === 'error') {
      actions.push('revalidate_subscription');
    }
    if (result.memberAccessStatus?.status === 'error') {
      actions.push('grant_access');
    }
    if (result.needsTechnicalEscalation) {
      actions.push('escalate');
    }
    
    return actions;
  };

  const buildSummaryText = (): string => {
    if (!result) return '';
    
    const tone = getDefaultTone();
    
    return `
📊 Diagnóstico de Entrega e Pagamento
=====================================
Usuário: ${result.userName || 'N/A'}
Email: ${result.userEmail}
Produto: ${result.productName || 'N/A'}
Tipo de entrega: ${result.deliveryType ? deliveryTypeLabels[result.deliveryType] : 'Não configurado'}
Tipo de produto: ${result.isSubscription ? 'Assinatura' : 'Venda única'}

Status Resumido:
• Pagamento: ${result.paymentStatus.status === 'ok' ? '✅ Pago' : result.paymentStatus.status === 'pending' ? '⏳ Pendente' : '❌ Erro'}
${result.subscriptionStatus ? `• Assinatura: ${result.subscriptionStatus.status === 'ok' ? '✅ Ativa' : result.subscriptionStatus.status === 'pending' ? '⏳ Pendente' : '⚠️ Inativa'}` : ''}
• Entrega: ${result.deliveryStatus.status === 'ok' ? '✅ Realizada' : result.deliveryStatus.status === 'pending' ? '⏳ Pendente' : '❌ Não realizada'}

${result.lastErrorCode ? `Erro: ${result.lastErrorCode}` : ''}

Ações Sugeridas:
${result.suggestedActions.join('\n')}
    `.trim();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Diagnóstico de Entrega e Pagamento</h2>
          <p className="text-sm text-muted-foreground">Identifique e resolva problemas rapidamente</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground">Email do comprador ou ID da venda/assinatura</Label>
              <Input
                className="mt-1"
                placeholder="email@exemplo.com ou ID..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDiagnostic()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={runDiagnostic} disabled={loading} size="lg">
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Diagnosticar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* 1. Header de Diagnóstico */}
          <DiagnosticHeader
            userName={result.userName}
            userEmail={result.userEmail}
            productName={result.productName}
            productId={result.productId}
            deliveryType={result.deliveryType}
            isSubscription={result.isSubscription}
          />

          {/* 2. Cards de Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard 
              label="Pagamento" 
              status={result.paymentStatus.status} 
              icon={Package}
              tooltip={result.paymentStatus.details}
            />
            {result.subscriptionStatus && (
              <StatusCard 
                label="Assinatura" 
                status={result.subscriptionStatus.status} 
                icon={RotateCcw}
                tooltip={result.subscriptionStatus.details}
              />
            )}
            <StatusCard 
              label="Entrega" 
              status={result.deliveryStatus.status} 
              icon={Mail}
              tooltip={result.deliveryStatus.details}
            />
            {result.memberAccessStatus && (
              <StatusCard 
                label="Acesso" 
                status={result.memberAccessStatus.status} 
                icon={UserPlus}
                tooltip={result.memberAccessStatus.details}
              />
            )}
          </div>

          {/* 3. Checklist Inteligente */}
          <SmartChecklist items={buildChecklistItems()} />

          {/* 4. Bloco de Erro Detectado */}
          {result.lastErrorCode && (
            <ErrorBlock
              errorCode={result.lastErrorCode}
              errorAt={result.lastErrorAt}
            />
          )}

          {/* 5. Bloco de Ações */}
          <ActionBlock
            canResolveInternally={result.canResolveInternally}
            needsTechnicalEscalation={result.needsTechnicalEscalation}
            suggestedActions={result.suggestedActions}
            enabledActions={getEnabledActions()}
            onAction={handleAction}
            summaryText={buildSummaryText()}
          />

          {/* Configuração de Tom (opcional - pode ser movido para outra tela) */}
          <ToneSelector showPreview={true} />
        </div>
      )}
    </div>
  );
}
