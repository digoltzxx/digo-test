import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    ShieldHelper: {
      getModuleName: () => string;
      getIframeId: () => string;
      convertDecimalToCents: (value: number, currency: string) => number;
      prepareThreeDS: (params: { amount: number; installments: number; currency: string }) => Promise<void>;
      subscribeIframeFormValidation: (callback: (data: { hasError: boolean }) => void) => void;
      finishThreeDS: (transaction: any, options?: { disableRedirect?: boolean }) => Promise<void>;
    };
    [key: string]: any;
  }
}

export interface CardFormData {
  number: string;
  holderName: string;
  expiry: string;
  cvv: string;
}

export interface ThreeDSSettings {
  threeDSSecurity: boolean;
  threeDSSecurityType: 'NONE' | 'IFRAME' | 'REDIRECT' | 'SCRIPT';
  iframeUrl: string | null;
  hideCardForm: boolean;
}

// Parsed card data ready for backend
export interface ParsedCardData {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
}

export const usePodPayCard = (publicKey: string | null) => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threeDSSettings, setThreeDSSettings] = useState<ThreeDSSettings | null>(null);
  const [iframeFormValid, setIframeFormValid] = useState(false);
  const moduleName = useRef<string | null>(null);

  // Initialize PodPay and get 3DS settings
  useEffect(() => {
    const initPodPay = async () => {
      if (!publicKey) return;
      
      // Wait for ShieldHelper to be available
      const maxAttempts = 30;
      let attempts = 0;
      
      while (!window.ShieldHelper && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      if (!window.ShieldHelper) {
        console.error('ShieldHelper not available after timeout');
        setError('Sistema de pagamento indisponível');
        return;
      }

      try {
        // Get module name dynamically
        moduleName.current = window.ShieldHelper.getModuleName();

        // Wait for the module to be available
        while (!window[moduleName.current] && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }

        if (!window[moduleName.current]) {
          throw new Error('Payment module not available');
        }

        // Set public key
        await window[moduleName.current].setPublicKey(publicKey);

        // Get 3DS settings
        const settingsResponse = await fetch(
          `https://api.podpay.co/api/v1/js/get3dsSettings?publicKey=${publicKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          }
        );

        if (settingsResponse.ok) {
          const settings = await settingsResponse.json();
          setThreeDSSettings(settings);

          // Subscribe to iframe form validation if using iframe
          if (settings.threeDSSecurityType === 'IFRAME') {
            window.ShieldHelper.subscribeIframeFormValidation((data) => {
              setIframeFormValid(!data.hasError);
            });
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error('Error initializing PodPay:', err);
        setError('Erro ao inicializar pagamento com cartão');
      }
    };

    initPodPay();
  }, [publicKey]);

  // Prepare 3DS before transaction (called before backend creates transaction)
  const prepareThreeDS = useCallback(async (amount: number, installments: number = 1, currency: string = 'BRL') => {
    if (!window.ShieldHelper) {
      console.warn('ShieldHelper not available, skipping 3DS preparation');
      return;
    }

    try {
      // Convert decimal to cents using ShieldHelper
      const amountInCents = window.ShieldHelper.convertDecimalToCents(amount, currency);

      // Prepare 3DS
      await window.ShieldHelper.prepareThreeDS({
        amount: amountInCents,
        installments,
        currency,
      });
    } catch (err) {
      console.error('Error preparing 3DS:', err);
      // Don't throw, 3DS preparation failure shouldn't block payment
    }
  }, []);

  // Encrypt card data (to get token for backend)
  const encryptCard = useCallback(async (cardData: CardFormData | null): Promise<string | null> => {
    if (!isReady || !moduleName.current || !window[moduleName.current]) {
      setError('Sistema de pagamento não inicializado');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      let encryptData: any;

      // Check if we should use null values (hideCardForm = true)
      if (threeDSSettings?.hideCardForm && !cardData) {
        encryptData = {
          number: null,
          holderName: null,
          expMonth: null,
          expYear: null,
          cvv: null,
        };
      } else if (cardData) {
        // Parse expiry (MM/AA or MM/AAAA)
        const [expMonth, expYear] = cardData.expiry.split('/');
        const month = parseInt(expMonth, 10);
        let year = parseInt(expYear, 10);
        
        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year += 2000;
        }

        // Validate inputs
        if (!cardData.number || cardData.number.replace(/\s/g, '').length < 13) {
          throw new Error('Número do cartão inválido');
        }
        if (!cardData.holderName || cardData.holderName.length < 3) {
          throw new Error('Nome do titular inválido');
        }
        if (isNaN(month) || month < 1 || month > 12) {
          throw new Error('Mês de validade inválido');
        }
        if (isNaN(year) || year < new Date().getFullYear()) {
          throw new Error('Ano de validade inválido');
        }
        if (!cardData.cvv || cardData.cvv.length < 3) {
          throw new Error('CVV inválido');
        }

        encryptData = {
          number: cardData.number.replace(/\s/g, ''),
          holderName: cardData.holderName.toUpperCase(),
          expMonth: month,
          expYear: year,
          cvv: cardData.cvv,
        };
      } else {
        throw new Error('Dados do cartão são obrigatórios');
      }

      // Call encrypt on the correct module
      const token = await window[moduleName.current].encrypt(encryptData);
      return token;
    } catch (err: any) {
      console.error('Error encrypting card:', err);
      setError(err.message || 'Erro ao processar dados do cartão');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isReady, threeDSSettings]);

  // Finish 3DS process after backend creates transaction
  // transactionData is the full response from backend (contains PodPay transaction data)
  // disableRedirect should be FALSE to allow automatic redirect
  const finishThreeDS = useCallback(async (transactionData: any, disableRedirect: boolean = false) => {
    if (!window.ShieldHelper) {
      console.warn('ShieldHelper not available');
      return;
    }

    try {
      await window.ShieldHelper.finishThreeDS(transactionData, { disableRedirect });
    } catch (err) {
      console.error('Error finishing 3DS:', err);
      throw err;
    }
  }, []);

  // Get iframe ID for dynamic iframe creation
  const getIframeId = useCallback(() => {
    if (!window.ShieldHelper) return null;
    return window.ShieldHelper.getIframeId();
  }, []);

  return {
    isReady,
    isLoading,
    error,
    threeDSSettings,
    iframeFormValid,
    prepareThreeDS,
    encryptCard,
    finishThreeDS,
    getIframeId,
  };
};

// Card number formatting
export const formatCardNumber = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  const groups = numbers.match(/.{1,4}/g) || [];
  return groups.join(' ').slice(0, 19);
};

// Expiry date formatting (MM/AA)
export const formatExpiryDate = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length >= 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  }
  return numbers;
};

// CVV formatting
export const formatCVV = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 4);
};

// Detect card brand from number
export const detectCardBrand = (number: string): string | null => {
  const cleanNumber = number.replace(/\s/g, '');
  
  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  if (/^(?:2131|1800|35)/.test(cleanNumber)) return 'jcb';
  if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) return 'diners';
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(cleanNumber)) return 'elo';
  if (/^(606282|3841)/.test(cleanNumber)) return 'hipercard';
  
  return null;
};
