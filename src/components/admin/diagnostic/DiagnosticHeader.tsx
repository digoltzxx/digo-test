import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { User, Copy, RotateCcw, Package } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticHeaderProps {
  userName?: string;
  userEmail: string;
  productName?: string;
  productId?: string;
  deliveryType: 'payment_only' | 'email' | 'member_area' | null;
  isSubscription: boolean;
}

const deliveryTypeLabels = {
  payment_only: 'Apenas Pagamento',
  email: 'Entrega por Email',
  member_area: 'Área de Membros',
};

export function DiagnosticHeader({
  userName,
  userEmail,
  productName,
  productId,
  deliveryType,
  isSubscription,
}: DiagnosticHeaderProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Informações Principais
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Usuário</Label>
            <p className="font-medium">{userName || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{userEmail}</p>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0"
                onClick={() => copyToClipboard(userEmail)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{productName || 'N/A'}</p>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo de entrega</Label>
            <p className="font-medium">
              {deliveryType ? deliveryTypeLabels[deliveryType] : 'Não configurado'}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo de produto</Label>
            <div className="flex items-center gap-2 mt-0.5">
              {isSubscription ? (
                <Badge variant="secondary">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Assinatura
                </Badge>
              ) : (
                <Badge variant="outline">Venda única</Badge>
              )}
            </div>
          </div>
          {productId && (
            <div>
              <Label className="text-xs text-muted-foreground">ID do Produto</Label>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs truncate">{productId.slice(0, 8)}...</p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(productId)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
