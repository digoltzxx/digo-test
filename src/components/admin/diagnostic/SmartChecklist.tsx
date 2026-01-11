import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { CheckSquare, Square, Clock, Info } from 'lucide-react';
import { InternalErrorCode, getInternalDescription } from '@/lib/deliveryMessages';

export type ChecklistItemStatus = 'ok' | 'warning' | 'error' | 'pending';

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistItemStatus;
  errorCode?: InternalErrorCode;
  visible?: boolean;
}

interface SmartChecklistProps {
  items: ChecklistItem[];
  title?: string;
}

const statusColors: Record<ChecklistItemStatus, string> = {
  ok: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  pending: 'text-blue-500',
};

export function SmartChecklist({ items, title = 'Diagnóstico Automático' }: SmartChecklistProps) {
  const visibleItems = items.filter(item => item.visible !== false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.status === 'ok' ? CheckSquare : 
                        item.status === 'pending' ? Clock : Square;
            const colorClass = statusColors[item.status];

            return (
              <div key={item.id} className="flex items-center gap-3 py-1.5">
                <Icon className={`h-5 w-5 ${colorClass}`} />
                <span className={item.status === 'ok' ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                </span>
                
                {item.errorCode && item.status !== 'ok' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className="text-xs font-mono ml-auto cursor-help flex items-center gap-1"
                        >
                          {item.errorCode}
                          <Info className="h-3 w-3" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm">{getInternalDescription(item.errorCode)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
