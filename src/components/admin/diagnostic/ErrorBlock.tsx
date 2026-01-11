import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { InternalErrorCode, getInternalDescription, getErrorCategory } from '@/lib/deliveryMessages';

interface ErrorBlockProps {
  errorCode: InternalErrorCode;
  errorAt?: string;
  additionalInfo?: string;
}

export function ErrorBlock({ errorCode, errorAt, additionalInfo }: ErrorBlockProps) {
  const copyToClipboard = () => {
    const info = `
Código: ${errorCode}
Categoria: ${getErrorCategory(errorCode)}
Descrição: ${getInternalDescription(errorCode)}
${errorAt ? `Data/Hora: ${format(new Date(errorAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ''}
${additionalInfo ? `Info adicional: ${additionalInfo}` : ''}
    `.trim();
    
    navigator.clipboard.writeText(info);
    toast.success('Informações copiadas!');
  };

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-red-500">
            <AlertCircle className="h-4 w-4" />
            Erro Identificado
          </CardTitle>
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="h-3 w-3 mr-2" />
            Copiar para suporte
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground w-32">Código do erro:</Label>
          <Badge variant="outline" className="font-mono text-red-500 border-red-500/30">
            {errorCode}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {getErrorCategory(errorCode)}
          </Badge>
        </div>
        
        <div className="flex items-start gap-3">
          <Label className="text-xs text-muted-foreground w-32 shrink-0">Descrição técnica:</Label>
          <p className="text-sm">{getInternalDescription(errorCode)}</p>
        </div>
        
        {errorAt && (
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground w-32">Última tentativa:</Label>
            <p className="text-sm">
              {format(new Date(errorAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        )}
        
        {additionalInfo && (
          <div className="flex items-start gap-3">
            <Label className="text-xs text-muted-foreground w-32 shrink-0">Info adicional:</Label>
            <p className="text-sm text-muted-foreground">{additionalInfo}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
