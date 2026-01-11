import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import WebhookLogsTable from "@/components/admin/WebhookLogsTable";
import {
  CreditCard,
  Wallet,
  Shield,
  Settings2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Globe,
  AlertTriangle,
  Key,
  Lock,
  Unlock,
  Edit,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface GatewaySettings {
  podpay_enabled: boolean;
  podpay_environment: "sandbox" | "production";
  podpay_pix_enabled: boolean;
  podpay_credit_enabled: boolean;
  podpay_boleto_enabled: boolean;
}

interface CredentialsStatus {
  secretKey: boolean;
  publicKey: boolean;
  withdrawalKey: boolean;
}

interface NewCredentials {
  secretKey: string;
  publicKey: string;
  withdrawalKey: string;
}

const AdminGateway = () => {
  const [settings, setSettings] = useState<GatewaySettings>({
    podpay_enabled: false,
    podpay_environment: "production",
    podpay_pix_enabled: true,
    podpay_credit_enabled: true,
    podpay_boleto_enabled: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [credentialsStatus, setCredentialsStatus] = useState<CredentialsStatus | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showWithdrawalKey, setShowWithdrawalKey] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [newCredentials, setNewCredentials] = useState<NewCredentials>({
    secretKey: "",
    publicKey: "",
    withdrawalKey: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .like("key", "podpay_%");

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSettings: Partial<GatewaySettings> = {};
        data.forEach((item) => {
          const key = item.key as keyof GatewaySettings;
          if (key === "podpay_enabled" || key === "podpay_pix_enabled" || key === "podpay_credit_enabled" || key === "podpay_boleto_enabled") {
            loadedSettings[key] = item.value === "true";
          } else if (key === "podpay_environment") {
            loadedSettings[key] = item.value as "sandbox" | "production";
          }
        });
        setSettings((prev) => ({ ...prev, ...loadedSettings }));
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const settingsToSave = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
        description: `PodPay - ${key}`,
      }));

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from("system_settings")
          .upsert(
            { key: setting.key, value: setting.value, description: setting.description },
            { onConflict: "key" }
          );

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("idle");
    setCredentialsStatus(null);
    setCompanyName(null);

    try {
      console.log('Testing PodPay connection...');
      
      const { data, error } = await supabase.functions.invoke('podpay-test-connection', {
        method: 'POST',
      });

      console.log('Test connection response:', data, error);

      if (error) {
        console.error('Test connection error:', error);
        setConnectionStatus("error");
        toast.error("Falha na conexão com PodPay");
        return;
      }

      if (data?.success) {
        setConnectionStatus("success");
        setCredentialsStatus(data.credentials || null);
        setCompanyName(data.company || null);
        toast.success(data.message || "Conexão com PodPay estabelecida com sucesso!");
        
        // Enable gateway automatically on successful connection
        if (!settings.podpay_enabled) {
          setSettings(prev => ({ ...prev, podpay_enabled: true }));
        }
      } else {
        setConnectionStatus("error");
        if (data?.details) {
          setCredentialsStatus(data.details);
        }
        toast.error(data?.error || "Falha na conexão com PodPay");
      }
    } catch (error) {
      console.error('Test connection error:', error);
      setConnectionStatus("error");
      toast.error("Falha na conexão com PodPay");
    } finally {
      setIsTesting(false);
    }
  };

  const webhookUrl = `https://karrbdetuiiymfwymwaq.supabase.co/functions/v1/podpay-webhook`;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gateway de Pagamentos</h1>
            <p className="text-muted-foreground">
              Configure a integração com a PodPay para processar pagamentos
            </p>
          </div>
          <a
            href="https://podpay.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Acessar PodPay
          </a>
        </div>

        {/* Status Card */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">PodPay Gateway</CardTitle>
                  <CardDescription>
                    {companyName ? `Conta: ${companyName}` : "Pagamentos PIX, Cartão e Boleto"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {connectionStatus === "success" && (
                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Conectado
                  </Badge>
                )}
                {connectionStatus === "error" && (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    Erro
                  </Badge>
                )}
                <Switch
                  checked={settings.podpay_enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, podpay_enabled: checked }))
                  }
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credenciais Seguras */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Credenciais da API</CardTitle>
              </div>
              <CardDescription>
                As credenciais estão armazenadas de forma segura no backend
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ambiente */}
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={settings.podpay_environment === "sandbox" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, podpay_environment: "sandbox" }))
                    }
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Sandbox
                  </Button>
                  <Button
                    type="button"
                    variant={settings.podpay_environment === "production" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, podpay_environment: "production" }))
                    }
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Produção
                  </Button>
                </div>
                {settings.podpay_environment === "production" && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-yellow-500 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Modo produção - transações reais serão processadas
                  </div>
                )}
              </div>

              {/* Status das Credenciais */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
                <Label className="text-sm font-medium">Status das Chaves</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Chave Privada (Secret Key)</span>
                    </div>
                    {credentialsStatus?.secretKey ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <Lock className="w-3 h-3 mr-1" />
                        Configurada
                      </Badge>
                    ) : connectionStatus === "error" ? (
                      <Badge variant="destructive">
                        <Unlock className="w-3 h-3 mr-1" />
                        Não configurada
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Lock className="w-3 h-3 mr-1" />
                        Verificar
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Chave Pública (Public Key)</span>
                    </div>
                    {credentialsStatus?.publicKey ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <Lock className="w-3 h-3 mr-1" />
                        Configurada
                      </Badge>
                    ) : connectionStatus === "error" ? (
                      <Badge variant="outline">
                        <Unlock className="w-3 h-3 mr-1" />
                        Não configurada
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Lock className="w-3 h-3 mr-1" />
                        Verificar
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Chave de Saque Externo</span>
                    </div>
                    {credentialsStatus?.withdrawalKey ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <Lock className="w-3 h-3 mr-1" />
                        Configurada
                      </Badge>
                    ) : connectionStatus === "error" ? (
                      <Badge variant="outline">
                        <Unlock className="w-3 h-3 mr-1" />
                        Não configurada
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Lock className="w-3 h-3 mr-1" />
                        Verificar
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão para trocar credenciais */}
              <Button
                onClick={() => setShowCredentialsDialog(true)}
                variant="outline"
                className="w-full"
              >
                <Edit className="w-4 h-4 mr-2" />
                Trocar Credenciais da API
              </Button>

              {/* Test Connection Button */}
              <Button
                onClick={testConnection}
                variant="outline"
                className="w-full"
                disabled={isTesting}
              >
                {isTesting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Verificar Conexão
              </Button>

              {/* Connection Result */}
              {connectionStatus === "success" && companyName && (
                <Alert className="border-green-500/30 bg-green-500/5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Conexão Estabelecida</AlertTitle>
                  <AlertDescription>
                    Conectado à conta: <strong>{companyName}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus === "error" && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Falha na Conexão</AlertTitle>
                  <AlertDescription>
                    Verifique se as credenciais estão configuradas corretamente.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Métodos de Pagamento */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                <CardTitle>Métodos de Pagamento</CardTitle>
              </div>
              <CardDescription>
                Escolha quais métodos estarão disponíveis para seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <span className="text-green-500 font-bold text-sm">PIX</span>
                  </div>
                  <div>
                    <p className="font-medium">PIX</p>
                    <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                  </div>
                </div>
                <Switch
                  checked={settings.podpay_pix_enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, podpay_pix_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Cartão de Crédito</p>
                    <p className="text-sm text-muted-foreground">Até 12x sem juros</p>
                  </div>
                </div>
                <Switch
                  checked={settings.podpay_credit_enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, podpay_credit_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <span className="text-orange-500 font-bold text-xs">BOL</span>
                  </div>
                  <div>
                    <p className="font-medium">Boleto Bancário</p>
                    <p className="text-sm text-muted-foreground">Vencimento em 3 dias</p>
                  </div>
                </div>
                <Switch
                  checked={settings.podpay_boleto_enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, podpay_boleto_enabled: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Webhook URL */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <CardTitle>Configuração de Webhook</CardTitle>
            </div>
            <CardDescription>
              Configure esta URL no painel da PodPay para receber notificações de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success("URL copiada!");
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Configure os eventos: payment.approved, payment.refused, payment.refunded, payment.chargeback
            </p>
          </CardContent>
        </Card>

        {/* Webhook Logs */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Logs de Webhook</CardTitle>
            <CardDescription>
              Histórico de notificações recebidas da PodPay
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookLogsTable />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={loadSettings}>
            Cancelar
          </Button>
          <Button onClick={saveSettings} disabled={isLoading}>
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Salvar Configurações
          </Button>
        </div>

        {/* Dialog para trocar credenciais */}
        <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Atualizar Credenciais da API
              </DialogTitle>
              <DialogDescription>
                Insira as novas credenciais da PodPay. Deixe em branco os campos que não deseja alterar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Chave Privada */}
              <div className="space-y-2">
                <Label htmlFor="new_secret_key">Chave Privada (Secret Key)</Label>
                <div className="relative">
                  <Input
                    id="new_secret_key"
                    type={showSecretKey ? "text" : "password"}
                    placeholder="sk_..."
                    value={newCredentials.secretKey}
                    onChange={(e) =>
                      setNewCredentials((prev) => ({ ...prev, secretKey: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Chave Pública */}
              <div className="space-y-2">
                <Label htmlFor="new_public_key">Chave Pública (Public Key)</Label>
                <div className="relative">
                  <Input
                    id="new_public_key"
                    type={showPublicKey ? "text" : "password"}
                    placeholder="pk_..."
                    value={newCredentials.publicKey}
                    onChange={(e) =>
                      setNewCredentials((prev) => ({ ...prev, publicKey: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPublicKey(!showPublicKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPublicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Chave de Saque Externo */}
              <div className="space-y-2">
                <Label htmlFor="new_withdrawal_key">Chave de Saque Externo</Label>
                <div className="relative">
                  <Input
                    id="new_withdrawal_key"
                    type={showWithdrawalKey ? "text" : "password"}
                    placeholder="wk_..."
                    value={newCredentials.withdrawalKey}
                    onChange={(e) =>
                      setNewCredentials((prev) => ({ ...prev, withdrawalKey: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowWithdrawalKey(!showWithdrawalKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWithdrawalKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Após salvar, clique em "Verificar Conexão" para confirmar que as novas credenciais estão funcionando.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCredentialsDialog(false);
                  setNewCredentials({ secretKey: "", publicKey: "", withdrawalKey: "" });
                  setShowSecretKey(false);
                  setShowPublicKey(false);
                  setShowWithdrawalKey(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!newCredentials.secretKey && !newCredentials.publicKey && !newCredentials.withdrawalKey) {
                    toast.error("Preencha pelo menos uma credencial para atualizar");
                    return;
                  }

                  setIsSavingCredentials(true);
                  try {
                    // Save credentials to system_settings (these will be synced to secrets)
                    const updates = [];
                    
                    if (newCredentials.secretKey) {
                      updates.push({ 
                        key: 'podpay_secret_key_pending', 
                        value: newCredentials.secretKey,
                        description: 'PodPay Secret Key (pending update)'
                      });
                    }
                    if (newCredentials.publicKey) {
                      updates.push({ 
                        key: 'podpay_public_key_pending', 
                        value: newCredentials.publicKey,
                        description: 'PodPay Public Key (pending update)'
                      });
                    }
                    if (newCredentials.withdrawalKey) {
                      updates.push({ 
                        key: 'podpay_withdrawal_key_pending', 
                        value: newCredentials.withdrawalKey,
                        description: 'PodPay Withdrawal Key (pending update)'
                      });
                    }

                    for (const update of updates) {
                      const { error } = await supabase
                        .from("system_settings")
                        .upsert(update, { onConflict: "key" });
                      
                      if (error) throw error;
                    }

                    toast.success("Credenciais salvas! As novas chaves serão aplicadas automaticamente.", {
                      description: "Clique em 'Verificar Conexão' para testar."
                    });
                    
                    setShowCredentialsDialog(false);
                    setNewCredentials({ secretKey: "", publicKey: "", withdrawalKey: "" });
                    setShowSecretKey(false);
                    setShowPublicKey(false);
                    setShowWithdrawalKey(false);
                    setConnectionStatus("idle");
                  } catch (error) {
                    console.error("Erro ao salvar credenciais:", error);
                    toast.error("Erro ao salvar credenciais");
                  } finally {
                    setIsSavingCredentials(false);
                  }
                }}
                disabled={isSavingCredentials}
              >
                {isSavingCredentials ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Credenciais
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminGateway;
