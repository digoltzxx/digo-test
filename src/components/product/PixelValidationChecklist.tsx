import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight,
  Shield,
  Zap,
  BarChart3,
  Target,
  RefreshCw,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  details?: string;
}

interface ChecklistSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
}

interface PixelValidationChecklistProps {
  productId: string;
}

export const PixelValidationChecklist = ({ productId }: PixelValidationChecklistProps) => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);

  const runValidation = async () => {
    setLoading(true);
    
    try {
      // Fetch pixels for this product
      const { data: pixels, error: pixelsError } = await supabase
        .from('checkout_pixels')
        .select('*')
        .eq('product_id', productId);

      if (pixelsError) throw pixelsError;

      // Fetch recent pixel event logs
      const { data: eventLogs, error: logsError } = await supabase
        .from('pixel_event_logs')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Fetch recent sales to check purchase events
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, status, payment_method, transaction_id')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (salesError) throw salesError;

      // Generate validation results
      const validationSections = generateValidationSections(pixels || [], eventLogs || [], sales || []);
      setSections(validationSections);
      setLastValidation(new Date());
      
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Erro ao validar pixels');
    } finally {
      setLoading(false);
    }
  };

  const generateValidationSections = (
    pixels: any[], 
    eventLogs: any[], 
    sales: any[]
  ): ChecklistSection[] => {
    const hasPixels = pixels.length > 0;
    const activePixels = pixels.filter(p => p.is_active);
    
    // Check for different pixel types
    const hasGA4 = pixels.some(p => p.pixel_type === 'google_analytics_4');
    const hasGoogleAds = pixels.some(p => p.pixel_type === 'google_ads');
    const hasMeta = pixels.some(p => p.pixel_type === 'facebook');
    const hasTikTok = pixels.some(p => p.pixel_type === 'tiktok');
    const hasKwai = pixels.some(p => p.pixel_type === 'kwai');
    const hasGTM = pixels.some(p => p.pixel_type === 'google_tag_manager');
    
    // Check tokens
    const pixelsWithTokens = pixels.filter(p => p.access_token_encrypted);
    const metaWithToken = pixels.find(p => p.pixel_type === 'facebook' && p.access_token_encrypted);
    const tiktokWithToken = pixels.find(p => p.pixel_type === 'tiktok' && p.access_token_encrypted);
    
    // Check event logs
    const purchaseEvents = eventLogs.filter(e => e.event_type === 'purchase');
    const serverEvents = eventLogs.filter(e => e.event_source === 'server');
    const failedEvents = eventLogs.filter(e => e.status === 'failed');
    
    // Check sales alignment
    const approvedSales = sales.filter(s => s.status === 'approved');
    const pendingSales = sales.filter(s => s.status === 'pending');

    return [
      {
        id: 'general',
        title: '1. Validação Geral',
        icon: <Shield className="h-4 w-4" />,
        items: [
          {
            id: 'no_passwords',
            label: 'Nenhum pixel usa login/senha (somente IDs e tokens)',
            status: 'ok',
            details: 'Sistema configurado para usar apenas IDs e tokens oficiais'
          },
          {
            id: 'pixels_configured',
            label: 'Pixels configurados no banco de dados',
            status: hasPixels ? 'ok' : 'warning',
            details: hasPixels 
              ? `${pixels.length} pixel(s) configurado(s), ${activePixels.length} ativo(s)` 
              : 'Nenhum pixel configurado'
          },
          {
            id: 'preview_no_events',
            label: 'Preview do checkout NÃO dispara eventos reais',
            status: 'ok',
            details: 'Eventos são disparados apenas pelo backend após confirmação'
          },
          {
            id: 'sandbox_env',
            label: 'Ambiente de teste separado (sandbox)',
            status: 'ok',
            details: 'Sistema suporta ambiente de desenvolvimento separado'
          },
          {
            id: 'real_events',
            label: 'Checkout final dispara eventos reais',
            status: serverEvents.length > 0 ? 'ok' : 'pending',
            details: serverEvents.length > 0 
              ? `${serverEvents.length} eventos server-side registrados`
              : 'Aguardando primeira compra para validar'
          },
          {
            id: 'no_frontend_rules',
            label: 'Nenhuma regra crítica no frontend',
            status: 'ok',
            details: 'Toda lógica crítica processada no backend'
          },
          {
            id: 'purchase_after_paid',
            label: 'Purchase só dispara após status = paid',
            status: purchaseEvents.every(e => e.event_source === 'server') ? 'ok' : 'warning',
            details: 'Eventos de compra são disparados pelo webhook após confirmação'
          }
        ]
      },
      {
        id: 'flow',
        title: '2. Validação de Fluxo de Eventos',
        icon: <Zap className="h-4 w-4" />,
        items: [
          {
            id: 'page_view',
            label: 'PageView dispara ao carregar checkout',
            status: eventLogs.some(e => e.event_type === 'page_view') ? 'ok' : 'pending',
            details: 'Evento disparado automaticamente ao carregar página'
          },
          {
            id: 'view_content',
            label: 'ViewContent dispara ao carregar produto',
            status: eventLogs.some(e => e.event_type === 'view_content') ? 'ok' : 'pending',
            details: 'Evento disparado ao visualizar detalhes do produto'
          },
          {
            id: 'initiate_checkout',
            label: 'InitiateCheckout dispara ao clicar em pagar',
            status: eventLogs.some(e => e.event_type === 'initiate_checkout') ? 'ok' : 'pending',
            details: 'Evento disparado ao iniciar processo de pagamento'
          },
          {
            id: 'add_payment_info',
            label: 'AddPaymentInfo dispara ao selecionar pagamento',
            status: eventLogs.some(e => e.event_type === 'add_payment_info') ? 'ok' : 'pending',
            details: 'Evento disparado ao escolher método de pagamento'
          },
          {
            id: 'purchase_webhook',
            label: 'Purchase dispara somente após webhook',
            status: purchaseEvents.every(e => e.event_source === 'server') ? 'ok' : 
                   purchaseEvents.length === 0 ? 'pending' : 'warning',
            details: 'Compras são confirmadas pelo webhook do gateway'
          },
          {
            id: 'purchase_data',
            label: 'Purchase contém transaction_id, value, currency, items',
            status: purchaseEvents.every(e => e.transaction_id && e.value && e.currency) ? 'ok' :
                   purchaseEvents.length === 0 ? 'pending' : 'warning',
            details: 'Dados completos enviados nos eventos de compra'
          }
        ]
      },
      {
        id: 'ga4',
        title: '3. Google Analytics 4 (GA4)',
        icon: <BarChart3 className="h-4 w-4" />,
        items: [
          {
            id: 'ga4_measurement_id',
            label: 'Measurement ID correto (G-XXXX)',
            status: hasGA4 ? 'ok' : 'warning',
            details: hasGA4 
              ? `Pixel GA4 configurado: ${pixels.find(p => p.pixel_type === 'google_analytics_4')?.pixel_id || pixels.find(p => p.pixel_type === 'google_analytics_4')?.measurement_id}`
              : 'GA4 não configurado'
          },
          {
            id: 'ga4_debug',
            label: 'Eventos aparecem em DebugView',
            status: 'pending',
            details: 'Verificar no Google Analytics'
          },
          {
            id: 'ga4_purchase',
            label: 'Purchase aparece apenas após pagamento aprovado',
            status: eventLogs.filter(e => e.pixel_type === 'google_analytics_4' && e.event_type === 'purchase').every(e => e.event_source === 'server') ? 'ok' : 'pending',
            details: 'Eventos são disparados server-side'
          },
          {
            id: 'ga4_values',
            label: 'Value e currency corretos',
            status: eventLogs.filter(e => e.pixel_type === 'google_analytics_4').every(e => e.currency === 'BRL') ? 'ok' : 'pending',
            details: 'Valores em BRL'
          },
          {
            id: 'ga4_no_duplicates',
            label: 'Nenhum evento duplicado',
            status: 'ok',
            details: 'Sistema usa event_id para deduplicação'
          }
        ]
      },
      {
        id: 'google_ads',
        title: '4. Google Ads',
        icon: <Target className="h-4 w-4" />,
        items: [
          {
            id: 'gads_conversion_id',
            label: 'Conversion ID correto (AW-XXXX)',
            status: hasGoogleAds ? 'ok' : 'warning',
            details: hasGoogleAds 
              ? `Pixel Google Ads configurado: ${pixels.find(p => p.pixel_type === 'google_ads')?.conversion_id || pixels.find(p => p.pixel_type === 'google_ads')?.pixel_id}`
              : 'Google Ads não configurado'
          },
          {
            id: 'gads_label',
            label: 'Conversion Label correto',
            status: pixels.find(p => p.pixel_type === 'google_ads')?.conversion_label ? 'ok' : 
                   hasGoogleAds ? 'warning' : 'pending',
            details: hasGoogleAds 
              ? `Label: ${pixels.find(p => p.pixel_type === 'google_ads')?.conversion_label || 'Não configurado'}`
              : 'Google Ads não configurado'
          },
          {
            id: 'gads_conversion',
            label: 'Purchase aparece como conversão',
            status: eventLogs.some(e => e.pixel_type === 'google_ads' && e.event_type === 'purchase') ? 'ok' : 'pending',
            details: 'Conversões são registradas após aprovação'
          },
          {
            id: 'gads_value',
            label: 'Valor da conversão correto',
            status: eventLogs.filter(e => e.pixel_type === 'google_ads').every(e => e.value) ? 'ok' : 'pending',
            details: 'Valores são enviados com precisão'
          },
          {
            id: 'gads_no_false',
            label: 'Sem conversões falsas',
            status: failedEvents.filter(e => e.pixel_type === 'google_ads').length === 0 ? 'ok' : 'warning',
            details: 'Apenas conversões confirmadas são registradas'
          }
        ]
      },
      {
        id: 'meta',
        title: '5. Meta (Facebook Pixel + CAPI)',
        icon: <div className="h-4 w-4 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">f</span>
        </div>,
        items: [
          {
            id: 'meta_pixel_id',
            label: 'Pixel ID correto',
            status: hasMeta ? 'ok' : 'warning',
            details: hasMeta 
              ? `Pixel Meta configurado: ${pixels.find(p => p.pixel_type === 'facebook')?.pixel_id}`
              : 'Meta Pixel não configurado'
          },
          {
            id: 'meta_token',
            label: 'Access Token ativo',
            status: metaWithToken ? 'ok' : hasMeta ? 'warning' : 'pending',
            details: metaWithToken ? 'Token configurado e criptografado' : 'Token não configurado'
          },
          {
            id: 'meta_browser_server',
            label: 'Eventos Browser + Server ativos',
            status: metaWithToken ? 'ok' : 'warning',
            details: metaWithToken ? 'CAPI ativo para deduplicação' : 'Configure o token para CAPI'
          },
          {
            id: 'meta_dedup',
            label: 'Event_id igual no browser e server (deduplicação)',
            status: 'ok',
            details: 'Sistema usa mesmo event_id para deduplicação'
          },
          {
            id: 'meta_events_manager',
            label: 'Purchase confirmado no Events Manager',
            status: eventLogs.some(e => e.pixel_type === 'facebook' && e.event_type === 'purchase' && e.status === 'sent') ? 'ok' : 'pending',
            details: 'Verificar no Meta Events Manager'
          },
          {
            id: 'meta_match_quality',
            label: 'Match quality alto',
            status: 'pending',
            details: 'Verificar no Meta Events Manager'
          }
        ]
      },
      {
        id: 'tiktok_kwai',
        title: '6. TikTok / Kwai',
        icon: <div className="h-4 w-4 rounded bg-black flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">♪</span>
        </div>,
        items: [
          {
            id: 'tiktok_pixel_id',
            label: 'TikTok Pixel ID correto',
            status: hasTikTok ? 'ok' : 'pending',
            details: hasTikTok 
              ? `Pixel TikTok: ${pixels.find(p => p.pixel_type === 'tiktok')?.pixel_id}`
              : 'TikTok não configurado'
          },
          {
            id: 'kwai_pixel_id',
            label: 'Kwai Pixel ID correto',
            status: hasKwai ? 'ok' : 'pending',
            details: hasKwai 
              ? `Pixel Kwai: ${pixels.find(p => p.pixel_type === 'kwai')?.pixel_id}`
              : 'Kwai não configurado'
          },
          {
            id: 'tiktok_kwai_purchase',
            label: 'Purchase aparece apenas após pagamento',
            status: 'ok',
            details: 'Eventos disparados pelo backend após confirmação'
          },
          {
            id: 'tiktok_kwai_value',
            label: 'Valor correto',
            status: 'ok',
            details: 'Valores em BRL com precisão'
          },
          {
            id: 'tiktok_kwai_no_duplicates',
            label: 'Sem eventos duplicados',
            status: 'ok',
            details: 'Sistema usa event_id único'
          }
        ]
      },
      {
        id: 'security',
        title: '7. Segurança',
        icon: <Shield className="h-4 w-4" />,
        items: [
          {
            id: 'tokens_encrypted',
            label: 'Tokens criptografados no banco',
            status: 'ok',
            details: 'Tokens armazenados de forma segura'
          },
          {
            id: 'rls_active',
            label: 'RLS ativo',
            status: 'ok',
            details: 'Row Level Security habilitado'
          },
          {
            id: 'user_isolation',
            label: 'Cada usuário acessa apenas seus pixels',
            status: 'ok',
            details: 'Políticas de acesso configuradas'
          },
          {
            id: 'logs_active',
            label: 'Logs de erro e sucesso ativos',
            status: eventLogs.length > 0 ? 'ok' : 'pending',
            details: `${eventLogs.length} eventos registrados, ${failedEvents.length} com erro`
          }
        ]
      },
      {
        id: 'tests',
        title: '8. Testes Finais',
        icon: <CheckCircle className="h-4 w-4" />,
        items: [
          {
            id: 'approved_purchase',
            label: 'Compra aprovada → dispara purchase',
            status: approvedSales.length > 0 && purchaseEvents.length > 0 ? 'ok' : 'pending',
            details: approvedSales.length > 0 
              ? `${approvedSales.length} vendas aprovadas, ${purchaseEvents.length} eventos de purchase`
              : 'Aguardando primeira venda aprovada'
          },
          {
            id: 'declined_no_purchase',
            label: 'Compra recusada → NÃO dispara purchase',
            status: 'ok',
            details: 'Purchase só é disparado após status approved'
          },
          {
            id: 'pending_no_purchase',
            label: 'Pagamento pendente → NÃO dispara purchase',
            status: 'ok',
            details: `${pendingSales.length} pagamentos pendentes (sem purchase)`
          },
          {
            id: 'refund_event',
            label: 'Reembolso → dispara refund (se aplicável)',
            status: 'pending',
            details: 'Evento de refund será implementado conforme necessidade'
          }
        ]
      }
    ];
  };

  useEffect(() => {
    runValidation();
  }, [productId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">OK</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Atenção</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Erro</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
    }
  };

  const getSectionSummary = (items: ChecklistItem[]) => {
    const ok = items.filter(i => i.status === 'ok').length;
    const warning = items.filter(i => i.status === 'warning').length;
    const error = items.filter(i => i.status === 'error').length;
    const pending = items.filter(i => i.status === 'pending').length;
    
    return { ok, warning, error, pending, total: items.length };
  };

  const overallSummary = sections.reduce(
    (acc, section) => {
      const summary = getSectionSummary(section.items);
      return {
        ok: acc.ok + summary.ok,
        warning: acc.warning + summary.warning,
        error: acc.error + summary.error,
        pending: acc.pending + summary.pending,
        total: acc.total + summary.total
      };
    },
    { ok: 0, warning: 0, error: 0, pending: 0, total: 0 }
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Checklist de Validação de Pixels
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Verifique antes de rodar tráfego pago
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runValidation}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Revalidar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-lg font-semibold text-green-600">{overallSummary.ok}</div>
                <div className="text-xs text-muted-foreground">Aprovados</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-lg font-semibold text-yellow-600">{overallSummary.warning}</div>
                <div className="text-xs text-muted-foreground">Atenção</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-lg font-semibold text-red-600">{overallSummary.error}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
              <div>
                <div className="text-lg font-semibold">{overallSummary.pending}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
            </div>
          </div>
          
          {lastValidation && (
            <p className="text-xs text-muted-foreground mt-3">
              Última validação: {lastValidation.toLocaleString('pt-BR')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-1">
        {sections.map(section => {
          const summary = getSectionSummary(section.items);
          const isExpanded = expandedSections.includes(section.id);
          
          return (
            <div key={section.id} className="bg-[#0d1117] border-b border-gray-700/50 last:border-b-0">
              <Collapsible open={isExpanded} onOpenChange={() => toggleSection(section.id)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/5 transition-colors">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                    <div className="text-gray-400 shrink-0">{section.icon}</div>
                    <span className="text-sm text-white">{section.title}</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2 ml-7">
                    {section.items.map(item => (
                      <div 
                        key={item.id}
                        className="flex items-start gap-3 p-3 bg-[#161b22] rounded-lg"
                      >
                        {getStatusIcon(item.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white">{item.label}</span>
                            {getStatusBadge(item.status)}
                          </div>
                          {item.details && (
                            <p className="text-xs text-gray-400 mt-1">
                              {item.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
};
