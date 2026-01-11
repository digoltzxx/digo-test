import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Settings, Save, Users, Bell, MessageSquare, AlertCircle, CheckCircle2, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductSettings {
  id?: string;
  product_id: string;
  enable_affiliates: boolean;
  affiliate_commission: number;
  enable_pixel_facebook: string;
  enable_pixel_google: string;
  enable_pixel_tiktok: string;
  custom_thank_you_message: string;
  enable_email_notifications: boolean;
  enable_whatsapp_notifications: boolean;
  whatsapp_number: string;
}

interface ConfiguracoesTabProps {
  productId: string;
}

interface ValidationErrors {
  affiliate_commission?: string;
  whatsapp_number?: string;
  custom_thank_you_message?: string;
}

const DEFAULT_THANK_YOU_MESSAGE = "Obrigado pela sua compra! Em breve você receberá o acesso.";
const MAX_MESSAGE_LENGTH = 500;
const MIN_COMMISSION = 1;
const MAX_COMMISSION = 90;

const ConfiguracoesTab = ({ productId }: ConfiguracoesTabProps) => {
  const [settings, setSettings] = useState<ProductSettings>({
    product_id: productId,
    enable_affiliates: false,
    affiliate_commission: 30,
    enable_pixel_facebook: "",
    enable_pixel_google: "",
    enable_pixel_tiktok: "",
    custom_thank_you_message: "",
    enable_email_notifications: true,
    enable_whatsapp_notifications: false,
    whatsapp_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<ProductSettings | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchUserEmail();
  }, [productId]);

  // Track changes
  useEffect(() => {
    if (originalSettings) {
      const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    }
  }, [settings, originalSettings]);

  const fetchUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("product_settings")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const loadedSettings = {
          id: data.id,
          product_id: data.product_id,
          enable_affiliates: data.enable_affiliates ?? false,
          affiliate_commission: data.affiliate_commission ?? 30,
          enable_pixel_facebook: data.enable_pixel_facebook || "",
          enable_pixel_google: data.enable_pixel_google || "",
          enable_pixel_tiktok: data.enable_pixel_tiktok || "",
          custom_thank_you_message: data.custom_thank_you_message || "",
          enable_email_notifications: data.enable_email_notifications ?? true,
          enable_whatsapp_notifications: data.enable_whatsapp_notifications ?? false,
          whatsapp_number: data.whatsapp_number || "",
        };
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
      } else {
        setOriginalSettings(settings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate affiliate commission
    if (settings.enable_affiliates) {
      if (settings.affiliate_commission < MIN_COMMISSION) {
        newErrors.affiliate_commission = `Comissão mínima é ${MIN_COMMISSION}%`;
      } else if (settings.affiliate_commission > MAX_COMMISSION) {
        newErrors.affiliate_commission = `Comissão máxima é ${MAX_COMMISSION}%`;
      } else if (isNaN(settings.affiliate_commission)) {
        newErrors.affiliate_commission = "Informe um valor válido";
      }
    }

    // Validate WhatsApp number
    if (settings.enable_whatsapp_notifications) {
      const cleanNumber = settings.whatsapp_number.replace(/\D/g, "");
      if (!cleanNumber) {
        newErrors.whatsapp_number = "Informe o número de WhatsApp";
      } else if (cleanNumber.length < 10 || cleanNumber.length > 13) {
        newErrors.whatsapp_number = "Número de WhatsApp inválido (10-13 dígitos)";
      }
    }

    // Validate thank you message length
    if (settings.custom_thank_you_message.length > MAX_MESSAGE_LENGTH) {
      newErrors.custom_thank_you_message = `Máximo de ${MAX_MESSAGE_LENGTH} caracteres`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleToggleAffiliates = async (enabled: boolean) => {
    setSettings(prev => ({ ...prev, enable_affiliates: enabled }));
    
    // If disabling affiliates, also deactivate existing affiliate links
    if (!enabled) {
      try {
        await supabase
          .from("affiliations")
          .update({ status: "inactive" })
          .eq("product_id", productId);
      } catch (error) {
        console.error("Error deactivating affiliations:", error);
      }
    }
  };

  const handleToggleWhatsApp = (enabled: boolean) => {
    // Validate WhatsApp number exists before enabling
    if (enabled && !settings.whatsapp_number) {
      toast.error("Informe o número de WhatsApp primeiro");
      return;
    }
    setSettings(prev => ({ ...prev, enable_whatsapp_notifications: enabled }));
  };

  const handleToggleEmail = (enabled: boolean) => {
    // Validate user has email before enabling
    if (enabled && !userEmail) {
      toast.error("Você precisa ter um email cadastrado para receber notificações");
      return;
    }
    setSettings(prev => ({ ...prev, enable_email_notifications: enabled }));
  };

  const handleCommissionChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    // Clamp value between min and max
    const clampedValue = Math.min(Math.max(numValue, 0), 100);
    setSettings(prev => ({ ...prev, affiliate_commission: clampedValue }));
    
    // Clear error if value is now valid
    if (clampedValue >= MIN_COMMISSION && clampedValue <= MAX_COMMISSION) {
      setErrors(prev => ({ ...prev, affiliate_commission: undefined }));
    }
  };

  const handleWhatsAppChange = (value: string) => {
    // Only allow numbers
    const cleanValue = value.replace(/\D/g, "").slice(0, 13);
    setSettings(prev => ({ ...prev, whatsapp_number: cleanValue }));
    
    // Clear error if valid
    if (cleanValue.length >= 10) {
      setErrors(prev => ({ ...prev, whatsapp_number: undefined }));
    }
  };

  const handleMessageChange = (value: string) => {
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setSettings(prev => ({ ...prev, custom_thank_you_message: value }));
      setErrors(prev => ({ ...prev, custom_thank_you_message: undefined }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_id: productId,
        enable_affiliates: settings.enable_affiliates,
        affiliate_commission: settings.enable_affiliates ? settings.affiliate_commission : 0,
        enable_pixel_facebook: settings.enable_pixel_facebook || null,
        enable_pixel_google: settings.enable_pixel_google || null,
        enable_pixel_tiktok: settings.enable_pixel_tiktok || null,
        custom_thank_you_message: settings.custom_thank_you_message || null,
        enable_email_notifications: settings.enable_email_notifications,
        enable_whatsapp_notifications: settings.enable_whatsapp_notifications,
        whatsapp_number: settings.whatsapp_number || null,
      };

      if (settings.id) {
        const { error } = await supabase
          .from("product_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_settings")
          .insert(payload);

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
      setHasChanges(false);
      fetchSettings();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const formatWhatsAppDisplay = (number: string) => {
    if (!number) return "";
    const clean = number.replace(/\D/g, "");
    if (clean.length <= 2) return clean;
    if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
    if (clean.length <= 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  };

  if (loading) {
    return (
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Afiliados */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Afiliados</h3>
          </div>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg border border-gray-700/50">
              <div>
                <Label className="text-white font-medium">Permitir afiliados</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Permitir que afiliados promovam este produto e recebam comissão
                </p>
              </div>
              <Switch
                checked={settings.enable_affiliates}
                onCheckedChange={handleToggleAffiliates}
              />
            </div>

            <div className={`transition-all duration-300 ${settings.enable_affiliates ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <Label className="text-gray-400 text-sm">Comissão de Afiliados (%)</Label>
              <div className="flex items-center gap-3 mt-2">
                <Input
                  type="number"
                  min={MIN_COMMISSION}
                  max={MAX_COMMISSION}
                  value={settings.affiliate_commission}
                  onChange={(e) => handleCommissionChange(e.target.value)}
                  disabled={!settings.enable_affiliates}
                  className={`bg-[#0d1117] border-gray-700 text-white w-32 ${errors.affiliate_commission ? 'border-red-500' : ''}`}
                />
                <span className="text-gray-400 text-sm">
                  (Mínimo: {MIN_COMMISSION}% • Máximo: {MAX_COMMISSION}%)
                </span>
              </div>
              {errors.affiliate_commission && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.affiliate_commission}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                A cada venda via afiliado, será calculado: <span className="text-blue-400">valor × {settings.affiliate_commission}%</span>
              </p>
            </div>

            {!settings.enable_affiliates && (
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-200 text-sm">
                  Com afiliados desativados, todos os links de afiliados existentes serão desativados.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Notificações de Vendas</h3>
          </div>
          
          <div className="space-y-5">
            {/* Email Notifications */}
            <div className="p-4 bg-[#0d1117] rounded-lg border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Notificações por Email</Label>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Receber email a cada nova venda confirmada
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.enable_email_notifications}
                  onCheckedChange={handleToggleEmail}
                />
              </div>
              {settings.enable_email_notifications && userEmail && (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <p className="text-xs text-gray-400 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    Emails serão enviados para: <span className="text-white">{userEmail}</span>
                  </p>
                </div>
              )}
            </div>

            {/* WhatsApp Notifications */}
            <div className="p-4 bg-[#0d1117] rounded-lg border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <Label className="text-white font-medium">Notificações por WhatsApp</Label>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Receber mensagem via WhatsApp a cada venda
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.enable_whatsapp_notifications}
                  onCheckedChange={handleToggleWhatsApp}
                  disabled={!settings.whatsapp_number}
                />
              </div>
              
              <div className="mt-4">
                <Label className="text-gray-400 text-sm">Número de WhatsApp</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={formatWhatsAppDisplay(settings.whatsapp_number)}
                    onChange={(e) => handleWhatsAppChange(e.target.value)}
                    className={`bg-[#161b22] border-gray-700 text-white flex-1 ${errors.whatsapp_number ? 'border-red-500' : ''}`}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                {errors.whatsapp_number && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.whatsapp_number}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Informe o número com DDD para receber notificações
                </p>
              </div>
            </div>

            <Alert className="bg-blue-500/10 border-blue-500/30">
              <Bell className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-200 text-sm">
                As notificações incluem: nome do produto, valor da venda, data/hora e identificador da transação.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Mensagem de Agradecimento */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Mensagem Personalizada</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400 text-sm">Mensagem de Agradecimento</Label>
              <Textarea
                value={settings.custom_thank_you_message}
                onChange={(e) => handleMessageChange(e.target.value)}
                className={`bg-[#0d1117] border-gray-700 text-white mt-2 resize-none ${errors.custom_thank_you_message ? 'border-red-500' : ''}`}
                placeholder={DEFAULT_THANK_YOU_MESSAGE}
                rows={4}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Esta mensagem será exibida na tela de sucesso após o pagamento
                </p>
                <span className={`text-xs ${settings.custom_thank_you_message.length > MAX_MESSAGE_LENGTH * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {settings.custom_thank_you_message.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
              {errors.custom_thank_you_message && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.custom_thank_you_message}
                </p>
              )}
            </div>

            {!settings.custom_thank_you_message && (
              <div className="p-3 bg-[#0d1117] rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-400">
                  <span className="text-gray-300">Mensagem padrão:</span> "{DEFAULT_THANK_YOU_MESSAGE}"
                </p>
              </div>
            )}

            <Alert className="bg-green-500/10 border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-200 text-sm">
                Você pode usar emojis e quebras de linha para personalizar sua mensagem! 🎉
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex items-center justify-between">
        <div>
          {hasChanges && (
            <p className="text-sm text-yellow-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Você tem alterações não salvas
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-8 transition-all ${hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'} text-white`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ConfiguracoesTab;
