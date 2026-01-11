import React, { createContext, useContext, ReactNode } from "react";
import { useCheckoutState, CheckoutStatus } from "@/hooks/useCheckoutState";

interface CheckoutContextType {
  // Estado
  status: CheckoutStatus;
  isLocked: boolean;
  
  // Timer
  timerSeconds: number;
  timerExpired: boolean;
  startTimer: (minutes: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  
  // PIX Timer
  pixTimerSeconds: number;
  startPixTimer: (minutes: number) => void;
  
  // Transições
  setProcessing: () => boolean;
  setApproved: (message?: string) => void;
  setFailed: (message?: string) => void;
  setExpired: (message?: string) => void;
  reset: () => void;
  
  // Notificações
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  canShowNotification: (type: 'success' | 'error' | 'warning') => boolean;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const checkoutState = useCheckoutState();
  
  return (
    <CheckoutContext.Provider value={checkoutState}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckoutContext(): CheckoutContextType {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error("useCheckoutContext must be used within a CheckoutProvider");
  }
  return context;
}

// Hook para verificar se pode mostrar timer de expiração
export function useCanShowExpiration(): boolean {
  const { status, canShowNotification } = useCheckoutContext();
  return status === 'pending' && canShowNotification('warning');
}
