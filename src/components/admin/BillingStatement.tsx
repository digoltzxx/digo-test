import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  RefreshCw, 
  Calendar as CalendarIcon,
  Building2,
  Landmark,
  Puzzle,
  Shield,
  TrendingUp,
  ChevronDown,
  Download,
  Percent
} from 'lucide-react';
import { useBilling } from '@/hooks/useBilling';
import { formatCurrency } from '@/lib/billingService';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BillingLineProps {
  label: string;
  value: number;
  isDeduction?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
}

function BillingLine({ label, value, isDeduction, isSubtotal, isTotal }: BillingLineProps) {
  const displayValue = isDeduction && value > 0 ? -value : value;
  const formattedValue = formatCurrency(Math.abs(value));
  const prefix = displayValue < 0 ? '- ' : '';
  
  return (
    <div className={cn(
      "flex justify-between items-center py-2 px-4",
      isSubtotal && "bg-muted/50 font-medium",
      isTotal && "bg-primary/10 font-bold text-lg"
    )}>
      <span className={cn(
        "text-sm",
        isSubtotal && "font-medium",
        isTotal && "font-bold text-base"
      )}>
        {label}
      </span>
      <span className={cn(
        "font-mono text-sm",
        displayValue < 0 && "text-destructive",
        displayValue > 0 && !isDeduction && "text-emerald-600",
        isSubtotal && "font-semibold",
        isTotal && "font-bold text-base"
      )}>
        {prefix}{formattedValue}
      </span>
    </div>
  );
}

interface BillingSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
}

function BillingSection({ title, icon, children, accentColor = "hsl(var(--primary))" }: BillingSectionProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ backgroundColor: `${accentColor}10` }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <span className="font-semibold text-sm" style={{ color: accentColor }}>
          {title}
        </span>
      </div>
      <div className="divide-y">
        {children}
      </div>
    </div>
  );
}

export function BillingStatement() {
  const { 
    summary, 
    primaryAcquirer, 
    primaryAdquirente,
    acquirers,
    adquirentes,
    isLoading, 
    periodStart, 
    periodEnd, 
    setPeriod, 
    refreshBilling,
    changePrimaryAcquirer,
    changePrimaryAdquirente
  } = useBilling();
  
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value);
    const now = new Date();
    
    switch (value) {
      case 'current':
        setPeriod(startOfMonth(now), endOfMonth(now));
        break;
      case 'previous':
        setPeriod(startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1)));
        break;
      case 'last3':
        setPeriod(startOfMonth(subMonths(now, 2)), endOfMonth(now));
        break;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Priorizar nova estrutura (adquirentes) sobre legado (gateway_acquirers)
  const gatewayProviderName = primaryAdquirente?.nomeExibicao || primaryAcquirer?.displayName || summary?.gatewayProviderName || 'Gateway';
  
  // Usar adquirentes da nova tabela, fallback para acquirers legado
  const displayAcquirers = adquirentes.length > 0 
    ? adquirentes.map(a => ({ id: a.id, displayName: a.nomeExibicao, isPrimary: a.principal }))
    : acquirers.map(a => ({ id: a.id, displayName: a.displayName, isPrimary: a.isPrimary }));
  
  const currentPrimaryId = primaryAdquirente?.id || primaryAcquirer?.id || '';

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Demonstrativo de Faturamento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {format(periodStart, "dd 'de' MMMM", { locale: ptBR })} até {format(periodEnd, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <CalendarIcon className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês Atual</SelectItem>
                <SelectItem value="previous">Mês Anterior</SelectItem>
                <SelectItem value="last3">Últimos 3 Meses</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={refreshBilling}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4">
        {/* Faturamento Bruto */}
        <BillingSection 
          title="Faturamento" 
          icon={<Building2 className="h-4 w-4" />}
          accentColor="#3b82f6"
        >
          <BillingLine label="Faturamento Bruto" value={summary?.grossRevenue || 0} />
          <BillingLine label="Pré-Chargeback" value={summary?.preChargeback || 0} isDeduction />
        </BillingSection>

        {/* Taxa da Plataforma (descontada PRIMEIRO) */}
        <BillingSection 
          title="Taxa da Plataforma"
          icon={<Percent className="h-4 w-4" />}
          accentColor="#f97316"
        >
          <BillingLine label="Taxas da Plataforma" value={summary?.platformFees || 0} isDeduction />
          <BillingLine label="Subtotal" value={summary?.platformSubtotal || 0} isSubtotal />
        </BillingSection>

        {/* Taxa das Adquirentes (descontada DEPOIS) */}
        <BillingSection 
          title="Adquirência" 
          icon={<Building2 className="h-4 w-4" />}
          accentColor="#10b981"
        >
          <BillingLine label="Taxas das Adquirentes" value={summary?.acquirerFees || 0} isDeduction />
          <BillingLine label="Subtotal" value={summary?.acquirerSubtotal || 0} isSubtotal />
        </BillingSection>

        {/* Banking */}
        <BillingSection 
          title="Banking" 
          icon={<Landmark className="h-4 w-4" />}
          accentColor="#8b5cf6"
        >
          <BillingLine label="Taxas de Saque Flat" value={summary?.withdrawalFees || 0} isDeduction />
          <BillingLine label="Taxas de Antecipações" value={summary?.anticipationFees || 0} isDeduction />
          <BillingLine label="Taxas de BaaS" value={summary?.baasFees || 0} isDeduction />
          <BillingLine label="Subtotal" value={summary?.bankingSubtotal || 0} isSubtotal />
        </BillingSection>

        {/* Extensões */}
        <BillingSection 
          title="Extensões" 
          icon={<Puzzle className="h-4 w-4" />}
          accentColor="#f59e0b"
        >
          <BillingLine label="Taxas de Antifraude" value={summary?.antifraudFees || 0} isDeduction />
          <BillingLine label="Taxas de Pré-Chargeback" value={summary?.preChargebackFees || 0} isDeduction />
          <BillingLine label="Taxas de KYC" value={summary?.kycFees || 0} isDeduction />
          <BillingLine label="Subtotal" value={summary?.extensionsSubtotal || 0} isSubtotal />
        </BillingSection>

        {/* Adquirente Principal - Apenas informativo, taxas já incluídas em "Adquirência" */}
        {displayAcquirers.length > 1 && (
          <div className="flex justify-between items-center py-2 px-4 bg-muted/30 rounded-lg border">
            <span className="text-xs text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Adquirente Principal:
            </span>
            <Select 
              value={currentPrimaryId} 
              onValueChange={async (id) => {
                const acq = displayAcquirers.find(a => a.id === id);
                if (acq) {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user && adquirentes.length > 0) {
                    await changePrimaryAdquirente(id, user.id, `Alterado para ${acq.displayName}`);
                  } else {
                    changePrimaryAcquirer(id, acq.displayName);
                  }
                }
              }}
            >
              <SelectTrigger className="w-[160px] h-7 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {displayAcquirers.map((acq) => (
                  <SelectItem key={acq.id} value={acq.id}>
                    {acq.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator className="my-6" />

        {/* Lucro Total */}
        <div className="border-2 border-primary rounded-lg overflow-hidden">
          <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">Lucro Total</span>
            </div>
            <Badge variant={summary?.totalProfit && summary.totalProfit > 0 ? "default" : "destructive"}>
              {summary?.totalProfit && summary.totalProfit > 0 ? 'Positivo' : 'Negativo'}
            </Badge>
          </div>
          <div className="p-4 text-center">
            <span className={cn(
              "text-3xl font-bold",
              summary?.totalProfit && summary.totalProfit > 0 ? "text-emerald-600" : "text-destructive"
            )}>
              {formatCurrency(summary?.totalProfit || 0)}
            </span>
          </div>
        </div>

        {/* Calculation Info */}
        <div className="text-xs text-muted-foreground text-center pt-4">
          <p>Calculado em: {summary?.calculatedAt ? format(new Date(summary.calculatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}</p>
          <p className="mt-1">
            Lucro = Faturamento - Taxas Plataforma - Taxas Adquirentes - Banking - Extensões
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
