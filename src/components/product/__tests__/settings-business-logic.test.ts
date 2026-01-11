import { describe, it, expect } from 'vitest';
import {
  MIN_COMMISSION,
  MAX_COMMISSION,
} from '../settings/AffiliateSettings';
import {
  validateWhatsAppNumber,
  formatWhatsAppDisplay,
} from '../settings/NotificationSettings';
import {
  DEFAULT_THANK_YOU_MESSAGE,
  MAX_MESSAGE_LENGTH,
} from '../settings/ThankYouMessage';

/**
 * Testes de validação das regras de negócio do sistema de configurações
 * Simula as validações que seriam feitas no backend
 */
describe('Product Settings Business Logic', () => {
  describe('Affiliate Commission Rules', () => {
    const validateCommission = (commission: number, affiliatesEnabled: boolean): { valid: boolean; error?: string } => {
      if (!affiliatesEnabled) {
        return { valid: true }; // Commission is ignored when affiliates are disabled
      }
      
      if (isNaN(commission)) {
        return { valid: false, error: 'Valor inválido' };
      }
      
      if (commission < MIN_COMMISSION) {
        return { valid: false, error: `Comissão mínima é ${MIN_COMMISSION}%` };
      }
      
      if (commission > MAX_COMMISSION) {
        return { valid: false, error: `Comissão máxima é ${MAX_COMMISSION}%` };
      }
      
      return { valid: true };
    };

    it('rejects commission below minimum when affiliates enabled', () => {
      const result = validateCommission(0, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mínima');
    });

    it('rejects commission above maximum when affiliates enabled', () => {
      const result = validateCommission(95, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('máxima');
    });

    it('accepts valid commission within range', () => {
      expect(validateCommission(MIN_COMMISSION, true).valid).toBe(true);
      expect(validateCommission(50, true).valid).toBe(true);
      expect(validateCommission(MAX_COMMISSION, true).valid).toBe(true);
    });

    it('ignores commission validation when affiliates disabled', () => {
      expect(validateCommission(0, false).valid).toBe(true);
      expect(validateCommission(100, false).valid).toBe(true);
    });

    it('rejects NaN commission', () => {
      const result = validateCommission(NaN, true);
      expect(result.valid).toBe(false);
    });
  });

  describe('Affiliate Commission Calculation', () => {
    const calculateCommission = (saleValue: number, commissionPercent: number): number => {
      return saleValue * (commissionPercent / 100);
    };

    it('calculates 30% commission correctly', () => {
      expect(calculateCommission(100, 30)).toBe(30);
      expect(calculateCommission(200, 30)).toBe(60);
    });

    it('calculates boundary commissions correctly', () => {
      expect(calculateCommission(100, MIN_COMMISSION)).toBe(1);
      expect(calculateCommission(100, MAX_COMMISSION)).toBe(90);
    });

    it('handles decimal sale values', () => {
      expect(calculateCommission(99.90, 10)).toBeCloseTo(9.99);
    });
  });

  describe('WhatsApp Notification Rules', () => {
    it('requires valid number to enable notifications', () => {
      expect(validateWhatsAppNumber('')).toBe(false);
      expect(validateWhatsAppNumber('123')).toBe(false);
      expect(validateWhatsAppNumber('11999999999')).toBe(true);
    });

    it('accepts various valid number formats', () => {
      expect(validateWhatsAppNumber('1199999999')).toBe(true); // 10 digits
      expect(validateWhatsAppNumber('11999999999')).toBe(true); // 11 digits
      expect(validateWhatsAppNumber('5511999999999')).toBe(true); // 13 digits with country code
    });

    it('formats display correctly for user', () => {
      expect(formatWhatsAppDisplay('11999999999')).toBe('(11) 99999-9999');
      expect(formatWhatsAppDisplay('5511999999999')).toBe('+55 (11) 99999-9999');
    });
  });

  describe('Email Notification Rules', () => {
    const canEnableEmailNotifications = (userEmail: string | null): boolean => {
      return userEmail !== null && userEmail.length > 0;
    };

    it('requires user email to enable notifications', () => {
      expect(canEnableEmailNotifications(null)).toBe(false);
      expect(canEnableEmailNotifications('')).toBe(false);
      expect(canEnableEmailNotifications('user@email.com')).toBe(true);
    });
  });

  describe('Thank You Message Rules', () => {
    const validateMessage = (message: string): { valid: boolean; error?: string } => {
      if (message.length > MAX_MESSAGE_LENGTH) {
        return { valid: false, error: `Máximo de ${MAX_MESSAGE_LENGTH} caracteres` };
      }
      return { valid: true };
    };

    const getDisplayMessage = (customMessage: string): string => {
      return customMessage || DEFAULT_THANK_YOU_MESSAGE;
    };

    it('accepts messages within character limit', () => {
      expect(validateMessage('')).toEqual({ valid: true });
      expect(validateMessage('Obrigado!')).toEqual({ valid: true });
      expect(validateMessage('a'.repeat(MAX_MESSAGE_LENGTH))).toEqual({ valid: true });
    });

    it('rejects messages exceeding character limit', () => {
      const result = validateMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('500');
    });

    it('uses default message when custom is empty', () => {
      expect(getDisplayMessage('')).toBe(DEFAULT_THANK_YOU_MESSAGE);
    });

    it('uses custom message when provided', () => {
      expect(getDisplayMessage('Custom!')).toBe('Custom!');
    });

    it('supports emojis in message', () => {
      const emojiMessage = 'Obrigado! 🎉🎊';
      expect(validateMessage(emojiMessage).valid).toBe(true);
    });

    it('supports line breaks in message', () => {
      const multilineMessage = 'Linha 1\nLinha 2\nLinha 3';
      expect(validateMessage(multilineMessage).valid).toBe(true);
    });
  });

  describe('Settings Persistence Rules', () => {
    interface ProductSettings {
      enable_affiliates: boolean;
      affiliate_commission: number;
      enable_email_notifications: boolean;
      enable_whatsapp_notifications: boolean;
      whatsapp_number: string;
      custom_thank_you_message: string;
    }

    const prepareSettingsForSave = (settings: ProductSettings): Partial<ProductSettings> => {
      return {
        enable_affiliates: settings.enable_affiliates,
        affiliate_commission: settings.enable_affiliates ? settings.affiliate_commission : 0,
        enable_email_notifications: settings.enable_email_notifications,
        enable_whatsapp_notifications: settings.enable_whatsapp_notifications,
        whatsapp_number: settings.whatsapp_number || null,
        custom_thank_you_message: settings.custom_thank_you_message || null,
      };
    };

    it('sets commission to 0 when affiliates are disabled', () => {
      const settings: ProductSettings = {
        enable_affiliates: false,
        affiliate_commission: 50,
        enable_email_notifications: true,
        enable_whatsapp_notifications: false,
        whatsapp_number: '',
        custom_thank_you_message: '',
      };
      
      const prepared = prepareSettingsForSave(settings);
      expect(prepared.affiliate_commission).toBe(0);
    });

    it('preserves commission when affiliates are enabled', () => {
      const settings: ProductSettings = {
        enable_affiliates: true,
        affiliate_commission: 50,
        enable_email_notifications: true,
        enable_whatsapp_notifications: false,
        whatsapp_number: '',
        custom_thank_you_message: '',
      };
      
      const prepared = prepareSettingsForSave(settings);
      expect(prepared.affiliate_commission).toBe(50);
    });

    it('nullifies empty strings for optional fields', () => {
      const settings: ProductSettings = {
        enable_affiliates: true,
        affiliate_commission: 30,
        enable_email_notifications: true,
        enable_whatsapp_notifications: false,
        whatsapp_number: '',
        custom_thank_you_message: '',
      };
      
      const prepared = prepareSettingsForSave(settings);
      expect(prepared.whatsapp_number).toBeNull();
      expect(prepared.custom_thank_you_message).toBeNull();
    });
  });
});
