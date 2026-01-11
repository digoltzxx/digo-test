import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, AlertCircle, CheckCircle } from "lucide-react";

export interface AddressData {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface AddressSectionProps {
  addressData: AddressData;
  onAddressChange: (field: keyof AddressData, value: string) => void;
  errors: Record<string, string>;
  onValidateField: (field: string, value: string) => void;
  isLightTheme?: boolean;
  primaryColor?: string;
  borderRadius?: string;
  stepNumber?: number;
}

// CEP mask: 00000-000
const maskCEP = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
};

// Validate CEP format
const isValidCEP = (cep: string): boolean => {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
};

// Fetch address from ViaCEP API
const fetchAddressFromCEP = async (cep: string): Promise<{
  success: boolean;
  data?: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  error?: string;
}> => {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) {
    return { success: false, error: 'CEP inválido' };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await response.json();

    if (data.erro) {
      return { success: false, error: 'CEP não encontrado' };
    }

    return {
      success: true,
      data: {
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      },
    };
  } catch (error) {
    console.error('Error fetching CEP:', error);
    return { success: false, error: 'Erro ao buscar CEP' };
  }
};

const AddressSection = ({
  addressData,
  onAddressChange,
  errors,
  onValidateField,
  isLightTheme = false,
  primaryColor = '#3b82f6',
  borderRadius = 'rounded-lg',
  stepNumber = 2,
}: AddressSectionProps) => {
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cepMessage, setCepMessage] = useState('');
  const lastFetchedCep = useRef<string>('');
  const onAddressChangeRef = useRef(onAddressChange);
  
  // Keep ref updated
  onAddressChangeRef.current = onAddressChange;

  const textColor = isLightTheme ? 'text-slate-900' : 'text-white';
  const mutedTextColor = isLightTheme ? 'text-slate-600' : 'text-gray-400';
  const cardBg = isLightTheme ? 'bg-white/90 border-slate-200' : 'bg-card/50 border-border/50';
  const inputBg = isLightTheme ? 'bg-white border-slate-300' : 'bg-background/50 border-border/50';

  // Auto-fetch address when CEP is complete
  useEffect(() => {
    const cleanedCep = addressData.cep.replace(/\D/g, '');
    
    // Don't fetch if CEP is incomplete or already fetched
    if (!isValidCEP(addressData.cep) || cleanedCep === lastFetchedCep.current) {
      if (!isValidCEP(addressData.cep)) {
        setCepStatus('idle');
        setCepMessage('');
      }
      return;
    }

    const fetchAddress = async () => {
      setIsLoadingCEP(true);
      setCepStatus('loading');
      setCepMessage('Buscando endereço...');

      const result = await fetchAddressFromCEP(addressData.cep);

      if (result.success && result.data) {
        lastFetchedCep.current = cleanedCep;
        onAddressChangeRef.current('street', result.data.street);
        onAddressChangeRef.current('neighborhood', result.data.neighborhood);
        onAddressChangeRef.current('city', result.data.city);
        onAddressChangeRef.current('state', result.data.state);
        setCepStatus('success');
        setCepMessage('Endereço encontrado');
      } else {
        setCepStatus('error');
        setCepMessage(result.error || 'CEP não encontrado');
      }

      setIsLoadingCEP(false);
    };

    const debounceTimer = setTimeout(fetchAddress, 500);
    return () => clearTimeout(debounceTimer);
  }, [addressData.cep]);

  const handleCEPChange = (value: string) => {
    const masked = maskCEP(value);
    onAddressChange('cep', masked);
    
    // Reset status when CEP changes
    if (!isValidCEP(masked)) {
      setCepStatus('idle');
      setCepMessage('');
    }
  };

  return (
    <Card className={`${cardBg} ${borderRadius}`}>
      <CardContent className="p-4 space-y-4">
        {/* Header with step number */}
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {stepNumber}
          </div>
          <h2 className={`text-lg font-semibold ${textColor}`}>ENDEREÇO</h2>
        </div>

        {/* CEP Field with status */}
        <div className="space-y-2">
          <Label htmlFor="cep" className={`text-sm ${textColor}`}>
            CEP <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <MapPin className={`w-4 h-4 ${mutedTextColor}`} />
            </div>
            <Input
              id="cep"
              placeholder="DIGITE SEU CEP"
              value={addressData.cep}
              onChange={(e) => handleCEPChange(e.target.value)}
              onBlur={(e) => onValidateField('cep', e.target.value)}
              className={`${inputBg} h-12 ${borderRadius} pl-10 ${
                errors.cep ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
              maxLength={9}
              required
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {cepStatus === 'loading' && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {cepStatus === 'success' && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {cepStatus === 'error' && (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
            </div>
          </div>
          {/* Status message */}
          {cepMessage && (
            <p className={`text-xs ${
              cepStatus === 'success' ? 'text-green-500' : 
              cepStatus === 'error' ? 'text-destructive' : 
              mutedTextColor
            }`}>
              {cepMessage}
            </p>
          )}
          {errors.cep && !cepMessage && (
            <p className="text-xs text-destructive animate-in fade-in">{errors.cep}</p>
          )}
        </div>

        {/* Address fields (shown after CEP is fetched) */}
        {cepStatus === 'success' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Street */}
            <div className="space-y-2">
              <Label htmlFor="street" className={`text-sm ${textColor}`}>
                Rua/Logradouro <span className="text-destructive">*</span>
              </Label>
              <Input
                id="street"
                placeholder="Nome da rua"
                value={addressData.street}
                onChange={(e) => onAddressChange('street', e.target.value)}
                onBlur={(e) => onValidateField('street', e.target.value)}
                className={`${inputBg} h-12 ${borderRadius} ${
                  errors.street ? 'border-destructive' : ''
                }`}
                required
              />
              {errors.street && (
                <p className="text-xs text-destructive">{errors.street}</p>
              )}
            </div>

            {/* Number and Complement */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="number" className={`text-sm ${textColor}`}>
                  Número <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="number"
                  placeholder="Nº"
                  value={addressData.number}
                  onChange={(e) => onAddressChange('number', e.target.value)}
                  onBlur={(e) => onValidateField('number', e.target.value)}
                  className={`${inputBg} h-12 ${borderRadius} ${
                    errors.number ? 'border-destructive' : ''
                  }`}
                  required
                />
                {errors.number && (
                  <p className="text-xs text-destructive">{errors.number}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement" className={`text-sm ${textColor}`}>
                  Complemento
                </Label>
                <Input
                  id="complement"
                  placeholder="Apto, sala..."
                  value={addressData.complement}
                  onChange={(e) => onAddressChange('complement', e.target.value)}
                  className={`${inputBg} h-12 ${borderRadius}`}
                />
              </div>
            </div>

            {/* Neighborhood */}
            <div className="space-y-2">
              <Label htmlFor="neighborhood" className={`text-sm ${textColor}`}>
                Bairro <span className="text-destructive">*</span>
              </Label>
              <Input
                id="neighborhood"
                placeholder="Bairro"
                value={addressData.neighborhood}
                onChange={(e) => onAddressChange('neighborhood', e.target.value)}
                onBlur={(e) => onValidateField('neighborhood', e.target.value)}
                className={`${inputBg} h-12 ${borderRadius} ${
                  errors.neighborhood ? 'border-destructive' : ''
                }`}
                required
              />
              {errors.neighborhood && (
                <p className="text-xs text-destructive">{errors.neighborhood}</p>
              )}
            </div>

            {/* City and State */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="city" className={`text-sm ${textColor}`}>
                  Cidade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="Cidade"
                  value={addressData.city}
                  onChange={(e) => onAddressChange('city', e.target.value)}
                  onBlur={(e) => onValidateField('city', e.target.value)}
                  className={`${inputBg} h-12 ${borderRadius} ${
                    errors.city ? 'border-destructive' : ''
                  }`}
                  required
                />
                {errors.city && (
                  <p className="text-xs text-destructive">{errors.city}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className={`text-sm ${textColor}`}>
                  UF <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="state"
                  placeholder="UF"
                  value={addressData.state}
                  onChange={(e) => onAddressChange('state', e.target.value.toUpperCase().slice(0, 2))}
                  onBlur={(e) => onValidateField('state', e.target.value)}
                  className={`${inputBg} h-12 ${borderRadius} ${
                    errors.state ? 'border-destructive' : ''
                  }`}
                  maxLength={2}
                  required
                />
                {errors.state && (
                  <p className="text-xs text-destructive">{errors.state}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AddressSection;
