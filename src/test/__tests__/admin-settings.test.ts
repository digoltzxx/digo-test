import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes para Configurações Administrativas
 * 
 * Valida que os toggles de configuração funcionam corretamente:
 * - Aprovação automática de saques
 * - Aprovação automática de contas bancárias
 * - Modo de manutenção
 * - Notificações por email
 */

// Mock system settings
const createMockSettings = (overrides = {}) => ({
  auto_approve_withdrawals: 'false',
  auto_approve_bank_accounts: 'false',
  maintenance_mode: 'false',
  enable_email_notifications: 'true',
  withdrawal_fee: '4.90',
  minimum_withdrawal: '50',
  ...overrides
});

// Withdrawal auto-approval logic
const shouldAutoApproveWithdrawal = (settings: Record<string, string>, userBlocked: boolean, balance: number, amount: number) => {
  if (settings.auto_approve_withdrawals !== 'true') return { approve: false, reason: 'auto_approve_disabled' };
  if (userBlocked) return { approve: false, reason: 'user_blocked' };
  if (balance <= 0) return { approve: false, reason: 'insufficient_balance' };
  if (amount > balance) return { approve: false, reason: 'amount_exceeds_balance' };
  return { approve: true, reason: null };
};

// Bank account auto-approval logic
const shouldAutoApproveBankAccount = (
  settings: Record<string, string>, 
  userBlocked: boolean,
  bankData: { bank_name: string; agency: string; account_number: string; pix_key?: string; pix_key_type?: string }
) => {
  if (settings.auto_approve_bank_accounts !== 'true') return { approve: false, reason: 'auto_approve_disabled' };
  if (userBlocked) return { approve: false, reason: 'user_blocked' };
  
  // Validate bank data
  if (!bankData.bank_name || bankData.bank_name.length < 2) return { approve: false, reason: 'invalid_bank_name' };
  if (!bankData.agency || !/^\d{4,5}$/.test(bankData.agency.replace(/[^\d]/g, ''))) return { approve: false, reason: 'invalid_agency' };
  if (!bankData.account_number || !/^\d{5,12}$/.test(bankData.account_number.replace(/[^\d-]/g, ''))) return { approve: false, reason: 'invalid_account' };
  
  return { approve: true, reason: null };
};

// Maintenance mode check
const checkMaintenanceAccess = (maintenanceMode: boolean, isAdmin: boolean, isExemptRoute: boolean) => {
  if (!maintenanceMode) return { allowed: true, reason: 'system_operational' };
  if (isAdmin) return { allowed: true, reason: 'admin_bypass' };
  if (isExemptRoute) return { allowed: true, reason: 'exempt_route' };
  return { allowed: false, reason: 'maintenance_mode' };
};

// Notification dispatch logic
const shouldSendAdminNotification = (settings: Record<string, string>, eventType: string) => {
  if (settings.enable_email_notifications !== 'true') return false;
  
  const notifiableEvents = ['pending_withdrawal', 'pending_bank_account', 'auto_approve_error', 'maintenance_mode'];
  return notifiableEvents.includes(eventType);
};

describe('Aprovação Automática de Saques', () => {
  it('deve aprovar automaticamente quando toggle ativado e todas condições satisfeitas', () => {
    const settings = createMockSettings({ auto_approve_withdrawals: 'true' });
    const result = shouldAutoApproveWithdrawal(settings, false, 1000, 500);
    expect(result.approve).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('deve recusar quando toggle desativado', () => {
    const settings = createMockSettings({ auto_approve_withdrawals: 'false' });
    const result = shouldAutoApproveWithdrawal(settings, false, 1000, 500);
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('auto_approve_disabled');
  });

  it('deve recusar quando usuário bloqueado', () => {
    const settings = createMockSettings({ auto_approve_withdrawals: 'true' });
    const result = shouldAutoApproveWithdrawal(settings, true, 1000, 500);
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('user_blocked');
  });

  it('deve recusar quando saldo insuficiente', () => {
    const settings = createMockSettings({ auto_approve_withdrawals: 'true' });
    const result = shouldAutoApproveWithdrawal(settings, false, 0, 500);
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('insufficient_balance');
  });

  it('deve recusar quando valor excede saldo', () => {
    const settings = createMockSettings({ auto_approve_withdrawals: 'true' });
    const result = shouldAutoApproveWithdrawal(settings, false, 100, 500);
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('amount_exceeds_balance');
  });
});

describe('Aprovação Automática de Contas Bancárias', () => {
  const validBankData = {
    bank_name: 'Banco do Brasil',
    agency: '1234',
    account_number: '123456'
  };

  it('deve aprovar automaticamente quando toggle ativado e dados válidos', () => {
    const settings = createMockSettings({ auto_approve_bank_accounts: 'true' });
    const result = shouldAutoApproveBankAccount(settings, false, validBankData);
    expect(result.approve).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('deve recusar quando toggle desativado', () => {
    const settings = createMockSettings({ auto_approve_bank_accounts: 'false' });
    const result = shouldAutoApproveBankAccount(settings, false, validBankData);
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('auto_approve_disabled');
  });

  it('deve recusar quando usuário bloqueado', () => {
    const settings = createMockSettings({ auto_approve_bank_accounts: 'true' });
    const result = shouldAutoApproveBankAccount(settings, true, validBankData);
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('user_blocked');
  });

  it('deve recusar quando nome do banco inválido', () => {
    const settings = createMockSettings({ auto_approve_bank_accounts: 'true' });
    const result = shouldAutoApproveBankAccount(settings, false, { ...validBankData, bank_name: 'A' });
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('invalid_bank_name');
  });

  it('deve recusar quando agência inválida', () => {
    const settings = createMockSettings({ auto_approve_bank_accounts: 'true' });
    const result = shouldAutoApproveBankAccount(settings, false, { ...validBankData, agency: '12' });
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('invalid_agency');
  });

  it('deve recusar quando conta inválida', () => {
    const settings = createMockSettings({ auto_approve_bank_accounts: 'true' });
    const result = shouldAutoApproveBankAccount(settings, false, { ...validBankData, account_number: '123' });
    expect(result.approve).toBe(false);
    expect(result.reason).toBe('invalid_account');
  });
});

describe('Modo de Manutenção', () => {
  it('deve permitir acesso quando modo desativado', () => {
    const result = checkMaintenanceAccess(false, false, false);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('system_operational');
  });

  it('deve permitir acesso a admins mesmo em manutenção', () => {
    const result = checkMaintenanceAccess(true, true, false);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('admin_bypass');
  });

  it('deve permitir acesso a rotas isentas mesmo em manutenção', () => {
    const result = checkMaintenanceAccess(true, false, true);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('exempt_route');
  });

  it('deve bloquear usuário comum em manutenção', () => {
    const result = checkMaintenanceAccess(true, false, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('maintenance_mode');
  });
});

describe('Notificações por Email', () => {
  it('deve enviar notificação quando toggle ativado e evento válido', () => {
    const settings = createMockSettings({ enable_email_notifications: 'true' });
    expect(shouldSendAdminNotification(settings, 'pending_withdrawal')).toBe(true);
    expect(shouldSendAdminNotification(settings, 'pending_bank_account')).toBe(true);
    expect(shouldSendAdminNotification(settings, 'auto_approve_error')).toBe(true);
    expect(shouldSendAdminNotification(settings, 'maintenance_mode')).toBe(true);
  });

  it('não deve enviar notificação quando toggle desativado', () => {
    const settings = createMockSettings({ enable_email_notifications: 'false' });
    expect(shouldSendAdminNotification(settings, 'pending_withdrawal')).toBe(false);
    expect(shouldSendAdminNotification(settings, 'pending_bank_account')).toBe(false);
  });

  it('não deve enviar notificação para eventos não suportados', () => {
    const settings = createMockSettings({ enable_email_notifications: 'true' });
    expect(shouldSendAdminNotification(settings, 'unknown_event')).toBe(false);
    expect(shouldSendAdminNotification(settings, '')).toBe(false);
  });
});

describe('Prevenção de Duplicação', () => {
  const processedIds = new Set<string>();
  
  const processWithIdempotency = (id: string, action: () => void) => {
    if (processedIds.has(id)) {
      return { processed: false, reason: 'duplicate' };
    }
    processedIds.add(id);
    action();
    return { processed: true, reason: null };
  };

  beforeEach(() => {
    processedIds.clear();
  });

  it('deve processar primeira requisição', () => {
    let counter = 0;
    const result = processWithIdempotency('req-1', () => counter++);
    expect(result.processed).toBe(true);
    expect(counter).toBe(1);
  });

  it('deve ignorar requisição duplicada', () => {
    let counter = 0;
    processWithIdempotency('req-1', () => counter++);
    const result = processWithIdempotency('req-1', () => counter++);
    expect(result.processed).toBe(false);
    expect(result.reason).toBe('duplicate');
    expect(counter).toBe(1);
  });
});

describe('Logging de Auditoria', () => {
  const auditLogs: Array<{ action: string; entityType: string; entityId: string | null; details: object }> = [];

  const logAction = (action: string, entityType: string, entityId: string | null, details: object) => {
    auditLogs.push({ action, entityType, entityId, details });
    return auditLogs.length;
  };

  beforeEach(() => {
    auditLogs.length = 0;
  });

  it('deve registrar aprovação automática de saque', () => {
    logAction('withdrawal_auto_approved', 'withdrawal', 'wd-123', { amount: 500 });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('withdrawal_auto_approved');
    expect(auditLogs[0].entityType).toBe('withdrawal');
  });

  it('deve registrar aprovação automática de conta bancária', () => {
    logAction('bank_account_auto_approved', 'bank_account', 'ba-123', { bank_name: 'Banco X' });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('bank_account_auto_approved');
  });

  it('deve registrar alteração de modo de manutenção', () => {
    logAction('maintenance_mode_changed', 'system_settings', null, { enabled: true });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].details).toEqual({ enabled: true });
  });

  it('deve registrar alteração de configurações', () => {
    logAction('settings_updated', 'system_settings', null, {
      auto_approve_withdrawals: true,
      enable_email_notifications: true
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('settings_updated');
  });
});
