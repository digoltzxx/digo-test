import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Zap, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Calendar,
  User,
  Package,
  ArrowRight,
  Info,
  Percent,
  Wallet,
  History
} from "lucide-react";
import { useCommissionAnticipation, EligibleCommission } from "@/hooks/useCommissionAnticipation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const roleLabels: Record<string, string> = {
  producer: "Produtor",
  coproducer: "Coprodutor",
  affiliate: "Afiliado"
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  processing: { label: "Processando", variant: "secondary" },
  completed: { label: "Concluída", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  failed: { label: "Falhou", variant: "destructive" }
};

export function CommissionAnticipationTab() {
  const {
    availableCommissions,
    anticipations,
    settings,
    loading,
    processing,
    totalAvailable,
    totalDebts,
    hasDebts,
    totalAnticipated,
    quantityAnticipations,
    requestAnticipation
  } = useCommissionAnticipation();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Calculate selected totals using backend-provided fee values
  const selectedTotals = useMemo(() => {
    const selected = availableCommissions.filter(c => selectedIds.includes(c.id));
    const total = selected.reduce((sum, c) => sum + c.commission_amount, 0);
    const fee = selected.reduce((sum, c) => sum + c.fee_amount, 0);
    const net = selected.reduce((sum, c) => sum + c.net_amount, 0);
    return { total, fee, net, count: selected.length };
  }, [selectedIds, availableCommissions]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === availableCommissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableCommissions.map(c => c.id));
    }
  };

  const handleAnticipate = async () => {
    setConfirmDialogOpen(false);
    const result = await requestAnticipation(selectedIds);
    if (result) {
      setSelectedIds([]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debt Warning */}
      {hasDebts && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Débitos Pendentes</AlertTitle>
          <AlertDescription>
            Você possui {formatCurrency(totalDebts)} em débitos de antecipações anteriores. 
            Regularize antes de solicitar nova antecipação.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Disponível para Antecipação */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Disponível para Antecipação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalAvailable)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {availableCommissions.length} comissão(ões) elegível(eis)
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Taxa de Antecipação */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Taxa de Antecipação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {settings.feePercentage}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxa fixa aplicada sobre cada comissão antecipada
            </p>
            <p className="text-xs text-muted-foreground">
              Mínimo: {formatCurrency(settings.minAmount)}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Antecipações Realizadas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" />
              Antecipações Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quantityAnticipations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total antecipado: {formatCurrency(totalAnticipated)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Available Commissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Comissões Disponíveis para Antecipação
              </CardTitle>
              <CardDescription>
                Selecione as comissões que deseja antecipar. Taxa de {settings.feePercentage}% será aplicada.
              </CardDescription>
            </div>
            {availableCommissions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                {selectedIds.length === availableCommissions.length 
                  ? "Desmarcar Todas" 
                  : "Selecionar Todas"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {availableCommissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma comissão disponível para antecipação.</p>
              <p className="text-sm mt-2">
                Comissões de vendas aprovadas com valor mínimo de {formatCurrency(settings.minAmount)} aparecerão aqui.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {availableCommissions.map((commission) => (
                    <div
                      key={commission.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer
                        ${selectedIds.includes(commission.id) 
                          ? "bg-primary/5 border-primary shadow-sm" 
                          : "hover:bg-muted/50 hover:border-muted-foreground/20"
                        }`}
                      onClick={() => toggleSelection(commission.id)}
                    >
                      <Checkbox
                        checked={selectedIds.includes(commission.id)}
                        onCheckedChange={() => toggleSelection(commission.id)}
                        className="pointer-events-none"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">
                            {commission.product_name || "Produto"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {roleLabels[commission.role] || commission.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {commission.sale_buyer_name || "Comprador"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-primary">
                          {formatCurrency(commission.commission_amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-destructive">-{formatCurrency(commission.fee_amount)}</span>
                          {" → "}
                          <span className="text-green-600 font-medium">{formatCurrency(commission.net_amount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Selection Summary */}
              {selectedIds.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border-2 border-primary/20">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {selectedTotals.count} comissão(ões) selecionada(s)
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                        <span className="font-medium">{formatCurrency(selectedTotals.total)}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-destructive font-medium">
                          -{formatCurrency(selectedTotals.fee)} ({settings.feePercentage}%)
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold text-green-600 text-lg">
                          {formatCurrency(selectedTotals.net)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => setConfirmDialogOpen(true)}
                      disabled={processing || hasDebts || selectedTotals.total < settings.minAmount}
                      className="gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      Antecipar Agora
                    </Button>
                  </div>
                  {selectedTotals.total < settings.minAmount && (
                    <p className="text-sm text-destructive mt-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Valor mínimo para antecipação: {formatCurrency(settings.minAmount)}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Anticipation History */}
      {anticipations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Histórico de Antecipações
            </CardTitle>
            <CardDescription>
              Suas últimas solicitações de antecipação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {anticipations.slice(0, 10).map((anticipation) => (
                <div
                  key={anticipation.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusConfig[anticipation.status]?.variant || "outline"}>
                        {statusConfig[anticipation.status]?.label || anticipation.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(anticipation.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {anticipation.anticipation_items?.length || 0} comissão(ões) • 
                      Taxa: {anticipation.fee_percentage}% ({formatCurrency(anticipation.fee_amount)})
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground line-through">
                      {formatCurrency(anticipation.total_original_amount)}
                    </div>
                    <div className="font-bold text-primary text-lg">
                      {formatCurrency(anticipation.total_anticipated_amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Confirmar Antecipação
            </DialogTitle>
            <DialogDescription>
              Revise os valores antes de confirmar a antecipação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-between py-3 border-b">
              <span className="text-muted-foreground">Comissões selecionadas</span>
              <span className="font-medium">{selectedTotals.count}</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-muted-foreground">Valor Original</span>
              <span className="font-medium">{formatCurrency(selectedTotals.total)}</span>
            </div>
            <div className="flex justify-between py-3 border-b text-destructive">
              <span>Taxa de Antecipação ({settings.feePercentage}%)</span>
              <span className="font-medium">-{formatCurrency(selectedTotals.fee)}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between py-3 text-xl font-bold">
              <span>Valor a Receber</span>
              <span className="text-green-600">{formatCurrency(selectedTotals.net)}</span>
            </div>

            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                O valor antecipado será creditado <strong>imediatamente</strong> no seu saldo disponível para saque.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAnticipate} disabled={processing} className="gap-2">
              {processing ? (
                <>Processando...</>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Confirmar Antecipação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
