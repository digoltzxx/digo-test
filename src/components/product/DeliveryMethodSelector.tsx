import React, { forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  CreditCard, 
  Mail, 
  Users,
  CheckCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DeliveryMethod = 'payment_only' | 'email' | 'member_area';

interface DeliveryMethodSelectorProps {
  value: DeliveryMethod;
  onChange: (value: DeliveryMethod) => void;
  paymentType: string;
  emailConfig?: {
    subject: string;
    body: string;
    contentUrl: string;
  };
  onEmailConfigChange?: (config: { subject: string; body: string; contentUrl: string }) => void;
}

const deliveryOptions = [
  {
    id: 'payment_only' as DeliveryMethod,
    title: 'Apenas Receber Pagamentos',
    description: 'O produto não possui entrega automática. Ideal para cobranças, vendas manuais ou serviços externos.',
    icon: CreditCard,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
  },
  {
    id: 'email' as DeliveryMethod,
    title: 'Entrega via Email',
    description: 'O produto será entregue exclusivamente por email após o pagamento. Configure o conteúdo do email abaixo.',
    icon: Mail,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50',
  },
  {
    id: 'member_area' as DeliveryMethod,
    title: 'Área de Membros',
    description: 'O cliente terá acesso a uma área de membros após o pagamento. Ideal para cursos e conteúdos digitais.',
    icon: Users,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
  },
];

export const DeliveryMethodSelector = forwardRef<HTMLDivElement, DeliveryMethodSelectorProps>(({
  value,
  onChange,
  paymentType,
  emailConfig = { subject: '', body: '', contentUrl: '' },
  onEmailConfigChange,
}, ref) => {
  return (
    <div ref={ref} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-4 h-4 text-blue-400" />
        <h3 className="text-white font-medium">Como este produto será entregue?</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Escolha apenas uma opção. A entrega será executada automaticamente após a confirmação do pagamento.
      </p>

      <div className="grid gap-3">
        {deliveryOptions.map((option) => {
          const isSelected = value === option.id;
          const Icon = option.icon;

          return (
            <div key={option.id}>
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:bg-muted/30",
                  isSelected 
                    ? `${option.bgColor} ${option.borderColor} border-2` 
                    : "bg-card border-border hover:border-muted-foreground/50"
                )}
                onClick={() => onChange(option.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                      isSelected ? option.bgColor : "bg-muted/50"
                    )}>
                      <Icon className={cn("w-6 h-6", isSelected ? option.color : "text-muted-foreground")} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={cn(
                          "font-medium",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {option.title}
                        </h4>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                      
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Configuration - shown only when email is selected */}
              {option.id === 'email' && isSelected && onEmailConfigChange && (
                <Card className="mt-3 bg-card border-border ml-6">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-orange-400">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">Configuração do Email</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Assunto do Email</Label>
                        <Input
                          value={emailConfig.subject}
                          onChange={(e) => onEmailConfigChange({ ...emailConfig, subject: e.target.value })}
                          placeholder="Ex: Seu acesso ao produto {{product_name}}"
                          className="mt-1 bg-background"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use {"{{product_name}}"} para incluir o nome do produto
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Link/URL do Conteúdo (opcional)</Label>
                        <Input
                          value={emailConfig.contentUrl}
                          onChange={(e) => onEmailConfigChange({ ...emailConfig, contentUrl: e.target.value })}
                          placeholder="https://..."
                          className="mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Corpo do Email (HTML)</Label>
                        <Textarea
                          value={emailConfig.body}
                          onChange={(e) => onEmailConfigChange({ ...emailConfig, body: e.target.value })}
                          placeholder={`Olá {{user_name}},\n\nObrigado por adquirir {{product_name}}!\n\nAcesse seu conteúdo: {{content_url}}`}
                          className="mt-1 bg-background min-h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Variáveis: {"{{user_name}}"}, {"{{product_name}}"}, {"{{content_url}}"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      {/* Informational card about delivery flow */}
      <Card className="bg-blue-500/5 border-blue-500/20 mt-4">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-400">Como funciona a entrega?</h4>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• A entrega é executada <strong>automaticamente</strong> após confirmação do pagamento</li>
                <li>• O sistema registra um log de cada entrega para auditoria</li>
                <li>• Você pode acompanhar as entregas na aba "Entregáveis"</li>
                {value === 'member_area' && (
                  <li>• Os membros podem ser gerenciados na aba "Alunos"</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

DeliveryMethodSelector.displayName = "DeliveryMethodSelector";

export default DeliveryMethodSelector;
