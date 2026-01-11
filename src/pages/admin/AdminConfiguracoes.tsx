import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Wallet, Loader2, CreditCard, Banknote, QrCode, Building2, Image, FlaskConical } from "lucide-react";
import BannerCarouselManager from "@/components/admin/BannerCarouselManager";
import { ABTestDashboard } from "@/components/admin/ABTestDashboard";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FeeSettings {
  // PIX
  pix_instant_percent: string;
  pix_instant_fixed: string;
  // Boleto
  boleto_percent: string;
  boleto_fixed: string;
  boleto_days: string;
  // Cartão de Crédito
  card_2d_percent: string;
  card_2d_fixed: string;
  card_7d_percent: string;
  card_7d_fixed: string;
  card_15d_percent: string;
  card_15d_fixed: string;
  card_30d_percent: string;
  card_30d_fixed: string;
  // Taxa da Adquirente (fixa por transação)
  acquirer_fee: string;
  // Reserva de Segurança - Cartão
  reserve_card_7d: string;
  reserve_card_15d: string;
  reserve_card_30d: string;
  // Reserva de Segurança - PIX
  reserve_pix_days: string;
  reserve_pix_percent: string;
}


const AdminConfiguracoes = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("geral");
  const [settings, setSettings] = useState({
    withdrawalFee: 4.90,
    minWithdrawal: 50,
    autoApproveWithdrawals: false,
    autoApproveBankAccounts: false,
    enableEmailNotifications: true,
    maintenanceMode: false,
  });

  const [feeSettings, setFeeSettings] = useState<FeeSettings>({
    pix_instant_percent: "4.99",
    pix_instant_fixed: "1.49",
    boleto_percent: "5.99",
    boleto_fixed: "1.49",
    boleto_days: "2",
    card_2d_percent: "6.99",
    card_2d_fixed: "1.49",
    card_7d_percent: "6.99",
    card_7d_fixed: "1.49",
    card_15d_percent: "6.99",
    card_15d_fixed: "1.49",
    card_30d_percent: "4.99",
    card_30d_fixed: "1.49",
    acquirer_fee: "0.60",
    reserve_card_7d: "10",
    reserve_card_15d: "10",
    reserve_card_30d: "10",
    reserve_pix_days: "10",
    reserve_pix_percent: "0",
  });


  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      setSettings(prev => ({
        ...prev,
        withdrawalFee: parseFloat(settingsMap['withdrawal_fee'] || '4.90'),
        minWithdrawal: parseFloat(settingsMap['minimum_withdrawal'] || '50'),
        autoApproveWithdrawals: settingsMap['auto_approve_withdrawals'] === 'true',
        autoApproveBankAccounts: settingsMap['auto_approve_bank_accounts'] === 'true',
        enableEmailNotifications: settingsMap['enable_email_notifications'] !== 'false',
        maintenanceMode: settingsMap['maintenance_mode'] === 'true',
      }));

      setFeeSettings(prev => ({
        ...prev,
        pix_instant_percent: settingsMap['pix_instant_percent'] || '4.99',
        pix_instant_fixed: settingsMap['pix_instant_fixed'] || '1.49',
        boleto_percent: settingsMap['boleto_percent'] || '5.99',
        boleto_fixed: settingsMap['boleto_fixed'] || '1.49',
        boleto_days: settingsMap['boleto_days'] || '2',
        card_2d_percent: settingsMap['card_2d_percent'] || '6.99',
        card_2d_fixed: settingsMap['card_2d_fixed'] || '1.49',
        card_7d_percent: settingsMap['card_7d_percent'] || '6.99',
        card_7d_fixed: settingsMap['card_7d_fixed'] || '1.49',
        card_15d_percent: settingsMap['card_15d_percent'] || '6.99',
        card_15d_fixed: settingsMap['card_15d_fixed'] || '1.49',
        card_30d_percent: settingsMap['card_30d_percent'] || '4.99',
        card_30d_fixed: settingsMap['card_30d_fixed'] || '1.49',
        acquirer_fee: settingsMap['acquirer_fee'] || '0.60',
        reserve_card_7d: settingsMap['reserve_card_7d'] || '10',
        reserve_card_15d: settingsMap['reserve_card_15d'] || '10',
        reserve_card_30d: settingsMap['reserve_card_30d'] || '10',
        reserve_pix_days: settingsMap['reserve_pix_days'] || '10',
        reserve_pix_percent: settingsMap['reserve_pix_percent'] || '0',
      }));

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Track previous maintenance mode to detect changes
  const [prevMaintenanceMode, setPrevMaintenanceMode] = useState<boolean | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if maintenance mode changed
      const maintenanceModeChanged = prevMaintenanceMode !== null && prevMaintenanceMode !== settings.maintenanceMode;
      
      const settingsToSave = [
        { key: 'withdrawal_fee', value: settings.withdrawalFee.toString(), description: 'Taxa de saque em R$' },
        { key: 'minimum_withdrawal', value: settings.minWithdrawal.toString(), description: 'Valor mínimo de saque em R$' },
        { key: 'auto_approve_withdrawals', value: settings.autoApproveWithdrawals.toString(), description: 'Aprovar saques automaticamente' },
        { key: 'auto_approve_bank_accounts', value: settings.autoApproveBankAccounts.toString(), description: 'Aprovar contas bancárias automaticamente' },
        { key: 'enable_email_notifications', value: settings.enableEmailNotifications.toString(), description: 'Habilitar notificações por email' },
        { key: 'maintenance_mode', value: settings.maintenanceMode.toString(), description: 'Modo de manutenção' },
        // Fee settings
        { key: 'pix_instant_percent', value: feeSettings.pix_instant_percent, description: 'PIX - Taxa percentual' },
        { key: 'pix_instant_fixed', value: feeSettings.pix_instant_fixed, description: 'PIX - Taxa fixa' },
        { key: 'boleto_percent', value: feeSettings.boleto_percent, description: 'Boleto - Taxa percentual' },
        { key: 'boleto_fixed', value: feeSettings.boleto_fixed, description: 'Boleto - Taxa fixa' },
        { key: 'boleto_days', value: feeSettings.boleto_days, description: 'Boleto - Dias para disponibilidade' },
        { key: 'card_2d_percent', value: feeSettings.card_2d_percent, description: 'Cartão 2 dias - Taxa percentual' },
        { key: 'card_2d_fixed', value: feeSettings.card_2d_fixed, description: 'Cartão 2 dias - Taxa fixa' },
        { key: 'card_7d_percent', value: feeSettings.card_7d_percent, description: 'Cartão 7 dias - Taxa percentual' },
        { key: 'card_7d_fixed', value: feeSettings.card_7d_fixed, description: 'Cartão 7 dias - Taxa fixa' },
        { key: 'card_15d_percent', value: feeSettings.card_15d_percent, description: 'Cartão 15 dias - Taxa percentual' },
        { key: 'card_15d_fixed', value: feeSettings.card_15d_fixed, description: 'Cartão 15 dias - Taxa fixa' },
        { key: 'card_30d_percent', value: feeSettings.card_30d_percent, description: 'Cartão 30 dias - Taxa percentual' },
        { key: 'card_30d_fixed', value: feeSettings.card_30d_fixed, description: 'Cartão 30 dias - Taxa fixa' },
        { key: 'acquirer_fee', value: feeSettings.acquirer_fee, description: 'Taxa da Adquirente por transação' },
        { key: 'reserve_card_7d', value: feeSettings.reserve_card_7d, description: 'Reserva Cartão 7 dias' },
        { key: 'reserve_card_15d', value: feeSettings.reserve_card_15d, description: 'Reserva Cartão 15 dias' },
        { key: 'reserve_card_30d', value: feeSettings.reserve_card_30d, description: 'Reserva Cartão 30 dias' },
        { key: 'reserve_pix_days', value: feeSettings.reserve_pix_days, description: 'Reserva PIX - Dias' },
        { key: 'reserve_pix_percent', value: feeSettings.reserve_pix_percent, description: 'Reserva PIX - Percentual' },
      ];

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('system_settings')
          .upsert(
            { 
              key: setting.key, 
              value: setting.value, 
              description: setting.description,
              updated_by: user?.id 
            },
            { onConflict: 'key' }
          );

        if (error) throw error;
      }

      // Log the action in audit log
      await supabase.rpc('log_admin_action', {
        p_user_id: user?.id,
        p_action_type: 'settings_updated',
        p_entity_type: 'system_settings',
        p_entity_id: null,
        p_details: {
          auto_approve_withdrawals: settings.autoApproveWithdrawals,
          auto_approve_bank_accounts: settings.autoApproveBankAccounts,
          maintenance_mode: settings.maintenanceMode,
          enable_email_notifications: settings.enableEmailNotifications
        }
      });

      // If maintenance mode changed, notify admins
      if (maintenanceModeChanged) {
        try {
          await supabase.functions.invoke('admin-notify', {
            body: {
              type: 'maintenance_mode',
              details: {
                enabled: settings.maintenanceMode,
                admin_email: user?.email
              }
            }
          });
        } catch (notifyError) {
          console.error('Failed to send maintenance notification:', notifyError);
        }
      }

      // Update previous maintenance mode state
      setPrevMaintenanceMode(settings.maintenanceMode);

      toast.success("Configurações salvas com sucesso");
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  // Set initial previous maintenance mode
  useEffect(() => {
    if (!loading && prevMaintenanceMode === null) {
      setPrevMaintenanceMode(settings.maintenanceMode);
    }
  }, [loading, settings.maintenanceMode, prevMaintenanceMode]);

  const FeeInput = ({ label, value, onChange, suffix = "%" }: { label: string; value: string; onChange: (val: string) => void; suffix?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações gerais da plataforma</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="taxas">Taxas de Transação</TabsTrigger>
            <TabsTrigger value="banners" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Banners
            </TabsTrigger>
            <TabsTrigger value="ab-test" className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              Teste A/B
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Configurações Financeiras
                  </CardTitle>
                  <CardDescription>
                    Configure taxas e valores mínimos para transações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdrawalFee">Taxa de Saque (R$)</Label>
                    <Input
                      id="withdrawalFee"
                      type="number"
                      step="0.01"
                      value={settings.withdrawalFee}
                      onChange={(e) => setSettings({ ...settings, withdrawalFee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minWithdrawal">Valor Mínimo de Saque (R$)</Label>
                    <Input
                      id="minWithdrawal"
                      type="number"
                      value={settings.minWithdrawal}
                      onChange={(e) => setSettings({ ...settings, minWithdrawal: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Aprovações Automáticas
                  </CardTitle>
                  <CardDescription>
                    Configure se certas ações devem ser aprovadas automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Aprovar saques automaticamente</Label>
                      <p className="text-xs text-muted-foreground">
                        Saques serão aprovados sem revisão manual
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoApproveWithdrawals}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoApproveWithdrawals: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Aprovar contas bancárias automaticamente</Label>
                      <p className="text-xs text-muted-foreground">
                        Contas bancárias serão aprovadas sem revisão
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoApproveBankAccounts}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoApproveBankAccounts: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notificações
                  </CardTitle>
                  <CardDescription>
                    Configure notificações do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificações por e-mail</Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar e-mails para admins sobre ações pendentes
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableEmailNotifications}
                      onCheckedChange={(checked) => setSettings({ ...settings, enableEmailNotifications: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Sistema
                  </CardTitle>
                  <CardDescription>
                    Configurações gerais do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Modo de manutenção</Label>
                      <p className="text-xs text-muted-foreground">
                        Bloquear acesso de usuários à plataforma
                      </p>
                    </div>
                    <Switch
                      checked={settings.maintenanceMode}
                      onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="taxas" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PIX */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    PIX
                  </CardTitle>
                  <CardDescription>Taxas para pagamentos via PIX</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">Na hora</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FeeInput
                          label="Taxa (%)"
                          value={feeSettings.pix_instant_percent}
                          onChange={(val) => setFeeSettings({ ...feeSettings, pix_instant_percent: val })}
                        />
                        <FeeInput
                          label="Taxa Fixa (R$)"
                          value={feeSettings.pix_instant_fixed}
                          onChange={(val) => setFeeSettings({ ...feeSettings, pix_instant_fixed: val })}
                          suffix="R$"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Boleto */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Boleto
                  </CardTitle>
                  <CardDescription>Taxas para pagamentos via Boleto</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="grid grid-cols-3 gap-3">
                        <FeeInput
                          label="Taxa (%)"
                          value={feeSettings.boleto_percent}
                          onChange={(val) => setFeeSettings({ ...feeSettings, boleto_percent: val })}
                        />
                        <FeeInput
                          label="Taxa Fixa (R$)"
                          value={feeSettings.boleto_fixed}
                          onChange={(val) => setFeeSettings({ ...feeSettings, boleto_fixed: val })}
                          suffix="R$"
                        />
                        <FeeInput
                          label="Dias"
                          value={feeSettings.boleto_days}
                          onChange={(val) => setFeeSettings({ ...feeSettings, boleto_days: val })}
                          suffix="d"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cartão de Crédito */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Cartão de Crédito
                  </CardTitle>
                  <CardDescription>Taxas para pagamentos via Cartão de Crédito</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">2 dias</p>
                      <div className="space-y-3">
                        <FeeInput
                          label="Taxa (%)"
                          value={feeSettings.card_2d_percent}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_2d_percent: val })}
                        />
                        <FeeInput
                          label="Taxa Fixa (R$)"
                          value={feeSettings.card_2d_fixed}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_2d_fixed: val })}
                          suffix="R$"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">7 dias</p>
                      <div className="space-y-3">
                        <FeeInput
                          label="Taxa (%)"
                          value={feeSettings.card_7d_percent}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_7d_percent: val })}
                        />
                        <FeeInput
                          label="Taxa Fixa (R$)"
                          value={feeSettings.card_7d_fixed}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_7d_fixed: val })}
                          suffix="R$"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">15 dias</p>
                      <div className="space-y-3">
                        <FeeInput
                          label="Taxa (%)"
                          value={feeSettings.card_15d_percent}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_15d_percent: val })}
                        />
                        <FeeInput
                          label="Taxa Fixa (R$)"
                          value={feeSettings.card_15d_fixed}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_15d_fixed: val })}
                          suffix="R$"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-3">30 dias</p>
                      <div className="space-y-3">
                        <FeeInput
                          label="Taxa (%)"
                          value={feeSettings.card_30d_percent}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_30d_percent: val })}
                        />
                        <FeeInput
                          label="Taxa Fixa (R$)"
                          value={feeSettings.card_30d_fixed}
                          onChange={(val) => setFeeSettings({ ...feeSettings, card_30d_fixed: val })}
                          suffix="R$"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Taxa da Adquirente */}
              <Card className="lg:col-span-2 border-orange-500/30 bg-orange-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-orange-500" />
                    Taxa da Adquirente
                  </CardTitle>
                  <CardDescription>
                    Custo operacional por transação aprovada (descontado do lucro do gateway)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 max-w-xs">
                      <FeeInput
                        label="Taxa Fixa por Transação (R$)"
                        value={feeSettings.acquirer_fee}
                        onChange={(val) => setFeeSettings({ ...feeSettings, acquirer_fee: val })}
                        suffix="R$"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Este valor é descontado de cada transação aprovada.</p>
                      <p className="text-orange-400 font-medium mt-1">
                        Exemplo: 100 transações × R$ {feeSettings.acquirer_fee} = R$ {(100 * parseFloat(feeSettings.acquirer_fee || '0')).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Reserva de Segurança (Cartão)
                  </CardTitle>
                  <CardDescription>Taxas de reserva para cartão de crédito</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-2">7 dias</p>
                      <FeeInput
                        label=""
                        value={feeSettings.reserve_card_7d}
                        onChange={(val) => setFeeSettings({ ...feeSettings, reserve_card_7d: val })}
                      />
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-2">15 dias</p>
                      <FeeInput
                        label=""
                        value={feeSettings.reserve_card_15d}
                        onChange={(val) => setFeeSettings({ ...feeSettings, reserve_card_15d: val })}
                      />
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-2">30 dias</p>
                      <FeeInput
                        label=""
                        value={feeSettings.reserve_card_30d}
                        onChange={(val) => setFeeSettings({ ...feeSettings, reserve_card_30d: val })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reserva de Segurança - PIX */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Reserva de Segurança (PIX)
                  </CardTitle>
                  <CardDescription>Taxas de reserva para PIX</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <FeeInput
                      label="Dias"
                      value={feeSettings.reserve_pix_days}
                      onChange={(val) => setFeeSettings({ ...feeSettings, reserve_pix_days: val })}
                      suffix="d"
                    />
                    <FeeInput
                      label="Taxa (%)"
                      value={feeSettings.reserve_pix_percent}
                      onChange={(val) => setFeeSettings({ ...feeSettings, reserve_pix_percent: val })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="banners" className="mt-6">
            <BannerCarouselManager />
          </TabsContent>

          <TabsContent value="ab-test" className="mt-6">
            <ABTestDashboard />
          </TabsContent>

        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminConfiguracoes;