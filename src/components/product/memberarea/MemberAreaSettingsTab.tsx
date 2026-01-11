import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Image as ImageIcon, Clock, Bell, Palette, Globe, Sparkles, Shield, Mail, Eye, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MemberAreaSettingsTabProps {
  productId: string;
}

interface SettingsData {
  id?: string;
  area_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  custom_domain: string;
  welcome_message: string;
  access_duration_days: number;
  allow_free_lessons: boolean;
  require_email_verification: boolean;
  send_welcome_email: boolean;
}

const defaultSettings: SettingsData = {
  area_name: "",
  logo_url: "",
  primary_color: "#3b82f6",
  secondary_color: "#1e40af",
  custom_domain: "",
  welcome_message: "",
  access_duration_days: 0,
  allow_free_lessons: true,
  require_email_verification: false,
  send_welcome_email: true,
};

interface SettingCardProps {
  icon: React.ReactNode;
  iconColor?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  rightContent?: React.ReactNode;
  isActive?: boolean;
  glowColor?: string;
}

const SettingCard = ({ 
  icon, 
  iconColor = "text-gray-400", 
  title, 
  description, 
  children, 
  rightContent,
  isActive = false,
  glowColor = "from-blue-500/20 to-cyan-500/20"
}: SettingCardProps) => (
  <div className={cn(
    "relative rounded-xl p-4 transition-all duration-300",
    "bg-[#0d1117]/80 border border-gray-800/60",
    isActive && "border-transparent",
    "hover:border-gray-700/60"
  )}>
    {isActive && (
      <div className={cn(
        "absolute inset-0 rounded-xl bg-gradient-to-r opacity-30",
        glowColor
      )} />
    )}
    <div className="relative flex items-start gap-4">
      <div className={cn(
        "flex-shrink-0 p-2.5 rounded-lg",
        isActive ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20" : "bg-gray-800/50"
      )}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-white font-medium text-sm">{title}</h4>
            {description && (
              <p className="text-gray-500 text-xs mt-0.5">{description}</p>
            )}
          </div>
          {rightContent}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  </div>
);

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}

const Section = ({ icon, title, badge, children }: SectionProps) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 px-1">
      <span className="text-gray-400">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
      {badge && (
        <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
          {badge}
        </span>
      )}
    </div>
    <div className="space-y-2">
      {children}
    </div>
  </div>
);

export default function MemberAreaSettingsTab({ productId }: MemberAreaSettingsTabProps) {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("member_area_settings")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          area_name: data.area_name || "",
          logo_url: data.logo_url || "",
          primary_color: data.primary_color || "#3b82f6",
          secondary_color: data.secondary_color || "#1e40af",
          custom_domain: data.custom_domain || "",
          welcome_message: data.welcome_message || "",
          access_duration_days: data.access_duration_days || 0,
          allow_free_lessons: data.allow_free_lessons ?? true,
          require_email_verification: data.require_email_verification ?? false,
          send_welcome_email: data.send_welcome_email ?? true,
        });
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [productId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.logo_url && !isValidUrl(settings.logo_url)) {
        toast({
          title: "URL inválida",
          description: "Por favor, insira uma URL válida para o logo.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      if (settings.custom_domain && !isValidDomain(settings.custom_domain)) {
        toast({
          title: "Domínio inválido",
          description: "Por favor, insira um domínio válido (ex: membros.suaempresa.com).",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      if (!isValidHexColor(settings.primary_color) || !isValidHexColor(settings.secondary_color)) {
        toast({
          title: "Cor inválida",
          description: "Por favor, insira cores em formato hexadecimal válido (ex: #3b82f6).",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const payload = {
        product_id: productId,
        area_name: settings.area_name || null,
        logo_url: settings.logo_url || null,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        custom_domain: settings.custom_domain || null,
        welcome_message: settings.welcome_message || null,
        access_duration_days: settings.access_duration_days,
        allow_free_lessons: settings.allow_free_lessons,
        require_email_verification: settings.require_email_verification,
        send_welcome_email: settings.send_welcome_email,
      };

      if (settings.id) {
        const { error } = await supabase
          .from("member_area_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("member_area_settings")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setSettings({ ...settings, id: data.id });
      }

      toast({
        title: "Configurações salvas!",
        description: "As configurações da área de membros foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidDomain = (domain: string): boolean => {
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  };

  const isValidHexColor = (color: string): boolean => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-500 text-sm">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Visual Identity Section */}
      <Section icon={<Sparkles className="h-4 w-4" />} title="Identidade Visual">
        <SettingCard
          icon={<ImageIcon className="h-4 w-4" />}
          iconColor="text-purple-400"
          title="Nome da Área"
          description="Como sua área de membros será identificada"
        >
          <Input
            value={settings.area_name}
            onChange={(e) => setSettings({ ...settings, area_name: e.target.value })}
            placeholder="Ex: Academia de Marketing"
            className="bg-[#161b22] border-gray-700/50 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-blue-500/20"
          />
        </SettingCard>

        <SettingCard
          icon={<ImageIcon className="h-4 w-4" />}
          iconColor="text-cyan-400"
          title="Logo"
          description="URL da imagem do logo"
        >
          <div className="space-y-3">
            <Input
              value={settings.logo_url}
              onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
              placeholder="https://..."
              className="bg-[#161b22] border-gray-700/50 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-blue-500/20"
            />
            {settings.logo_url && (
              <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                <img
                  src={settings.logo_url}
                  alt="Logo preview"
                  className="h-10 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </SettingCard>

        <SettingCard
          icon={<Mail className="h-4 w-4" />}
          iconColor="text-pink-400"
          title="Mensagem de Boas-vindas"
          description="Exibida para novos alunos"
        >
          <Textarea
            value={settings.welcome_message}
            onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
            placeholder="Bem-vindo à nossa área de membros exclusiva..."
            className="bg-[#161b22] border-gray-700/50 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-blue-500/20 min-h-[80px] resize-none"
          />
        </SettingCard>
      </Section>

      {/* Colors Section */}
      <Section icon={<Palette className="h-4 w-4" />} title="Cores">
        <div className="grid grid-cols-2 gap-3">
          <SettingCard
            icon={<div className="w-4 h-4 rounded-full" style={{ backgroundColor: settings.primary_color }} />}
            iconColor=""
            title="Cor Principal"
          >
            <div className="flex gap-2">
              <div className="relative">
                <Input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-10 h-10 p-0.5 bg-transparent border-gray-700/50 cursor-pointer rounded-lg overflow-hidden"
                />
              </div>
              <Input
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                placeholder="#3b82f6"
                className="bg-[#161b22] border-gray-700/50 text-white font-mono text-sm flex-1"
              />
            </div>
          </SettingCard>

          <SettingCard
            icon={<div className="w-4 h-4 rounded-full" style={{ backgroundColor: settings.secondary_color }} />}
            iconColor=""
            title="Cor Secundária"
          >
            <div className="flex gap-2">
              <div className="relative">
                <Input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="w-10 h-10 p-0.5 bg-transparent border-gray-700/50 cursor-pointer rounded-lg overflow-hidden"
                />
              </div>
              <Input
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                placeholder="#1e40af"
                className="bg-[#161b22] border-gray-700/50 text-white font-mono text-sm flex-1"
              />
            </div>
          </SettingCard>
        </div>
      </Section>

      {/* Custom Domain Section */}
      <Section icon={<Globe className="h-4 w-4" />} title="Domínio Personalizado" badge="PRO">
        <SettingCard
          icon={<Globe className="h-4 w-4" />}
          iconColor="text-green-400"
          title="Domínio ou Subdomínio"
          description="Configure um domínio personalizado para sua área de membros"
        >
          <Input
            value={settings.custom_domain}
            onChange={(e) => setSettings({ ...settings, custom_domain: e.target.value })}
            placeholder="membros.suaempresa.com"
            className="bg-[#161b22] border-gray-700/50 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-blue-500/20"
          />
        </SettingCard>
      </Section>

      {/* Access Settings Section */}
      <Section icon={<Clock className="h-4 w-4" />} title="Acesso e Duração">
        <SettingCard
          icon={<Clock className="h-4 w-4" />}
          iconColor="text-yellow-400"
          title="Duração do Acesso"
          description="Deixe em 0 para acesso vitalício"
        >
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={settings.access_duration_days}
              onChange={(e) => setSettings({ ...settings, access_duration_days: parseInt(e.target.value) || 0 })}
              className="bg-[#161b22] border-gray-700/50 text-white w-24 text-center"
            />
            <span className="text-gray-500 text-sm">dias</span>
          </div>
        </SettingCard>

        <SettingCard
          icon={<Eye className="h-4 w-4" />}
          iconColor="text-blue-400"
          title="Permitir Aulas Gratuitas"
          description="Visitantes podem ver aulas marcadas como gratuitas"
          rightContent={
            <Switch
              checked={settings.allow_free_lessons}
              onCheckedChange={(checked) => setSettings({ ...settings, allow_free_lessons: checked })}
              className="data-[state=checked]:bg-blue-500"
            />
          }
          isActive={settings.allow_free_lessons}
          glowColor="from-blue-500/10 to-cyan-500/10"
        />
      </Section>

      {/* Notifications Section */}
      <Section icon={<Bell className="h-4 w-4" />} title="Notificações">
        <SettingCard
          icon={<Mail className="h-4 w-4" />}
          iconColor="text-green-400"
          title="Email de Boas-vindas"
          description="Enviar email quando um aluno for matriculado"
          rightContent={
            <Switch
              checked={settings.send_welcome_email}
              onCheckedChange={(checked) => setSettings({ ...settings, send_welcome_email: checked })}
              className="data-[state=checked]:bg-green-500"
            />
          }
          isActive={settings.send_welcome_email}
          glowColor="from-green-500/10 to-emerald-500/10"
        />

        <SettingCard
          icon={<Shield className="h-4 w-4" />}
          iconColor="text-orange-400"
          title="Verificação de Email"
          description="Exigir verificação de email para acessar"
          rightContent={
            <Switch
              checked={settings.require_email_verification}
              onCheckedChange={(checked) => setSettings({ ...settings, require_email_verification: checked })}
              className="data-[state=checked]:bg-orange-500"
            />
          }
          isActive={settings.require_email_verification}
          glowColor="from-orange-500/10 to-amber-500/10"
        />
      </Section>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-800/50">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-6 shadow-lg shadow-blue-500/20"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
