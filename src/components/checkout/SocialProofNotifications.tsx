import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CheckCircle, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

// Valores padrão otimizados
const DEFAULT_INITIAL_DELAY = 3;
const DEFAULT_NOTIFICATION_DURATION = 5;
const DEFAULT_INTERVAL_MIN = 8;
const DEFAULT_INTERVAL_MAX = 15;
const DEFAULT_MIN_PEOPLE = 2;
const DEFAULT_MAX_PEOPLE = 15;

interface SocialProofSettings {
  social_proof_enabled: boolean;
  social_proof_notification_1_enabled: boolean;
  social_proof_notification_1_text: string;
  social_proof_notification_2_enabled: boolean;
  social_proof_notification_2_text: string;
  social_proof_notification_3_enabled: boolean;
  social_proof_notification_3_text: string;
  social_proof_notification_4_enabled: boolean;
  social_proof_notification_4_text: string;
  // Timing settings
  social_proof_initial_delay?: number;
  social_proof_duration?: number;
  social_proof_interval_min?: number;
  social_proof_interval_max?: number;
  social_proof_min_people?: number;
  social_proof_max_people?: number;
}

interface SocialProofNotificationsProps {
  settings: SocialProofSettings;
  productName: string;
  primaryColor: string;
  isDarkTheme?: boolean;
}

// Nomes masculinos brasileiros
const MALE_NAMES = [
  "João P.", "Pedro M.", "Lucas A.", "Gabriel T.", "Rafael B.",
  "Bruno G.", "Diego S.", "Felipe H.", "Henrique C.", "José A.",
  "Matheus R.", "André L.", "Carlos E.", "Daniel F.", "Eduardo S.",
  "Fernando O.", "Gustavo M.", "Igor N.", "Leonardo V.", "Marcos P.",
  "Nelson R.", "Otávio S.", "Paulo H.", "Ricardo L.", "Thiago B."
];

// Nomes femininos brasileiros
const FEMALE_NAMES = [
  "Maria S.", "Ana C.", "Carla R.", "Fernanda L.", "Juliana F.",
  "Amanda O.", "Camila D.", "Eduarda N.", "Gabriela V.", "Isabela M.",
  "Larissa T.", "Mariana B.", "Natália R.", "Patrícia S.", "Renata L.",
  "Sandra M.", "Tatiane F.", "Vanessa P.", "Bruna C.", "Cristina A.",
  "Daniela H.", "Elena G.", "Flávia N.", "Helena V.", "Letícia O."
];

const SocialProofNotifications = ({
  settings,
  productName,
  primaryColor,
  isDarkTheme = true
}: SocialProofNotificationsProps) => {
  const [notification, setNotification] = useState<{ text: string; visible: boolean } | null>(null);
  const lastNotificationIndex = useRef<number>(-1);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get timing values from settings or use defaults
  const INITIAL_DELAY = settings.social_proof_initial_delay ?? DEFAULT_INITIAL_DELAY;
  const NOTIFICATION_DURATION = settings.social_proof_duration ?? DEFAULT_NOTIFICATION_DURATION;
  const INTERVAL_MIN = settings.social_proof_interval_min ?? DEFAULT_INTERVAL_MIN;
  const INTERVAL_MAX = settings.social_proof_interval_max ?? DEFAULT_INTERVAL_MAX;
  const MIN_PEOPLE = settings.social_proof_min_people ?? DEFAULT_MIN_PEOPLE;
  const MAX_PEOPLE = settings.social_proof_max_people ?? DEFAULT_MAX_PEOPLE;

  // Get enabled notifications
  const getEnabledNotifications = useCallback(() => {
    const notifications: { index: number; text: string }[] = [];
    
    if (settings.social_proof_notification_1_enabled) {
      notifications.push({ index: 1, text: settings.social_proof_notification_1_text });
    }
    if (settings.social_proof_notification_2_enabled) {
      notifications.push({ index: 2, text: settings.social_proof_notification_2_text });
    }
    if (settings.social_proof_notification_3_enabled) {
      notifications.push({ index: 3, text: settings.social_proof_notification_3_text });
    }
    if (settings.social_proof_notification_4_enabled) {
      notifications.push({ index: 4, text: settings.social_proof_notification_4_text });
    }
    
    return notifications;
  }, [settings]);

  // Process template variables
  const processTemplate = useCallback((template: string): string => {
    const randomPeople = Math.floor(Math.random() * (MAX_PEOPLE - MIN_PEOPLE + 1)) + MIN_PEOPLE;
    const randomMaleName = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
    const randomFemaleName = FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)];

    return template
      .replace(/{quantidadePessoas}/g, String(randomPeople))
      .replace(/{nomeProduto}/g, productName)
      .replace(/{nomeHomem}/g, randomMaleName)
      .replace(/{nomeMulher}/g, randomFemaleName)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }, [productName]);

  // Show notification
  const showNotification = useCallback(() => {
    const enabledNotifications = getEnabledNotifications();
    
    if (enabledNotifications.length === 0) return;

    // Select next notification (avoid repeating the same one)
    let nextIndex = 0;
    if (enabledNotifications.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * enabledNotifications.length);
      } while (enabledNotifications[nextIndex].index === lastNotificationIndex.current);
    }

    const selectedNotification = enabledNotifications[nextIndex];
    lastNotificationIndex.current = selectedNotification.index;

    const processedText = processTemplate(selectedNotification.text);
    
    setNotification({ text: processedText, visible: true });

    // Hide after duration
    timeoutRef.current = setTimeout(() => {
      setNotification(prev => prev ? { ...prev, visible: false } : null);
    }, NOTIFICATION_DURATION * 1000);
  }, [getEnabledNotifications, processTemplate, NOTIFICATION_DURATION]);

  // Setup notification cycle
  useEffect(() => {
    if (!settings.social_proof_enabled) return;

    const enabledNotifications = getEnabledNotifications();
    if (enabledNotifications.length === 0) return;

    // Initial delay
    const initialTimeout = setTimeout(() => {
      showNotification();

      // Setup interval for subsequent notifications
      const scheduleNext = () => {
        const randomInterval = (Math.random() * (INTERVAL_MAX - INTERVAL_MIN) + INTERVAL_MIN) * 1000;
        
        intervalRef.current = setTimeout(() => {
          showNotification();
          scheduleNext();
        }, randomInterval);
      };

      scheduleNext();
    }, INITIAL_DELAY * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [settings.social_proof_enabled, getEnabledNotifications, showNotification, INITIAL_DELAY, INTERVAL_MIN, INTERVAL_MAX]);

  if (!settings.social_proof_enabled || !notification) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 transition-all duration-500 max-w-sm",
        notification.visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md",
          isDarkTheme
            ? "bg-slate-900/95 border-slate-700/50"
            : "bg-white/95 border-slate-200/50"
        )}
        style={{
          boxShadow: `0 10px 40px -10px ${primaryColor}40, 0 4px 20px rgba(0,0,0,0.3)`
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500/10"
        >
          <ShoppingCart className="w-5 h-5 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className={cn(
              "text-xs font-medium",
              isDarkTheme ? "text-green-400" : "text-green-600"
            )}>
              Compra verificada
            </span>
          </div>
          <p
            className={cn(
              "text-sm leading-snug",
              isDarkTheme ? "text-slate-200" : "text-slate-700"
            )}
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(notification.text, {
                ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'span'],
                ALLOWED_ATTR: ['class'],
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
                FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style']
              })
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SocialProofNotifications;
