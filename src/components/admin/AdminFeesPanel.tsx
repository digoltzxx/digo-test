/**
 * Painel Administrativo de Taxas - SaaS Financeiro
 * Permite gerenciar taxas globais e por tenant
 * Exibe TODAS as taxas descontadas dos usuários organizadas por categoria
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Settings, 
  DollarSign, 
  Percent, 
  History, 
  Save, 
  Edit2, 
  AlertCircle,
  TrendingUp,
  Wallet,
  Clock,
  Calculator,
  RefreshCw,
  Globe,
  User,
  CreditCard,
  Receipt,
  Banknote,
  ArrowDownUp,
  AlertTriangle,
  RotateCcw,
  Landmark,
  Repeat,
  Building2,
  Puzzle,
} from "lucide-react";
import { usePlatformFees } from "@/hooks/usePlatformFees";
import { PlatformFee, FeeType, FeeValueType, FEE_CATEGORIES } from "@/lib/feeService";
import { formatCurrency, cn } from "@/lib/utils";

interface FeeCardProps {
  fee: PlatformFee;
  isEditing: boolean;
  editValue: string;
  editValueType: FeeValueType;
  editMinValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onValueChange: (value: string) => void;
  onValueTypeChange: (type: FeeValueType) => void;
  onMinValueChange: (value: string) => void;
  onToggleActive: (active: boolean) => void;
  canEdit: boolean;
  label: string;
}

const FeeIcon = ({ feeType }: { feeType: FeeType }) => {
  switch (feeType) {
    case 'transaction':
      return <TrendingUp className="h-5 w-5 text-primary" />;
    case 'withdrawal':
      return <Wallet className="h-5 w-5 text-orange-500" />;
    case 'anticipation':
      return <Clock className="h-5 w-5 text-purple-500" />;
    case 'pix':
      return <Banknote className="h-5 w-5 text-green-500" />;
    case 'credit_card_2d':
    case 'credit_card_7d':
    case 'credit_card_15d':
    case 'credit_card_30d':
      return <CreditCard className="h-5 w-5 text-blue-500" />;
    case 'boleto':
      return <Receipt className="h-5 w-5 text-amber-500" />;
    case 'acquirer':
      return <Landmark className="h-5 w-5 text-slate-500" />;
    case 'subscription':
      return <Repeat className="h-5 w-5 text-indigo-500" />;
    case 'chargeback':
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case 'refund':
      return <RotateCcw className="h-5 w-5 text-cyan-500" />;
    default:
      return <DollarSign className="h-5 w-5 text-muted-foreground" />;
  }
};

const FeeCard = ({
  fee,
  isEditing,
  editValue,
  editValueType,
  editMinValue,
  onEdit,
  onSave,
  onCancel,
  onValueChange,
  onValueTypeChange,
  onMinValueChange,
  onToggleActive,
  canEdit,
  label,
}: FeeCardProps) => {
  // Formatar valor para exibição
  const formatFeeValue = () => {
    const mainValue = fee.value_type === 'percentage' 
      ? `${fee.value}%` 
      : formatCurrency(fee.value);
    
    // Se tem min_value (taxa fixa adicional), mostrar junto
    if (fee.min_value && fee.min_value > 0 && fee.value_type === 'percentage') {
      return `${mainValue} + ${formatCurrency(fee.min_value)}`;
    }
    
    return mainValue;
  };

  return (
    <Card className={cn(
      "transition-all",
      !fee.is_active && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <FeeIcon feeType={fee.fee_type} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{label}</h3>
                {fee.tenant_id ? (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Personalizada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    Global
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {fee.description || `Taxa padrão para ${label.toLowerCase()}`}
              </p>
            </div>
          </div>

          <Switch
            checked={fee.is_active}
            onCheckedChange={onToggleActive}
            disabled={!canEdit}
          />
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between">
          {isEditing ? (
            <div className="flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[100px] max-w-[120px]">
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => onValueChange(e.target.value)}
                    className="text-sm font-bold h-9"
                  />
                </div>
                <div className="min-w-[120px]">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={editValueType} onValueChange={(v) => onValueTypeChange(v as FeeValueType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editValueType === 'percentage' && (
                  <div className="flex-1 min-w-[100px] max-w-[120px]">
                    <Label className="text-xs text-muted-foreground">+ Fixo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editMinValue}
                      onChange={(e) => onMinValueChange(e.target.value)}
                      className="text-sm h-9"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onSave} className="h-8">
                  <Save className="h-3 w-3 mr-1" />
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel} className="h-8">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">
                  {formatFeeValue()}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {fee.value_type === 'percentage' ? (
                    <><Percent className="h-3 w-3 mr-1" />Percentual</>
                  ) : (
                    <><DollarSign className="h-3 w-3 mr-1" />Fixo</>
                  )}
                </Badge>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
                  <Edit2 className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              )}
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Atualizado em {format(new Date(fee.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
        </p>
      </CardContent>
    </Card>
  );
};

interface FeeSimulatorProps {
  simulateFees: (amount: number) => Promise<any>;
}

const FeeSimulator = ({ simulateFees }: FeeSimulatorProps) => {
  const [amount, setAmount] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      toast.error("Digite um valor válido");
      return;
    }

    setLoading(true);
    try {
      const simulation = await simulateFees(value);
      setResults(simulation);
    } catch {
      toast.error("Erro ao simular taxas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Simulador de Taxas
        </CardTitle>
        <CardDescription>
          Calcule o impacto das taxas antes de aplicar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="simulate-amount">Valor a simular</Label>
            <Input
              id="simulate-amount"
              type="number"
              step="0.01"
              placeholder="Ex: 1000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSimulate} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Simular"}
            </Button>
          </div>
        </div>

        {results && (
          <div className="space-y-3 pt-4 border-t">
            {Object.entries(results).map(([type, result]: [string, any]) => result && (
              <div key={type} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FeeIcon feeType={type as FeeType} />
                  <span className="font-medium text-sm capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Taxa: <span className="text-destructive font-medium">-{formatCurrency(result.feeAmount)}</span>
                  </p>
                  <p className="font-bold text-green-500 text-sm">
                    Líquido: {formatCurrency(result.netAmount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface AdminFeesPanelProps {
  isGlobalAdmin?: boolean;
  tenantId?: string | null;
}

export function AdminFeesPanel({ isGlobalAdmin = false, tenantId }: AdminFeesPanelProps) {
  const {
    globalFees,
    tenantFees,
    changeLogs,
    loading,
    updateFee,
    simulateFees,
    FEE_TYPE_LABELS,
    refetch,
  } = usePlatformFees({ tenantId, isAdmin: isGlobalAdmin });

  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editValueType, setEditValueType] = useState<FeeValueType>("percentage");
  const [editMinValue, setEditMinValue] = useState("");

  const handleEdit = (fee: PlatformFee) => {
    setEditingFee(fee.id);
    setEditValue(fee.value.toString());
    setEditValueType(fee.value_type);
    setEditMinValue(fee.min_value?.toString() || "0");
  };

  const handleSave = async (feeId: string) => {
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 0) {
      toast.error("Valor inválido");
      return;
    }

    const minValue = parseFloat(editMinValue) || 0;

    const result = await updateFee(feeId, {
      value,
      value_type: editValueType,
      min_value: minValue,
    });

    if (result.success) {
      toast.success("Taxa atualizada com sucesso!");
      setEditingFee(null);
    } else {
      toast.error(result.error || "Erro ao atualizar taxa");
    }
  };

  const handleToggleActive = async (feeId: string, active: boolean) => {
    const result = await updateFee(feeId, { is_active: active });
    if (result.success) {
      toast.success(active ? "Taxa ativada" : "Taxa desativada");
    } else {
      toast.error(result.error || "Erro ao atualizar status");
    }
  };

  const handleCancel = () => {
    setEditingFee(null);
    setEditValue("");
    setEditMinValue("");
  };

  // Determinar quais taxas mostrar
  const feesToShow = isGlobalAdmin ? globalFees : [...tenantFees, ...globalFees.filter(
    gf => !tenantFees.some(tf => tf.fee_type === gf.fee_type)
  )];

  // Agrupar taxas por categoria
  const getFeesByCategory = (categoryTypes: FeeType[]) => {
    return feesToShow.filter(fee => categoryTypes.includes(fee.fee_type));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Gestão de Taxas
          </h2>
          <p className="text-muted-foreground">
            {isGlobalAdmin 
              ? "Configure todas as taxas descontadas dos usuários" 
              : "Personalize suas taxas ou use as taxas padrão"
            }
          </p>
        </div>
        <Button variant="outline" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Resumo de taxas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-500" />
              <span className="font-medium text-sm">Pagamentos</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {getFeesByCategory(FEE_CATEGORIES.payment.types).length}
            </p>
            <p className="text-xs text-muted-foreground">taxas configuradas</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-blue-500" />
              <span className="font-medium text-sm">Plataforma</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {getFeesByCategory(FEE_CATEGORIES.platform.types).length}
            </p>
            <p className="text-xs text-muted-foreground">taxas configuradas</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-sm">Financeiras</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {getFeesByCategory(FEE_CATEGORIES.financial.types).length}
            </p>
            <p className="text-xs text-muted-foreground">taxas configuradas</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-medium text-sm">Disputas</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {getFeesByCategory(FEE_CATEGORIES.disputes.types).length}
            </p>
            <p className="text-xs text-muted-foreground">taxas configuradas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="fees" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="fees">
            <DollarSign className="h-4 w-4 mr-2" />
            Taxas
          </TabsTrigger>
          <TabsTrigger value="simulator">
            <Calculator className="h-4 w-4 mr-2" />
            Simulador
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fees" className="space-y-4 mt-6">
          {/* Explicação das taxas do demonstrativo */}
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Como funcionam as taxas no Demonstrativo de Faturamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Taxa da Plataforma */}
                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-orange-500">Taxa da Plataforma</span>
                  </div>
                  <p className="text-muted-foreground text-xs mb-2">
                    Descontada <strong>PRIMEIRO</strong> do faturamento bruto.
                  </p>
                  <p className="text-xs">
                    <strong>Cálculo:</strong> (Valor × Percentual%) + Valor Fixo por transação
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ex: R$ 100,00 × 4,99% + R$ 1,49 = R$ 6,48
                  </p>
                </div>

                {/* Taxa das Adquirentes */}
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-green-500">Taxa das Adquirentes</span>
                  </div>
                  <p className="text-muted-foreground text-xs mb-2">
                    Descontada <strong>DEPOIS</strong> da taxa da plataforma.
                  </p>
                  <p className="text-xs">
                    Taxa cobrada pela operadora de pagamento (Cielo, Stone, etc.)
                  </p>
                </div>

                {/* Banking */}
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Landmark className="h-4 w-4 text-purple-500" />
                    <span className="font-semibold text-purple-500">Banking</span>
                  </div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li><strong>Taxas de Saque Flat:</strong> Valor fixo por saque realizado</li>
                    <li><strong>Taxas de Antecipações:</strong> Percentual sobre valor antecipado</li>
                    <li><strong>Taxas de BaaS:</strong> Taxa mensal de banking as a service</li>
                  </ul>
                </div>

                {/* Extensões */}
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Puzzle className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-amber-500">Extensões</span>
                  </div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li><strong>Taxas de Antifraude:</strong> Custo por análise de fraude</li>
                    <li><strong>Taxas de Pré-Chargeback:</strong> Custo por disputa processada</li>
                    <li><strong>Taxas de KYC:</strong> Verificação de identidade</li>
                  </ul>
                </div>
              </div>

              {/* Regra de Cálculo */}
              <div className="p-3 bg-muted rounded-lg border">
                <p className="font-semibold text-xs mb-2">📐 Regra Obrigatória de Cálculo Sequencial:</p>
                <ol className="text-xs space-y-1 text-muted-foreground list-decimal list-inside">
                  <li>Começa com o <strong>Faturamento Bruto</strong></li>
                  <li>Subtrai <strong>Pré-Chargebacks</strong></li>
                  <li>Calcula e subtrai <strong>Taxa da Plataforma</strong> (percentual + fixo)</li>
                  <li>Subtrai <strong>Taxa das Adquirentes</strong></li>
                  <li>Subtrai <strong>Taxas de Banking</strong></li>
                  <li>Subtrai <strong>Taxas de Extensões</strong></li>
                  <li>Resultado = <strong>Lucro Total</strong></li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Alerta para taxas personalizadas */}
          {!isGlobalAdmin && tenantFees.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <p className="text-sm">
                Você está usando as taxas globais da plataforma. 
                Para personalizar, edite qualquer taxa abaixo.
              </p>
            </div>
          )}

          {/* Accordion com categorias */}
          <Accordion type="multiple" defaultValue={["payment", "platform", "financial", "disputes"]} className="space-y-4">
            {/* Taxas de Pagamento */}
            <AccordionItem value="payment" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CreditCard className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{FEE_CATEGORIES.payment.label}</h3>
                    <p className="text-sm text-muted-foreground">{FEE_CATEGORIES.payment.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {getFeesByCategory(FEE_CATEGORIES.payment.types).map((fee) => (
                    <FeeCard
                      key={fee.id}
                      fee={fee}
                      label={FEE_TYPE_LABELS[fee.fee_type] || fee.fee_type}
                      isEditing={editingFee === fee.id}
                      editValue={editValue}
                      editValueType={editValueType}
                      editMinValue={editMinValue}
                      onEdit={() => handleEdit(fee)}
                      onSave={() => handleSave(fee.id)}
                      onCancel={handleCancel}
                      onValueChange={setEditValue}
                      onValueTypeChange={setEditValueType}
                      onMinValueChange={setEditMinValue}
                      onToggleActive={(active) => handleToggleActive(fee.id, active)}
                      canEdit={isGlobalAdmin || fee.tenant_id === tenantId}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Taxas da Plataforma */}
            <AccordionItem value="platform" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Landmark className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{FEE_CATEGORIES.platform.label}</h3>
                    <p className="text-sm text-muted-foreground">{FEE_CATEGORIES.platform.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {getFeesByCategory(FEE_CATEGORIES.platform.types).map((fee) => (
                    <FeeCard
                      key={fee.id}
                      fee={fee}
                      label={FEE_TYPE_LABELS[fee.fee_type] || fee.fee_type}
                      isEditing={editingFee === fee.id}
                      editValue={editValue}
                      editValueType={editValueType}
                      editMinValue={editMinValue}
                      onEdit={() => handleEdit(fee)}
                      onSave={() => handleSave(fee.id)}
                      onCancel={handleCancel}
                      onValueChange={setEditValue}
                      onValueTypeChange={setEditValueType}
                      onMinValueChange={setEditMinValue}
                      onToggleActive={(active) => handleToggleActive(fee.id, active)}
                      canEdit={isGlobalAdmin || fee.tenant_id === tenantId}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Taxas Financeiras */}
            <AccordionItem value="financial" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <ArrowDownUp className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{FEE_CATEGORIES.financial.label}</h3>
                    <p className="text-sm text-muted-foreground">{FEE_CATEGORIES.financial.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {getFeesByCategory(FEE_CATEGORIES.financial.types).map((fee) => (
                    <FeeCard
                      key={fee.id}
                      fee={fee}
                      label={FEE_TYPE_LABELS[fee.fee_type] || fee.fee_type}
                      isEditing={editingFee === fee.id}
                      editValue={editValue}
                      editValueType={editValueType}
                      editMinValue={editMinValue}
                      onEdit={() => handleEdit(fee)}
                      onSave={() => handleSave(fee.id)}
                      onCancel={handleCancel}
                      onValueChange={setEditValue}
                      onValueTypeChange={setEditValueType}
                      onMinValueChange={setEditMinValue}
                      onToggleActive={(active) => handleToggleActive(fee.id, active)}
                      canEdit={isGlobalAdmin || fee.tenant_id === tenantId}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Taxas de Disputa */}
            <AccordionItem value="disputes" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{FEE_CATEGORIES.disputes.label}</h3>
                    <p className="text-sm text-muted-foreground">{FEE_CATEGORIES.disputes.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {getFeesByCategory(FEE_CATEGORIES.disputes.types).map((fee) => (
                    <FeeCard
                      key={fee.id}
                      fee={fee}
                      label={FEE_TYPE_LABELS[fee.fee_type] || fee.fee_type}
                      isEditing={editingFee === fee.id}
                      editValue={editValue}
                      editValueType={editValueType}
                      editMinValue={editMinValue}
                      onEdit={() => handleEdit(fee)}
                      onSave={() => handleSave(fee.id)}
                      onCancel={handleCancel}
                      onValueChange={setEditValue}
                      onValueTypeChange={setEditValueType}
                      onMinValueChange={setEditMinValue}
                      onToggleActive={(active) => handleToggleActive(fee.id, active)}
                      canEdit={isGlobalAdmin || fee.tenant_id === tenantId}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="simulator" className="mt-6">
          <FeeSimulator simulateFees={simulateFees} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
              <CardDescription>
                Registro completo de todas as alterações nas taxas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {changeLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Valor Anterior</TableHead>
                      <TableHead>Novo Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeLogs.slice(0, 20).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {FEE_TYPE_LABELS[log.fee_type] || log.fee_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.action === 'create' ? 'default' : 
                                    log.action === 'delete' ? 'destructive' : 'secondary'}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.previous_value !== null 
                            ? `${log.previous_value}${log.previous_value_type === 'percentage' ? '%' : ' (fixo)'}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.new_value}{log.new_value_type === 'percentage' ? '%' : ' (fixo)'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminFeesPanel;