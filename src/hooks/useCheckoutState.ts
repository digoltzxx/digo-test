import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

// Estados possíveis do checkout com prioridade
export type CheckoutStatus = 
  | 'pending'      // Aguardando pagamento
  | 'processing'   // Processando pagamento
  | 'approved'     // Pagamento confirmado (PRIORIDADE MÁXIMA)
  | 'failed'       // Pagamento falhou
  | 'expired';     // Sessão expirada

// Prioridade de status - approved sempre vence
const STATUS_PRIORITY: Record<CheckoutStatus, number> = {
  approved: 100,   // Sempre visível, bloqueia outras mensagens
  failed: 50,      // Só aparece se approved não estiver ativo
  processing: 40,  // Status intermediário
  expired: 30,     // Só aparece se pending ou failed estiver ativo
  pending: 10,     // Estado inicial
};

interface CheckoutNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
  priority: number;
}

interface UseCheckoutStateReturn {
  // Estado atual
  status: CheckoutStatus;
  isLocked: boolean;
  
  // Timer
  timerSeconds: number;
  timerExpired: boolean;
  startTimer: (minutes: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  
  // Transições de estado
  setProcessing: () => boolean;
  setApproved: (message?: string) => void;
  setFailed: (message?: string) => void;
  setExpired: (message?: string) => void;
  reset: () => void;
  
  // Notificações
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  
  // Validação
  canShowNotification: (type: 'success' | 'error' | 'warning') => boolean;
  
  // PIX específico
  pixTimerSeconds: number;
  startPixTimer: (minutes: number) => void;
}

export function useCheckoutState(): UseCheckoutStateReturn {
  const [status, setStatus] = useState<CheckoutStatus>('pending');
  const [isLocked, setIsLocked] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [pixTimerSeconds, setPixTimerSeconds] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pixTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationQueueRef = useRef<CheckoutNotification[]>([]);
  
  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pixTimerRef.current) clearInterval(pixTimerRef.current);
    };
  }, []);
  
  // Timer principal do checkout
  useEffect(() => {
    if (timerSeconds > 0 && !timerPaused && status === 'pending') {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            // Só expira se não estiver aprovado ou processando
            if (status === 'pending') {
              handleExpiration();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [timerSeconds, timerPaused, status]);
  
  // Timer do PIX
  useEffect(() => {
    if (pixTimerSeconds > 0 && status !== 'approved') {
      pixTimerRef.current = setInterval(() => {
        setPixTimerSeconds(prev => {
          if (prev <= 1) {
            // Usa callback para evitar problema de closure
            setStatus(currentStatus => {
              if (currentStatus !== 'approved' && currentStatus !== 'processing') {
                toast.error("Tempo do PIX expirado. Por favor, tente novamente.");
                return 'failed';
              }
              return currentStatus;
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (pixTimerRef.current) clearInterval(pixTimerRef.current);
      };
    }
  }, [pixTimerSeconds, status]);
  
  const handleExpiration = useCallback(() => {
    // REGRA CRÍTICA: Nunca expirar se o pagamento foi aprovado
    if (status === 'approved') {
      console.log('[CheckoutState] Ignorando expiração - pagamento já aprovado');
      return;
    }
    
    // Também não expira se estiver processando
    if (status === 'processing') {
      console.log('[CheckoutState] Ignorando expiração - pagamento em processamento');
      return;
    }
    
    setStatus('expired');
    showNotification('warning', 'Sessão expirada. Atualize a página para continuar.');
  }, [status]);
  
  // Verifica se pode mostrar uma notificação baseado no status atual
  const canShowNotification = useCallback((type: 'success' | 'error' | 'warning'): boolean => {
    // Se aprovado, só permite notificações de sucesso
    if (status === 'approved') {
      return type === 'success';
    }
    
    // Se falhou, não permite notificações de expiração
    if (status === 'failed' && type === 'warning') {
      return false;
    }
    
    return true;
  }, [status]);
  
  const showNotification = useCallback((
    type: 'success' | 'error' | 'warning' | 'info', 
    message: string
  ) => {
    // Verifica prioridade antes de mostrar
    if (type !== 'info' && !canShowNotification(type as 'success' | 'error' | 'warning')) {
      console.log(`[CheckoutState] Notificação bloqueada: ${type} - ${message}`);
      return;
    }
    
    const notification: CheckoutNotification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      priority: type === 'success' ? 100 : type === 'error' ? 50 : type === 'warning' ? 30 : 10,
    };
    
    // Adiciona à fila
    notificationQueueRef.current = [
      ...notificationQueueRef.current.filter(n => n.priority >= notification.priority),
      notification,
    ].slice(-5); // Mantém últimas 5
    
    // Exibe usando toast
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      default:
        toast.info(message);
    }
  }, [canShowNotification]);
  
  const startTimer = useCallback((minutes: number) => {
    setTimerSeconds(minutes * 60);
    setTimerPaused(false);
  }, []);
  
  const pauseTimer = useCallback(() => {
    setTimerPaused(true);
  }, []);
  
  const resumeTimer = useCallback(() => {
    setTimerPaused(false);
  }, []);
  
  const startPixTimer = useCallback((minutes: number) => {
    setPixTimerSeconds(minutes * 60);
  }, []);
  
  const setProcessing = useCallback((): boolean => {
    // Não pode processar se já aprovado ou locked
    if (status === 'approved' || isLocked) {
      console.log('[CheckoutState] Não pode processar - status atual:', status);
      return false;
    }
    
    setStatus('processing');
    pauseTimer(); // Pausa timer durante processamento
    return true;
  }, [status, isLocked, pauseTimer]);
  
  const setApproved = useCallback((message?: string) => {
    console.log('[CheckoutState] Pagamento APROVADO');
    
    // LOCK: Uma vez aprovado, não muda mais
    setStatus('approved');
    setIsLocked(true);
    
    // Para todos os timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (pixTimerRef.current) clearInterval(pixTimerRef.current);
    
    showNotification('success', message || 'Pagamento confirmado! Obrigado pela compra.');
  }, [showNotification]);
  
  const setFailed = useCallback((message?: string) => {
    // REGRA: Nunca falhar se já aprovado
    if (status === 'approved') {
      console.log('[CheckoutState] Ignorando falha - pagamento já aprovado');
      return;
    }
    
    setStatus('failed');
    resumeTimer(); // Retoma timer para permitir nova tentativa
    showNotification('error', message || 'Pagamento falhou. Tente novamente.');
  }, [status, resumeTimer, showNotification]);
  
  const setExpired = useCallback((message?: string) => {
    // REGRA: Nunca expirar se aprovado ou processando
    if (status === 'approved' || status === 'processing') {
      console.log('[CheckoutState] Ignorando expiração - status atual:', status);
      return;
    }
    
    setStatus('expired');
    showNotification('warning', message || 'Sessão expirada. Atualize a página para continuar.');
  }, [status, showNotification]);
  
  const reset = useCallback(() => {
    if (isLocked) {
      console.log('[CheckoutState] Não pode resetar - checkout locked');
      return;
    }
    
    setStatus('pending');
    setTimerSeconds(0);
    setPixTimerSeconds(0);
    setTimerPaused(false);
    notificationQueueRef.current = [];
  }, [isLocked]);
  
  return {
    status,
    isLocked,
    timerSeconds,
    timerExpired: timerSeconds === 0 && status === 'expired',
    startTimer,
    pauseTimer,
    resumeTimer,
    setProcessing,
    setApproved,
    setFailed,
    setExpired,
    reset,
    showNotification,
    canShowNotification,
    pixTimerSeconds,
    startPixTimer,
  };
}
