import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, Mail, Phone, AlertCircle, CheckCircle2 } from "lucide-react";

interface NotificationSettingsProps {
  enableEmailNotifications: boolean;
  enableWhatsappNotifications: boolean;
  whatsappNumber: string;
  userEmail: string | null;
  onToggleEmail: (enabled: boolean) => void;
  onToggleWhatsapp: (enabled: boolean) => void;
  onWhatsappChange: (value: string) => void;
  whatsappError?: string;
}

export const formatWhatsAppDisplay = (number: string): string => {
  if (!number) return "";
  const clean = number.replace(/\D/g, "");
  if (clean.length <= 2) return clean;
  if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
};

export const validateWhatsAppNumber = (number: string): boolean => {
  const cleanNumber = number.replace(/\D/g, "");
  return cleanNumber.length >= 10 && cleanNumber.length <= 13;
};

const NotificationSettings = ({
  enableEmailNotifications,
  enableWhatsappNotifications,
  whatsappNumber,
  userEmail,
  onToggleEmail,
  onToggleWhatsapp,
  onWhatsappChange,
  whatsappError,
}: NotificationSettingsProps) => {
  return (
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
                checked={enableEmailNotifications}
                onCheckedChange={onToggleEmail}
                data-testid="toggle-email"
              />
            </div>
            {enableEmailNotifications && userEmail && (
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
                checked={enableWhatsappNotifications}
                onCheckedChange={onToggleWhatsapp}
                disabled={!whatsappNumber}
                data-testid="toggle-whatsapp"
              />
            </div>

            <div className="mt-4">
              <Label className="text-gray-400 text-sm">Número de WhatsApp</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={formatWhatsAppDisplay(whatsappNumber)}
                  onChange={(e) => onWhatsappChange(e.target.value)}
                  className={`bg-[#161b22] border-gray-700 text-white flex-1 ${
                    whatsappError ? "border-red-500" : ""
                  }`}
                  placeholder="(11) 99999-9999"
                  data-testid="input-whatsapp"
                />
              </div>
              {whatsappError && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="error-whatsapp">
                  <AlertCircle className="w-3 h-3" />
                  {whatsappError}
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
              As notificações incluem: nome do produto, valor da venda, data/hora e identificador da
              transação.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
