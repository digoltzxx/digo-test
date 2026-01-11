import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  LucideIcon 
} from 'lucide-react';

export type StatusType = 'ok' | 'warning' | 'error' | 'pending';

interface StatusCardProps {
  label: string;
  status: StatusType;
  icon: LucideIcon;
  tooltip?: string;
  statusLabel?: string;
}

const statusIcons: Record<StatusType, LucideIcon> = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  pending: Clock,
};

const statusColors: Record<StatusType, string> = {
  ok: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  pending: 'text-blue-500',
};

const statusBgColors: Record<StatusType, string> = {
  ok: 'bg-green-500/10',
  warning: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
  pending: 'bg-blue-500/10',
};

const defaultStatusLabels: Record<string, Record<StatusType, string>> = {
  Pagamento: { ok: 'Pago', warning: 'Atenção', error: 'Erro', pending: 'Pendente' },
  Assinatura: { ok: 'Ativa', warning: 'Atenção', error: 'Inativa', pending: 'Pendente' },
  Entrega: { ok: 'Realizada', warning: 'Atenção', error: 'Não realizada', pending: 'Pendente' },
  Email: { ok: 'Enviado', warning: 'Atenção', error: 'Não enviado', pending: 'Enviando' },
  Acesso: { ok: 'Liberado', warning: 'Atenção', error: 'Não liberado', pending: 'Pendente' },
};

export function StatusCard({ 
  label, 
  status, 
  icon: Icon,
  tooltip,
  statusLabel: customStatusLabel,
}: StatusCardProps) {
  const StatusIcon = statusIcons[status];
  const colorClass = statusColors[status];
  const bgClass = statusBgColors[status];
  
  const statusLabel = customStatusLabel || 
    defaultStatusLabels[label]?.[status] || 
    { ok: 'OK', warning: 'Atenção', error: 'Erro', pending: 'Pendente' }[status];

  const cardContent = (
    <div className={`flex items-center gap-3 p-4 rounded-lg ${bgClass} transition-colors`}>
      <Icon className={`h-5 w-5 ${colorClass}`} />
      <div className="flex-1">
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusIcon className={`h-4 w-4 ${colorClass}`} />
        <span className={`text-sm font-medium ${colorClass}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
