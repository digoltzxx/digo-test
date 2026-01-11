import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  ChevronDown,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { IntegrationCheckResult, IntegrationStatus, IntegrationLog } from '@/lib/integrations/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntegrationStatusDashboardProps {
  results: IntegrationCheckResult[];
  isValidating: boolean;
  lastValidation: string | null;
  summary: {
    active: number;
    inactive: number;
    error: number;
  };
  onRefresh: () => void;
  onValidateSingle: (integrationId: string) => void;
}

const StatusIcon = ({ status }: { status: IntegrationStatus }) => {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'validating':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: IntegrationStatus }) => {
  const variants: Record<IntegrationStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    active: { variant: 'default', label: 'ATIVO' },
    inactive: { variant: 'secondary', label: 'INATIVO' },
    error: { variant: 'destructive', label: 'ERRO' },
    validating: { variant: 'outline', label: 'VALIDANDO' }
  };
  
  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const LogEntry = ({ log }: { log: IntegrationLog }) => {
  const levelColors = {
    INFO: 'text-blue-600',
    WARNING: 'text-yellow-600',
    ERROR: 'text-red-600'
  };
  
  return (
    <div className="flex items-start gap-2 text-sm py-1 border-b border-border/50 last:border-0">
      <span className={`font-mono text-xs ${levelColors[log.level]}`}>
        [{log.level}]
      </span>
      <span className="text-muted-foreground flex-1">{log.message}</span>
      <span className="text-xs text-muted-foreground">
        {format(new Date(log.timestamp), 'HH:mm:ss')}
      </span>
    </div>
  );
};

const IntegrationCard = ({ 
  result, 
  onRevalidate 
}: { 
  result: IntegrationCheckResult;
  onRevalidate: () => void;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`transition-all ${
        result.status === 'active' ? 'border-green-500/30' :
        result.status === 'error' ? 'border-red-500/30' :
        'border-border'
      }`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon status={result.status} />
              <CardTitle className="text-base">{result.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={result.status} />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRevalidate}
                disabled={result.status === 'validating'}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Checks */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${result.checks.detection.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">Detecção:</span>
                <span className="text-sm text-muted-foreground">{result.checks.detection.message}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${result.checks.validation.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">Validação:</span>
                <span className="text-sm text-muted-foreground">{result.checks.validation.message}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${result.checks.activation.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">Ativação:</span>
                <span className="text-sm text-muted-foreground">{result.checks.activation.message}</span>
              </div>
            </div>
            
            {/* Logs */}
            {result.logs.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">Logs</h4>
                <ScrollArea className="h-24">
                  {result.logs.map((log, i) => (
                    <LogEntry key={i} log={log} />
                  ))}
                </ScrollArea>
              </div>
            )}
            
            {/* Last validated */}
            {result.lastValidated && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Última validação: {format(new Date(result.lastValidated), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export const IntegrationStatusDashboard: React.FC<IntegrationStatusDashboardProps> = ({
  results,
  isValidating,
  lastValidation,
  summary,
  onRefresh,
  onValidateSingle
}) => {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{summary.active}</p>
                <p className="text-sm text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.inactive}</p>
                <p className="text-sm text-muted-foreground">Inativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{summary.error}</p>
                <p className="text-sm text-muted-foreground">Com Erro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          {lastValidation ? (
            <span>
              Última validação: {format(new Date(lastValidation), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </span>
          ) : (
            <span>Nenhuma validação realizada</span>
          )}
        </div>
        <Button onClick={onRefresh} disabled={isValidating}>
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Validar Todas
            </>
          )}
        </Button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {results.map(result => (
          <IntegrationCard 
            key={result.id} 
            result={result}
            onRevalidate={() => onValidateSingle(result.id)}
          />
        ))}
      </div>
      
      {results.length === 0 && !isValidating && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma validação realizada</h3>
            <p className="text-muted-foreground mb-4">
              Clique em "Validar Todas" para verificar o status das integrações
            </p>
            <Button onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Iniciar Validação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
