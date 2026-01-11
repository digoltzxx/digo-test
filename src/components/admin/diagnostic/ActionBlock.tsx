import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  Wrench, 
  Phone, 
  RefreshCw, 
  Mail, 
  RotateCcw, 
  UserPlus,
  ChevronRight,
  Copy,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export type ActionType = 
  | 'reprocess_delivery'
  | 'resend_email'
  | 'revalidate_subscription'
  | 'grant_access'
  | 'escalate';

interface Action {
  type: ActionType;
  label: string;
  icon: React.ElementType;
  variant: 'default' | 'outline' | 'destructive' | 'secondary';
  enabled: boolean;
}

interface ActionBlockProps {
  canResolveInternally: boolean;
  needsTechnicalEscalation: boolean;
  suggestedActions: string[];
  enabledActions: ActionType[];
  onAction?: (action: ActionType) => Promise<void>;
  summaryText?: string;
}

const availableActions: Action[] = [
  {
    type: 'reprocess_delivery',
    label: 'Reprocessar entrega',
    icon: RefreshCw,
    variant: 'default',
    enabled: true,
  },
  {
    type: 'resend_email',
    label: 'Reenviar email',
    icon: Mail,
    variant: 'outline',
    enabled: true,
  },
  {
    type: 'revalidate_subscription',
    label: 'Revalidar assinatura',
    icon: RotateCcw,
    variant: 'outline',
    enabled: true,
  },
  {
    type: 'grant_access',
    label: 'Liberar acesso',
    icon: UserPlus,
    variant: 'outline',
    enabled: true,
  },
  {
    type: 'escalate',
    label: 'Escalar para técnico',
    icon: Phone,
    variant: 'destructive',
    enabled: true,
  },
];

export function ActionBlock({
  canResolveInternally,
  needsTechnicalEscalation,
  suggestedActions,
  enabledActions,
  onAction,
  summaryText,
}: ActionBlockProps) {
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);

  const handleAction = async (action: ActionType) => {
    if (!onAction) {
      toast.info('Ação não implementada');
      return;
    }
    
    setLoadingAction(action);
    try {
      await onAction(action);
    } finally {
      setLoadingAction(null);
    }
  };

  const copyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success('Resumo copiado!');
    }
  };

  const visibleActions = availableActions.filter(a => enabledActions.includes(a.type));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {needsTechnicalEscalation ? (
            <Phone className="h-4 w-4 text-red-500" />
          ) : canResolveInternally ? (
            <Wrench className="h-4 w-4 text-yellow-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          Ações Sugeridas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Lista de sugestões */}
        <div className="space-y-2 mb-4">
          {suggestedActions.map((action, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span>{action}</span>
            </div>
          ))}
        </div>

        {/* Botões de ação */}
        {visibleActions.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-2">
              {visibleActions.map((action) => {
                const Icon = action.icon;
                const isLoading = loadingAction === action.type;
                
                return (
                  <Button
                    key={action.type}
                    variant={action.variant}
                    size="sm"
                    onClick={() => handleAction(action.type)}
                    disabled={isLoading || loadingAction !== null}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4 mr-2" />
                    )}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </>
        )}

        <Separator className="my-4" />

        {/* Status final */}
        <div className={`flex items-center justify-between p-3 rounded-lg ${
          needsTechnicalEscalation 
            ? 'bg-red-500/10' 
            : canResolveInternally
              ? 'bg-yellow-500/10'
              : 'bg-green-500/10'
        }`}>
          <div className="flex items-center gap-3">
            {needsTechnicalEscalation ? (
              <>
                <Phone className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-500">Escalar para Equipe Técnica</span>
              </>
            ) : canResolveInternally ? (
              <>
                <Wrench className="h-5 w-5 text-yellow-500" />
                <span className="font-medium text-yellow-600">Pode Resolver Internamente</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-600">Nenhuma Ação Necessária</span>
              </>
            )}
          </div>
          {summaryText && (
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar Resumo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
