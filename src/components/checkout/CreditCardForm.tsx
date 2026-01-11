import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Lock } from "lucide-react";
import { formatCardNumber, formatExpiryDate, formatCVV, detectCardBrand, ThreeDSSettings } from "@/hooks/usePodPayCard";

interface CreditCardFormProps {
  cardData: {
    number: string;
    holderName: string;
    expiry: string;
    cvv: string;
  };
  onCardDataChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  threeDSSettings?: ThreeDSSettings | null;
  iframeId?: string | null;
}

const CreditCardForm = ({ 
  cardData, 
  onCardDataChange, 
  errors = {}, 
  disabled = false,
  threeDSSettings,
  iframeId,
}: CreditCardFormProps) => {
  const cardBrand = detectCardBrand(cardData.number);
  const iframeContainerRef = useRef<HTMLDivElement>(null);

  // Create iframe dynamically if 3DS type is IFRAME
  useEffect(() => {
    if (
      threeDSSettings?.threeDSSecurityType === 'IFRAME' && 
      threeDSSettings?.iframeUrl && 
      iframeId &&
      iframeContainerRef.current
    ) {
      // Check if iframe already exists
      if (document.getElementById(iframeId)) return;

      const iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.src = threeDSSettings.iframeUrl;
      iframe.width = '100%';
      iframe.height = '400px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';

      iframeContainerRef.current.appendChild(iframe);

      return () => {
        if (iframeContainerRef.current && iframe.parentNode) {
          iframeContainerRef.current.removeChild(iframe);
        }
      };
    }
  }, [threeDSSettings, iframeId]);

  const handleNumberChange = (value: string) => {
    onCardDataChange('number', formatCardNumber(value));
  };

  const handleExpiryChange = (value: string) => {
    onCardDataChange('expiry', formatExpiryDate(value));
  };

  const handleCVVChange = (value: string) => {
    onCardDataChange('cvv', formatCVV(value));
  };

  const handleHolderNameChange = (value: string) => {
    // Only allow letters and spaces, convert to uppercase
    const filtered = value.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
    onCardDataChange('holderName', filtered);
  };

  // If hideCardForm is true and we have an iframe, show only the iframe
  if (threeDSSettings?.hideCardForm && threeDSSettings?.threeDSSecurityType === 'IFRAME') {
    return (
      <div className="space-y-4 p-4 rounded-lg bg-secondary/20 border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-white">Dados do Cartão</span>
          <Lock className="w-4 h-4 text-green-500 ml-auto" />
          <span className="text-xs text-green-500">Ambiente Seguro</span>
        </div>
        
        {/* 3DS Iframe Container */}
        <div 
          ref={iframeContainerRef} 
          className="w-full min-h-[400px] bg-background/30 rounded-lg overflow-hidden"
        />

        <p className="text-xs text-gray-500 text-center mt-2">
          Seus dados são processados em ambiente seguro
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 rounded-lg bg-secondary/20 border border-border/30">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium text-white">Dados do Cartão</span>
        <Lock className="w-4 h-4 text-green-500 ml-auto" />
        <span className="text-xs text-green-500">Criptografado</span>
      </div>

      {/* Show iframe if IFRAME type but hideCardForm is false */}
      {threeDSSettings?.threeDSSecurityType === 'IFRAME' && threeDSSettings?.iframeUrl && (
        <div 
          ref={iframeContainerRef} 
          className="w-full min-h-[200px] bg-background/30 rounded-lg overflow-hidden mb-4"
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="cardNumber" className="text-white">Número do cartão</Label>
        <div className="relative">
          <Input
            id="cardNumber"
            placeholder="0000 0000 0000 0000"
            value={cardData.number}
            onChange={(e) => handleNumberChange(e.target.value)}
            disabled={disabled}
            maxLength={19}
            className={`bg-background/50 border-border/50 pr-12 ${errors.cardNumber ? 'border-red-500' : ''}`}
          />
          {cardBrand && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-xs font-semibold text-primary uppercase">
                {cardBrand}
              </span>
            </div>
          )}
        </div>
        {errors.cardNumber && <p className="text-xs text-red-500">{errors.cardNumber}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="holderName" className="text-white">Nome no cartão</Label>
        <Input
          id="holderName"
          placeholder="NOME COMO ESTÁ NO CARTÃO"
          value={cardData.holderName}
          onChange={(e) => handleHolderNameChange(e.target.value)}
          disabled={disabled}
          maxLength={50}
          className={`bg-background/50 border-border/50 uppercase ${errors.holderName ? 'border-red-500' : ''}`}
        />
        {errors.holderName && <p className="text-xs text-red-500">{errors.holderName}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiry" className="text-white">Validade</Label>
          <Input
            id="expiry"
            placeholder="MM/AA"
            value={cardData.expiry}
            onChange={(e) => handleExpiryChange(e.target.value)}
            disabled={disabled}
            maxLength={5}
            className={`bg-background/50 border-border/50 ${errors.expiry ? 'border-red-500' : ''}`}
          />
          {errors.expiry && <p className="text-xs text-red-500">{errors.expiry}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvv" className="text-white">CVV</Label>
          <Input
            id="cvv"
            placeholder="000"
            value={cardData.cvv}
            onChange={(e) => handleCVVChange(e.target.value)}
            disabled={disabled}
            maxLength={4}
            type="password"
            className={`bg-background/50 border-border/50 ${errors.cvv ? 'border-red-500' : ''}`}
          />
          {errors.cvv && <p className="text-xs text-red-500">{errors.cvv}</p>}
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">
        Seus dados são criptografados e nunca armazenados
      </p>
    </div>
  );
};

export default CreditCardForm;
