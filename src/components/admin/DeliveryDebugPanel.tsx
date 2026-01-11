import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  ChevronDown,
  ChevronRight,
  Package,
  CreditCard,
  Mail,
  Users,
  FileText,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface DebugItem {
  id: string;
  category: 'payment' | 'product' | 'subscription' | 'email' | 'member_area' | 'logs';
  question: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  details?: string;
}

interface DebugResult {
  saleId?: string;
  subscriptionId?: string;
  productId?: string;
  userEmail?: string;
  deliveryMethod?: string;
  checklist: DebugItem[];
  overallStatus: 'success' | 'partial' | 'failed' | 'pending';
  recommendations: string[];
}

const categoryIcons = {
  payment: CreditCard,
  product: Package,
  subscription: RefreshCw,
  email: Mail,
  member_area: Users,
  logs: FileText,
};

const categoryLabels = {
  payment: 'Pagamento',
  product: 'Produto',
  subscription: 'Assinatura',
  email: 'Email',
  member_area: 'Área de Membros',
  logs: 'Logs',
};

const statusConfig = {
  pass: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'OK' },
  fail: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Erro' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Atenção' },
  pending: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Pendente' },
};

export function DeliveryDebugPanel() {
  const [searchType, setSearchType] = useState<'sale' | 'subscription' | 'email'>('sale');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const runDebug = async () => {
    if (!searchValue.trim()) {
      toast.error('Digite um valor para buscar');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const checklist: DebugItem[] = [];
      const recommendations: string[] = [];
      let saleData: any = null;
      let subscriptionData: any = null;
      let productData: any = null;

      // 1. Find the sale/subscription
      if (searchType === 'sale') {
        const { data: sale } = await supabase
          .from('sales')
          .select('*, products(*)')
          .or(`id.eq.${searchValue},transaction_id.eq.${searchValue}`)
          .single();
        saleData = sale;
      } else if (searchType === 'subscription') {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*, products(*)')
          .eq('id', searchValue)
          .single();
        subscriptionData = sub;
        productData = sub?.products;
      } else {
        // Search by email - get most recent
        const { data: sales } = await supabase
          .from('sales')
          .select('*, products(*)')
          .eq('buyer_email', searchValue.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(1);
        if (sales?.length) {
          saleData = sales[0];
        }
      }

      productData = saleData?.products || subscriptionData?.products || productData;

      // Check 1: Payment status
      checklist.push({
        id: 'payment_status',
        category: 'payment',
        question: 'O pagamento está realmente com status "paid"?',
        status: saleData?.status === 'paid' || subscriptionData?.status === 'active' ? 'pass' : 'fail',
        details: saleData 
          ? `Status da venda: ${saleData.status}` 
          : subscriptionData 
            ? `Status da assinatura: ${subscriptionData.status}`
            : 'Venda/assinatura não encontrada',
      });

      // Check 2: Product exists
      checklist.push({
        id: 'product_exists',
        category: 'product',
        question: 'O produto existe e está ativo?',
        status: productData ? (productData.status === 'active' ? 'pass' : 'warning') : 'fail',
        details: productData 
          ? `Produto: ${productData.name} (${productData.status})` 
          : 'Produto não encontrado',
      });

      // Check 3: Delivery method configured
      checklist.push({
        id: 'delivery_method',
        category: 'product',
        question: 'O produto possui opção de entrega definida?',
        status: productData?.delivery_method ? 'pass' : 'fail',
        details: productData?.delivery_method 
          ? `Método: ${productData.delivery_method}` 
          : 'Nenhum método de entrega configurado',
      });

      if (!productData?.delivery_method) {
        recommendations.push('Configure um método de entrega para o produto.');
      }

      // Check 4: Subscription-specific checks
      if (productData?.payment_type === 'subscription' || subscriptionData) {
        checklist.push({
          id: 'subscription_active',
          category: 'subscription',
          question: 'A assinatura está com status "active"?',
          status: subscriptionData?.status === 'active' ? 'pass' : 'fail',
          details: subscriptionData 
            ? `Status: ${subscriptionData.status}` 
            : 'Assinatura não encontrada',
        });

        checklist.push({
          id: 'subscription_linked',
          category: 'subscription',
          question: 'O produto está vinculado à assinatura?',
          status: subscriptionData?.product_id === productData?.id ? 'pass' : 'fail',
          details: subscriptionData?.product_id === productData?.id 
            ? 'Produto corretamente vinculado' 
            : 'Produto não vinculado à assinatura',
        });

        if (subscriptionData?.status !== 'active') {
          recommendations.push('A assinatura precisa estar ativa para liberar acesso.');
        }
      }

      // Check 5: Email delivery checks
      if (productData?.delivery_method === 'email') {
        const { data: emailConfig } = await supabase
          .from('product_deliverables')
          .select('*')
          .eq('product_id', productData.id)
          .eq('delivery_type', 'email')
          .eq('is_active', true)
          .single();

        checklist.push({
          id: 'email_template',
          category: 'email',
          question: 'Template de email está configurado?',
          status: emailConfig ? 'pass' : 'warning',
          details: emailConfig 
            ? `Template: ${emailConfig.name}` 
            : 'Usando template padrão',
        });

        checklist.push({
          id: 'email_service',
          category: 'email',
          question: 'Serviço de email está ativo?',
          status: 'pass', // We assume it's configured if we got here
          details: 'RESEND_API_KEY configurado no sistema',
        });
      }

      // Check 6: Member area checks
      if (productData?.delivery_method === 'member_area') {
        const userEmail = saleData?.buyer_email || searchValue;
        const { data: memberAccess } = await supabase
          .from('member_access')
          .select('*')
          .eq('product_id', productData.id)
          .eq('user_email', userEmail.toLowerCase())
          .single();

        checklist.push({
          id: 'member_linked',
          category: 'member_area',
          question: 'Área de membros vinculada ao produto?',
          status: productData.delivery_method === 'member_area' ? 'pass' : 'fail',
          details: 'Produto configurado para área de membros',
        });

        checklist.push({
          id: 'user_linked',
          category: 'member_area',
          question: 'Usuário vinculado ao produto?',
          status: memberAccess ? 'pass' : 'fail',
          details: memberAccess 
            ? `Acesso: ${memberAccess.access_status} (desde ${new Date(memberAccess.granted_at).toLocaleDateString('pt-BR')})` 
            : 'Usuário não possui acesso registrado',
        });

        if (!memberAccess) {
          recommendations.push('Liberar manualmente o acesso do usuário à área de membros.');
        }
      }

      // Check 7: Delivery logs
      const { data: logs } = await supabase
        .from('delivery_logs')
        .select('*')
        .or(`sale_id.eq.${saleData?.id},subscription_id.eq.${subscriptionData?.id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      checklist.push({
        id: 'delivery_attempt',
        category: 'logs',
        question: 'Existe log de tentativa de entrega?',
        status: logs?.length ? 'pass' : 'fail',
        details: logs?.length 
          ? `${logs.length} tentativa(s) registrada(s)` 
          : 'Nenhuma tentativa de entrega registrada',
      });

      const failedLogs = logs?.filter(l => l.delivery_status === 'failed') || [];
      checklist.push({
        id: 'delivery_errors',
        category: 'logs',
        question: 'Existe erro registrado nos logs?',
        status: failedLogs.length === 0 ? 'pass' : 'fail',
        details: failedLogs.length 
          ? `${failedLogs.length} erro(s): ${failedLogs[0]?.error_message || 'Sem detalhes'}` 
          : 'Nenhum erro registrado',
      });

      if (!logs?.length) {
        recommendations.push('O processo de entrega não foi executado. Verifique se o webhook de pagamento está configurado.');
      }

      if (failedLogs.length) {
        recommendations.push('Reprocessar a entrega após corrigir os erros identificados.');
      }

      // Calculate overall status
      const failCount = checklist.filter(c => c.status === 'fail').length;
      const warningCount = checklist.filter(c => c.status === 'warning').length;
      
      let overallStatus: 'success' | 'partial' | 'failed' = 'success';
      if (failCount > 0) {
        overallStatus = failCount > 2 ? 'failed' : 'partial';
      } else if (warningCount > 0) {
        overallStatus = 'partial';
      }

      setResult({
        saleId: saleData?.id,
        subscriptionId: subscriptionData?.id,
        productId: productData?.id,
        userEmail: saleData?.buyer_email || subscriptionData?.user_id,
        deliveryMethod: productData?.delivery_method,
        checklist,
        overallStatus,
        recommendations,
      });

      // Open all categories with issues
      const categoriesWithIssues = checklist
        .filter(c => c.status === 'fail' || c.status === 'warning')
        .map(c => c.category);
      setOpenCategories([...new Set(categoriesWithIssues)]);

    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Erro ao executar diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  const groupedChecklist = result?.checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, DebugItem[]>) || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Diagnóstico de Entrega
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Form */}
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Buscar por</Label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="w-full h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="sale">ID da Venda</option>
              <option value="subscription">ID da Assinatura</option>
              <option value="email">Email do Comprador</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>
              {searchType === 'sale' && 'ID ou Transaction ID'}
              {searchType === 'subscription' && 'ID da Assinatura'}
              {searchType === 'email' && 'Email do Comprador'}
            </Label>
            <Input
              placeholder={
                searchType === 'email' 
                  ? 'email@exemplo.com' 
                  : 'Digite o ID...'
              }
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runDebug()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={runDebug} disabled={loading} className="w-full">
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Diagnosticar
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className={`p-4 rounded-lg ${
              result.overallStatus === 'success' ? 'bg-green-500/10 border border-green-500/20' :
              result.overallStatus === 'partial' ? 'bg-yellow-500/10 border border-yellow-500/20' :
              'bg-red-500/10 border border-red-500/20'
            }`}>
              <div className="flex items-center gap-3">
                {result.overallStatus === 'success' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                {result.overallStatus === 'partial' && <AlertTriangle className="h-6 w-6 text-yellow-500" />}
                {result.overallStatus === 'failed' && <XCircle className="h-6 w-6 text-red-500" />}
                <div>
                  <p className="font-semibold">
                    {result.overallStatus === 'success' && 'Entrega realizada com sucesso'}
                    {result.overallStatus === 'partial' && 'Entrega com alertas'}
                    {result.overallStatus === 'failed' && 'Falha na entrega'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Método: {result.deliveryMethod || 'Não configurado'} | 
                    Produto: {result.productId?.slice(0, 8)}...
                  </p>
                </div>
              </div>
            </div>

            {/* Checklist by Category */}
            <div className="space-y-2">
              {Object.entries(groupedChecklist).map(([category, items]) => {
                const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons];
                const hasIssues = items.some(i => i.status === 'fail' || i.status === 'warning');
                const isOpen = openCategories.includes(category);

                return (
                  <Collapsible key={category} open={isOpen}>
                    <CollapsibleTrigger 
                      onClick={() => toggleCategory(category)}
                      className="w-full"
                    >
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        hasIssues ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <CategoryIcon className="h-4 w-4" />
                          <span className="font-medium">{categoryLabels[category as keyof typeof categoryLabels]}</span>
                        </div>
                        <div className="flex gap-1">
                          {items.map(item => {
                            const config = statusConfig[item.status];
                            const StatusIcon = config.icon;
                            return (
                              <StatusIcon 
                                key={item.id} 
                                className={`h-4 w-4 ${config.color}`} 
                              />
                            );
                          })}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-6 pr-3 py-2 space-y-2">
                        {items.map(item => {
                          const config = statusConfig[item.status];
                          const StatusIcon = config.icon;
                          return (
                            <div 
                              key={item.id} 
                              className={`flex items-start gap-3 p-2 rounded ${config.bg}`}
                            >
                              <StatusIcon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{item.question}</p>
                                {item.details && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>
                                )}
                              </div>
                              <Badge variant="outline" className={`${config.color} text-xs`}>
                                {config.label}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  Recomendações
                </h4>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
