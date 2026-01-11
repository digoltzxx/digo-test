import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, AlertCircle } from "lucide-react";

interface AffiliateSettingsProps {
  enableAffiliates: boolean;
  affiliateCommission: number;
  onToggleAffiliates: (enabled: boolean) => void;
  onCommissionChange: (value: string) => void;
  error?: string;
  minCommission?: number;
  maxCommission?: number;
}

export const MIN_COMMISSION = 1;
export const MAX_COMMISSION = 90;

const AffiliateSettings = ({
  enableAffiliates,
  affiliateCommission,
  onToggleAffiliates,
  onCommissionChange,
  error,
  minCommission = MIN_COMMISSION,
  maxCommission = MAX_COMMISSION,
}: AffiliateSettingsProps) => {
  return (
    <Card className="bg-[#161b22] border-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Afiliados</h3>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between p-4 bg-[#0d1117] rounded-lg border border-gray-700/50">
            <div>
              <Label className="text-white font-medium">Permitir afiliados</Label>
              <p className="text-sm text-gray-500 mt-1">
                Permitir que afiliados promovam este produto e recebam comissão
              </p>
            </div>
            <Switch
              checked={enableAffiliates}
              onCheckedChange={onToggleAffiliates}
              data-testid="toggle-affiliates"
            />
          </div>

          <div
            className={`transition-all duration-300 ${
              enableAffiliates ? "opacity-100" : "opacity-50 pointer-events-none"
            }`}
          >
            <Label className="text-gray-400 text-sm">Comissão de Afiliados (%)</Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="number"
                min={minCommission}
                max={maxCommission}
                value={affiliateCommission}
                onChange={(e) => onCommissionChange(e.target.value)}
                disabled={!enableAffiliates}
                className={`bg-[#0d1117] border-gray-700 text-white w-32 ${
                  error ? "border-red-500" : ""
                }`}
                data-testid="input-commission"
              />
              <span className="text-gray-400 text-sm">
                (Mínimo: {minCommission}% • Máximo: {maxCommission}%)
              </span>
            </div>
            {error && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="error-commission">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              A cada venda via afiliado, será calculado:{" "}
              <span className="text-blue-400">valor × {affiliateCommission}%</span>
            </p>
          </div>

          {!enableAffiliates && (
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-200 text-sm">
                Com afiliados desativados, todos os links de afiliados existentes serão desativados.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AffiliateSettings;
