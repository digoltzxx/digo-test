import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Webhook, Send, BarChart3, Receipt, Users, MessageSquare, 
  ShoppingCart, CheckCircle2, Loader2, AlertCircle, Settings,
  ExternalLink, RefreshCw, XCircle, Clock, Shield, Zap, Plus, Trash2, Edit2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { IntegrationLogo } from "@/components/integrations/IntegrationLogos";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ═══════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════

interface IntegrationConfig {
  [key: string]: string | boolean | string[];
}

interface IntegrationField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
  required: boolean;
  helpText?: string;
}

interface Integration {
  id: string;
  icon: React.ElementType;
  name: string;
  description: string;
  category: "core" | "tracking" | "fiscal" | "checkout" | "members" | "messaging";
  status: "active" | "inactive" | "error" | "testing";
  connected: boolean;
  color: string;
  config?: IntegrationConfig;
  docUrl?: string;
  events_enabled?: string[];
  last_sync_at?: string;
  error_count?: number;
  last_error?: string;
  fields: IntegrationField[];
}

interface CustomWebhook {
  id: string;
  name: string;
  url: string;
  token: string | null;
  product_filter: string;
  product_ids: string[];
  events_enabled: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  success_count: number;
  error_count: number;
  last_error: string | null;
}

interface Product {
  id: string;
  name: string;
  user_id: string;
}

// ═══════════════════════════════════════
// EVENTOS DO GATEWAY
// ═══════════════════════════════════════

const GATEWAY_EVENTS = [
  { id: "payment_created", label: "Pagamento Criado", description: "Quando um pagamento é iniciado" },
  { id: "payment_approved", label: "Pagamento Aprovado", description: "Quando o pagamento é confirmado" },
  { id: "payment_refused", label: "Pagamento Recusado", description: "Quando o pagamento é negado" },
  { id: "payment_refunded", label: "Reembolso", description: "Quando um reembolso é processado" },
  { id: "chargeback_created", label: "Chargeback", description: "Quando há disputa de cobrança" },
  { id: "subscription_created", label: "Assinatura Criada", description: "Nova assinatura ativada" },
  { id: "subscription_canceled", label: "Assinatura Cancelada", description: "Assinatura encerrada" },
];

// ═══════════════════════════════════════
// INTEGRAÇÕES APROVADAS
// ═══════════════════════════════════════

const approvedIntegrations: Omit<Integration, "connected" | "config" | "events_enabled" | "last_sync_at" | "error_count" | "last_error" | "status">[] = [
  // ═══ CORE ═══
  {
    id: "webhooks",
    icon: Webhook,
    name: "Webhooks Avançados",
    description: "Envie eventos do gateway para qualquer sistema em tempo real.",
    category: "core",
    color: "text-purple-500",
    docUrl: "https://webhook.site",
    fields: [
      { key: "webhook_url", label: "URL do Webhook", type: "url", placeholder: "https://seu-sistema.com/webhook", required: true, helpText: "Endpoint que receberá os eventos" },
      { key: "secret_key", label: "Chave de Assinatura (HMAC)", type: "password", placeholder: "sua-chave-secreta", required: false, helpText: "Para validar a autenticidade dos webhooks" },
      { key: "timeout", label: "Timeout (ms)", type: "text", placeholder: "30000", required: false, helpText: "Tempo máximo de espera (padrão: 30s)" },
    ],
  },
  
  // ═══ TRACKING ═══
  {
    id: "utmify",
    icon: BarChart3,
    name: "UTMify",
    description: "Capture UTMs e registre conversões automaticamente.",
    category: "tracking",
    color: "text-emerald-500",
    docUrl: "https://utmify.com.br",
    fields: [
      { key: "api_token", label: "API Token", type: "password", placeholder: "Seu token da API UTMify", required: true },
    ],
  },
  
  
  // ═══ WHATSAPP ═══
  {
    id: "pushcut",
    icon: Zap,
    name: "Pushcut",
    description: "Receba notificações push no iPhone/iPad a cada venda aprovada.",
    category: "messaging",
    color: "text-orange-500",
    docUrl: "https://www.pushcut.io",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "text", placeholder: "https://api.pushcut.io/...", required: true, helpText: "URL gerada em Pushcut App > Notifications > Add Web Trigger" },
    ],
  },
];

// ═══════════════════════════════════════
// LABELS DAS CATEGORIAS
// ═══════════════════════════════════════

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  core: { label: "🔗 Core", icon: Webhook, color: "bg-purple-500/10 text-purple-500" },
  tracking: { label: "📊 Tracking & UTMs", icon: BarChart3, color: "bg-emerald-500/10 text-emerald-500" },
  fiscal: { label: "🧾 Fiscal", icon: Receipt, color: "bg-green-500/10 text-green-500" },
  checkout: { label: "🛒 Checkout", icon: ShoppingCart, color: "bg-pink-500/10 text-pink-500" },
  members: { label: "👥 Área de Membros", icon: Users, color: "bg-orange-500/10 text-orange-500" },
  messaging: { label: "💬 Mensagens", icon: MessageSquare, color: "bg-green-500/10 text-green-500" },
};

// ═══════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════

const Integracoes = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [configDialog, setConfigDialog] = useState<{ open: boolean; integration: Integration | null }>({
    open: false,
    integration: null,
  });
  const [configValues, setConfigValues] = useState<IntegrationConfig>({});
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Custom Webhooks state
  const [customWebhooks, setCustomWebhooks] = useState<CustomWebhook[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [webhookDialog, setWebhookDialog] = useState<{ open: boolean; webhook: CustomWebhook | null }>({
    open: false,
    webhook: null,
  });
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    url: "",
    token: "",
    product_filter: "all",
    product_ids: [] as string[],
    events_enabled: GATEWAY_EVENTS.map(e => e.id),
  });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const connectedCount = integrations.filter((i) => i.connected).length;
  const errorCount = integrations.filter((i) => i.status === "error").length;
  const categories = ["all", ...Object.keys(categoryConfig)];

  useEffect(() => {
    fetchIntegrations();
    fetchCustomWebhooks();
    fetchProducts();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userIntegrations } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id);

      const mergedIntegrations = approvedIntegrations.map((defaultInt) => {
        const userInt = userIntegrations?.find((ui) => ui.integration_id === defaultInt.id);
        return {
          ...defaultInt,
          connected: userInt?.connected || false,
          status: userInt?.connected 
            ? (userInt?.error_count && userInt.error_count > 0 ? "error" : "active") 
            : "inactive",
          config: (userInt?.config as IntegrationConfig) || {},
          events_enabled: userInt?.events_enabled || [],
          last_sync_at: userInt?.last_sync_at,
          error_count: userInt?.error_count || 0,
          last_error: userInt?.last_error,
        } as Integration;
      });

      setIntegrations(mergedIntegrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomWebhooks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("custom_webhooks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomWebhooks(data || []);
    } catch (error) {
      console.error("Error fetching custom webhooks:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("products")
        .select("id, name, user_id")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const openWebhookDialog = (webhook?: CustomWebhook) => {
    if (webhook) {
      setWebhookForm({
        name: webhook.name,
        url: webhook.url,
        token: webhook.token || "",
        product_filter: webhook.product_filter,
        product_ids: webhook.product_ids || [],
        events_enabled: webhook.events_enabled,
      });
      setWebhookDialog({ open: true, webhook });
    } else {
      setWebhookForm({
        name: "",
        url: "",
        token: "",
        product_filter: "all",
        product_ids: [],
        events_enabled: GATEWAY_EVENTS.map(e => e.id),
      });
      setWebhookDialog({ open: true, webhook: null });
    }
    setWebhookTestResult(null);
  };

  const testWebhookUrl = async () => {
    if (!webhookForm.url) {
      toast({ title: "URL obrigatória", variant: "destructive" });
      return;
    }
    
    setTestingWebhook(true);
    setWebhookTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: {
          url: webhookForm.url,
          token: webhookForm.token || null
        }
      });

      if (error) {
        const errorMsg = error.message || "Erro ao testar webhook";
        setWebhookTestResult({ success: false, message: errorMsg });
        toast({ 
          title: "Falha na conexão", 
          description: errorMsg,
          variant: "destructive" 
        });
      } else if (data?.success) {
        const successMsg = data.message || "Conexão bem sucedida!";
        setWebhookTestResult({ success: true, message: successMsg });
        toast({ 
          title: "✅ Conexão bem sucedida!", 
          description: successMsg
        });
      } else {
        const failMsg = data?.message || "Falha na conexão";
        setWebhookTestResult({ success: false, message: failMsg });
        toast({ 
          title: "Falha na conexão", 
          description: failMsg,
          variant: "destructive" 
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erro ao testar webhook";
      setWebhookTestResult({ success: false, message: errMsg });
      toast({ 
        title: "Erro ao testar", 
        description: errMsg,
        variant: "destructive" 
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleWebhookEventToggle = (eventId: string) => {
    setWebhookForm(prev => ({
      ...prev,
      events_enabled: prev.events_enabled.includes(eventId)
        ? prev.events_enabled.filter(e => e !== eventId)
        : [...prev.events_enabled, eventId]
    }));
  };

  const saveWebhook = async () => {
    console.log("Saving webhook with form data:", webhookForm);
    
    if (!webhookForm.name || !webhookForm.url) {
      toast({ title: "Preencha nome e URL", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Usuário não autenticado", variant: "destructive" });
        setSaving(false);
        return;
      }

      const webhookData = {
        user_id: user.id,
        name: webhookForm.name,
        url: webhookForm.url,
        token: webhookForm.token || null,
        product_filter: webhookForm.product_filter,
        product_ids: webhookForm.product_ids,
        events_enabled: webhookForm.events_enabled,
        is_active: true,
      };

      if (webhookDialog.webhook) {
        // Update existing
        const { error } = await supabase
          .from("custom_webhooks")
          .update(webhookData)
          .eq("id", webhookDialog.webhook.id);
        
        if (error) throw error;
        toast({ title: "✅ Webhook atualizado com sucesso!" });
      } else {
        // Create new
        const { error } = await supabase
          .from("custom_webhooks")
          .insert(webhookData);
        
        if (error) throw error;
        toast({ title: "✅ Webhook criado com sucesso!" });
      }

      // Close both dialogs and reset form
      setWebhookDialog({ open: false, webhook: null });
      setConfigDialog({ open: false, integration: null });
      setWebhookForm({
        name: "",
        url: "",
        token: "",
        product_filter: "all",
        product_ids: [],
        events_enabled: GATEWAY_EVENTS.map(e => e.id),
      });
      setWebhookTestResult(null);
      fetchCustomWebhooks();
    } catch (error) {
      toast({ 
        title: "Erro ao salvar webhook", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este webhook?")) return;
    
    try {
      const { error } = await supabase
        .from("custom_webhooks")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Webhook excluído!" });
      fetchCustomWebhooks();
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const toggleWebhookActive = async (id: string, is_active: boolean) => {
    try {
      const { error } = await supabase
        .from("custom_webhooks")
        .update({ is_active: !is_active })
        .eq("id", id);
      
      if (error) throw error;
      fetchCustomWebhooks();
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const openConfig = (integration: Integration) => {
    setConfigDialog({ open: true, integration });
    setConfigValues(integration.config || {});
    setSelectedEvents(integration.events_enabled || GATEWAY_EVENTS.map(e => e.id));
    setTestResult(null);
    
    // Initialize webhook form when opening webhooks integration
    if (integration.id === "webhooks") {
      setWebhookForm({
        name: "",
        url: "",
        token: "",
        product_filter: "all",
        product_ids: [],
        events_enabled: GATEWAY_EVENTS.map(e => e.id),
      });
      setWebhookTestResult(null);
    }
  };

  const handleEventToggle = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  const testConnection = async () => {
    if (!configDialog.integration) return;
    
    setTesting(configDialog.integration.id);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-integration', {
        body: {
          integration: configDialog.integration.id,
          credentials: configValues
        }
      });

      if (error) {
        setTestResult({ success: false, message: error.message });
      } else {
        setTestResult({ 
          success: data?.success || false, 
          message: data?.message || 'Teste concluído' 
        });
      }
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: err instanceof Error ? err.message : 'Erro ao testar conexão' 
      });
    } finally {
      setTesting(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!configDialog.integration) return;

    // Sanitizar valores - remover quebras de linha e espaços extras
    const sanitizedValues: IntegrationConfig = {};
    Object.entries(configValues).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Remove quebras de linha, tabs e espaços extras
        sanitizedValues[key] = value.replace(/[\r\n\t]/g, '').trim();
      } else {
        sanitizedValues[key] = value;
      }
    });

    // Validar campos obrigatórios
    const requiredFields = configDialog.integration.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !sanitizedValues[f.key]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Preencha: ${missingFields.map(f => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Testar antes de salvar (obrigatório)
    if (!testResult?.success) {
      toast({
        title: "Teste necessário",
        description: "Teste a conexão antes de salvar. Clique em 'Testar Conexão'.",
        variant: "destructive",
      });
      return;
    }

    // Usar valores sanitizados
    setConfigValues(sanitizedValues);

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_integrations")
        .upsert({
          user_id: user.id,
          integration_id: configDialog.integration.id,
          connected: true,
          config: sanitizedValues,
          events_enabled: selectedEvents,
          is_active: true,
          // Use integration.id as integration_type for correct matching in edge functions
          integration_type: configDialog.integration.id,
          provider: configDialog.integration.category,
          last_sync_at: new Date().toISOString(),
          error_count: 0,
          last_error: null,
        }, {
          onConflict: "user_id,integration_id",
        });

      if (error) throw error;

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === configDialog.integration?.id 
            ? { ...i, connected: true, status: "active", config: configValues, events_enabled: selectedEvents } 
            : i
        )
      );

      toast({
        title: "✅ Integração ativada",
        description: `${configDialog.integration.name} foi configurada e ativada com sucesso.`,
      });

      setConfigDialog({ open: false, integration: null });
      setConfigValues({});
      setSelectedEvents([]);
      setTestResult(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_integrations")
        .upsert({
          user_id: user.id,
          integration_id: integration.id,
          connected: false,
          is_active: false,
        }, {
          onConflict: "user_id,integration_id",
        });

      if (error) throw error;

      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integration.id 
            ? { ...i, connected: false, status: "inactive" } 
            : i
        )
      );

      toast({
        title: "Integração desconectada",
        description: `${integration.name} foi desativada.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredIntegrations = activeCategory === "all" 
    ? integrations 
    : integrations.filter(i => i.category === activeCategory);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativo</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "testing":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Testando</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Integrações</h1>
            <p className="text-muted-foreground">
              Configure as integrações do seu gateway de pagamento
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{connectedCount} ativas</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                <span>{errorCount} com erro</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={fetchIntegrations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(categoryConfig).map(([key, config]) => {
            const count = integrations.filter(i => i.category === key && i.connected).length;
            const total = integrations.filter(i => i.category === key).length;
            return (
              <Card 
                key={key} 
                className={`cursor-pointer transition-all hover:shadow-md ${activeCategory === key ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveCategory(key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <config.icon className={`h-4 w-4 ${config.color.split(' ')[1]}`} />
                    <span className="text-xs font-medium">{config.label}</span>
                  </div>
                  <p className="text-lg font-bold">{count}/{total}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <TabsTrigger key={key} value={key}>{config.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map((integration) => (
                <Card 
                  key={integration.id}
                  className={`transition-all hover:shadow-lg ${
                    integration.status === 'active' ? 'border-green-500/30' :
                    integration.status === 'error' ? 'border-destructive/30' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-2">
                        <IntegrationLogo integrationId={integration.id} className="w-12 h-12" />
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {integration.description}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(integration.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Status info */}
                      {integration.connected && integration.last_sync_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Última sync: {new Date(integration.last_sync_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                      
                      {integration.status === 'error' && integration.last_error && (
                        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mt-0.5" />
                          <span>{integration.last_error}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button 
                          variant={integration.connected ? "outline" : "default"}
                          size="sm" 
                          className={`flex-1 ${!integration.connected ? "bg-gray-200 hover:bg-gray-300 text-gray-800" : ""}`}
                          onClick={() => openConfig(integration)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {integration.connected ? "Configurar" : "Conectar"}
                        </Button>
                        
                        {integration.docUrl && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(integration.docUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {integration.connected && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-destructive hover:text-destructive"
                          onClick={() => handleDisconnect(integration)}
                          disabled={saving}
                        >
                          Desconectar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Webhook Create/Edit Dialog */}
        <Dialog open={webhookDialog.open} onOpenChange={(open) => {
          if (!open) {
            setWebhookDialog({ open: false, webhook: null });
            setWebhookTestResult(null);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {webhookDialog.webhook ? "Editar Webhook" : "Criar Webhook"}
              </DialogTitle>
              <DialogDescription>
                Configure um endpoint para receber eventos do gateway
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do Webhook"
                />
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookForm.url}
                    onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://exemplo.com/webhook"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={testWebhookUrl}
                    disabled={testingWebhook}
                  >
                    {testingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar Webhook"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Token (opcional)</Label>
                <Input
                  type="password"
                  value={webhookForm.token}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="Token de autenticação"
                />
                <p className="text-xs text-muted-foreground">Enviado no header Authorization: Bearer</p>
              </div>

              <div className="space-y-2">
                <Label>Produtos</Label>
                <Select 
                  value={webhookForm.product_filter}
                  onValueChange={(value) => setWebhookForm(prev => ({ ...prev, product_filter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    <SelectItem value="producer">Todos que sou produtor</SelectItem>
                    <SelectItem value="coproducer">Todos que sou coprodutor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Events */}
              <Accordion type="single" collapsible defaultValue="events">
                <AccordionItem value="events" className="border-none">
                  <AccordionTrigger className="py-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Eventos ({webhookForm.events_enabled.length} selecionados)
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {GATEWAY_EVENTS.map((event) => (
                        <div 
                          key={event.id} 
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                            webhookForm.events_enabled.includes(event.id) 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border'
                          }`}
                          onClick={() => handleWebhookEventToggle(event.id)}
                        >
                          <Checkbox
                            checked={webhookForm.events_enabled.includes(event.id)}
                            onCheckedChange={() => handleWebhookEventToggle(event.id)}
                          />
                          <div>
                            <p className="text-sm font-medium">{event.label}</p>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Test Result */}
              {webhookTestResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  webhookTestResult.success 
                    ? 'bg-green-500/10 text-green-700' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {webhookTestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span className="text-sm">{webhookTestResult.message}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setWebhookDialog({ open: false, webhook: null })}>
                Cancelar
              </Button>
              <Button onClick={saveWebhook} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {webhookDialog.webhook ? "Salvar Alterações" : "Criar Webhook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Configuration Dialog */}
        <Dialog open={configDialog.open} onOpenChange={(open) => {
          if (!open) {
            setConfigDialog({ open: false, integration: null });
            setConfigValues({});
            setSelectedEvents([]);
            setTestResult(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {configDialog.integration && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <IntegrationLogo integrationId={configDialog.integration.id} className="w-10 h-10" />
                    <div>
                      <DialogTitle>
                        {configDialog.integration.id === "webhooks" ? "Testar Webhook" : configDialog.integration.name}
                      </DialogTitle>
                      <DialogDescription>{configDialog.integration.description}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Special content for Webhooks Avançados */}
                {configDialog.integration.id === "webhooks" ? (
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-6 py-4 pr-4">
                      {/* Webhook Form */}
                      <div className="space-y-4">
                        {/* Credenciais */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">Credenciais</Label>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="webhook-api-key">API Key *</Label>
                              <Input
                                id="webhook-api-key"
                                type="password"
                                placeholder="Sua API Key UTMize"
                                value={webhookForm.token}
                                onChange={(e) => setWebhookForm(prev => ({ ...prev, token: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="webhook-workspace-id">Workspace ID</Label>
                              <Input
                                id="webhook-workspace-id"
                                placeholder="ID do workspace"
                                value={webhookForm.name}
                                onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="webhook-url">URL do Webhook</Label>
                          <Input
                            id="webhook-url"
                            placeholder="https://utmize.com.br/api/webhook/1/vega"
                            value={webhookForm.url}
                            onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select
                            value={webhookForm.product_filter}
                            onValueChange={(value) => setWebhookForm(prev => ({ ...prev, product_filter: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os produtos</SelectItem>
                              <SelectItem value="member_area">Área de membros</SelectItem>
                              <SelectItem value="producer">Meus produtos (Produtor)</SelectItem>
                              <SelectItem value="coproducer">Coprodução</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Eventos Multi-Select */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-muted-foreground" />
                            <Label>Eventos ({webhookForm.events_enabled.length} selecionados)</Label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { id: "payment_created", label: "Pagamento Criado", desc: "Quando um pagamento é iniciado" },
                              { id: "payment_approved", label: "Pagamento Aprovado", desc: "Quando o pagamento é confirmado" },
                              { id: "payment_refused", label: "Pagamento Recusado", desc: "Quando o pagamento é negado" },
                              { id: "payment_refunded", label: "Reembolso", desc: "Quando um reembolso é processado" },
                              { id: "chargeback", label: "Chargeback", desc: "Quando há disputa de cobrança" },
                              { id: "subscription_created", label: "Assinatura Criada", desc: "Nova assinatura ativada" },
                              { id: "subscription_canceled", label: "Assinatura Cancelada", desc: "Assinatura encerrada" },
                            ].map((event) => (
                              <div
                                key={event.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  webhookForm.events_enabled.includes(event.id)
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground/50'
                                }`}
                                onClick={() => {
                                  setWebhookForm(prev => ({
                                    ...prev,
                                    events_enabled: prev.events_enabled.includes(event.id)
                                      ? prev.events_enabled.filter(e => e !== event.id)
                                      : [...prev.events_enabled, event.id]
                                  }));
                                }}
                              >
                                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                  webhookForm.events_enabled.includes(event.id)
                                    ? 'border-primary bg-primary'
                                    : 'border-muted-foreground'
                                }`}>
                                  {webhookForm.events_enabled.includes(event.id) && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{event.label}</p>
                                  <p className="text-xs text-muted-foreground">{event.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Webhook Test Result */}
                      {webhookTestResult && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 ${
                          webhookTestResult.success 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                          {webhookTestResult.success ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                          <span className="font-medium">{webhookTestResult.message}</span>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  /* Regular integration content */
                  <div className="space-y-6 py-4">
                    {/* Credentials Section */}
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Credenciais
                      </h3>
                      
                      {configDialog.integration.fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={field.key}>
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          <Input
                            id={field.key}
                            type={field.type}
                            value={configValues[field.key] as string || ""}
                            onChange={(e) => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                          />
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Events Section */}
                    <Accordion type="single" collapsible defaultValue="events">
                      <AccordionItem value="events">
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Eventos ({selectedEvents.length} selecionados)
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {GATEWAY_EVENTS.map((event) => (
                              <div 
                                key={event.id} 
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedEvents.includes(event.id) 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() => handleEventToggle(event.id)}
                              >
                                <Checkbox
                                  checked={selectedEvents.includes(event.id)}
                                  onCheckedChange={() => handleEventToggle(event.id)}
                                />
                                <div>
                                  <p className="font-medium text-sm">{event.label}</p>
                                  <p className="text-xs text-muted-foreground">{event.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Test Result */}
                    {testResult && (
                      <div className={`flex items-center gap-3 p-4 rounded-lg ${
                        testResult.success 
                          ? 'bg-green-500/10 text-green-700 border border-green-500/20' 
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}>
                        {testResult.success ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                        <span className="font-medium">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                {configDialog.integration.id === "webhooks" ? (
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={testWebhookUrl}
                      disabled={testingWebhook || !webhookForm.url}
                      className="w-full sm:w-auto"
                    >
                      {testingWebhook ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Enviar teste
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={saveWebhook}
                      disabled={saving || !webhookForm.name || !webhookForm.url}
                      className="w-full sm:w-auto"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Salvar e Ativar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                ) : (
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={testConnection}
                      disabled={testing !== null}
                      className="w-full sm:w-auto"
                    >
                      {testing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Testar Conexão
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveConfig}
                      disabled={saving || !testResult?.success}
                      className="w-full sm:w-auto"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Salvar e Ativar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Integracoes;
