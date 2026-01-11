import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  IntegrationCheckResult, 
  IntegrationStatus, 
  IntegrationLog,
  INTEGRATION_CONFIGS 
} from '@/lib/integrations/types';

interface IntegrationCredentials {
  [key: string]: string | undefined;
}

interface ValidationState {
  results: IntegrationCheckResult[];
  isValidating: boolean;
  lastValidation: string | null;
  summary: {
    active: number;
    inactive: number;
    error: number;
  };
}

export const useIntegrationValidation = () => {
  const [state, setState] = useState<ValidationState>({
    results: [],
    isValidating: false,
    lastValidation: null,
    summary: { active: 0, inactive: 0, error: 0 }
  });

  const addLog = (
    logs: IntegrationLog[],
    integration: string,
    status: IntegrationStatus,
    level: 'INFO' | 'WARNING' | 'ERROR',
    message: string,
    details?: Record<string, unknown>
  ): IntegrationLog[] => {
    return [...logs, {
      integration,
      status,
      level,
      message,
      timestamp: new Date().toISOString(),
      details
    }];
  };

  const validateIntegration = useCallback(async (
    integrationId: string,
    credentials: IntegrationCredentials
  ): Promise<IntegrationCheckResult> => {
    const config = INTEGRATION_CONFIGS.find(c => c.id === integrationId);
    if (!config) {
      return {
        id: integrationId,
        name: integrationId,
        status: 'error',
        lastValidated: new Date().toISOString(),
        checks: {
          detection: { success: false, message: 'Configuração não encontrada' },
          validation: { success: false, message: 'Não validado' },
          activation: { success: false, message: 'Não ativado' }
        },
        logs: []
      };
    }

    let logs: IntegrationLog[] = [];
    let status: IntegrationStatus = 'inactive';

    // Step 1: Detection
    const missingCredentials = config.requiredCredentials.filter(
      cred => !credentials[cred] || credentials[cred]?.trim() === ''
    );

    const detectionResult = {
      success: missingCredentials.length === 0,
      message: missingCredentials.length === 0 
        ? 'Todas as credenciais detectadas'
        : `Credenciais ausentes: ${missingCredentials.join(', ')}`,
      details: { 
        required: config.requiredCredentials,
        missing: missingCredentials
      }
    };

    logs = addLog(
      logs, 
      config.name, 
      missingCredentials.length === 0 ? 'validating' : 'inactive',
      missingCredentials.length === 0 ? 'INFO' : 'WARNING',
      detectionResult.message
    );

    if (!detectionResult.success) {
      return {
        id: integrationId,
        name: config.name,
        status: 'inactive',
        lastValidated: new Date().toISOString(),
        checks: {
          detection: detectionResult,
          validation: { success: false, message: 'Pulado - credenciais ausentes' },
          activation: { success: false, message: 'Não ativado' }
        },
        logs
      };
    }

    // Step 2: Validation (call edge function)
    let validationResult = { success: false, message: 'Validação não executada' };
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-integration', {
        body: {
          integration: integrationId,
          credentials: Object.fromEntries(
            config.requiredCredentials.map(key => [key, credentials[key]])
          )
        }
      });

      if (error) {
        validationResult = { 
          success: false, 
          message: `Erro na validação: ${error.message}`
        };
        logs = addLog(logs, config.name, 'error', 'ERROR', validationResult.message);
        status = 'error';
      } else if (data?.success) {
        validationResult = { 
          success: true, 
          message: data.message || 'Validação bem-sucedida'
        };
        logs = addLog(logs, config.name, 'active', 'INFO', validationResult.message);
        status = 'active';
      } else {
        validationResult = { 
          success: false, 
          message: data?.message || 'Validação falhou'
        };
        logs = addLog(logs, config.name, 'error', 'ERROR', validationResult.message);
        status = 'error';
      }
    } catch (err) {
      validationResult = { 
        success: false, 
        message: `Erro de conexão: ${err instanceof Error ? err.message : 'Desconhecido'}`
      };
      logs = addLog(logs, config.name, 'error', 'ERROR', validationResult.message);
      status = 'error';
    }

    // Step 3: Activation
    const activationResult = validationResult.success
      ? { success: true, message: 'Integração ativada com sucesso' }
      : { success: false, message: 'Integração não ativada devido a falha na validação' };

    if (activationResult.success) {
      logs = addLog(logs, config.name, 'active', 'INFO', 'Integração pronta para uso em produção');
    }

    return {
      id: integrationId,
      name: config.name,
      status,
      lastValidated: new Date().toISOString(),
      checks: {
        detection: detectionResult,
        validation: validationResult,
        activation: activationResult
      },
      logs
    };
  }, []);

  const validateAll = useCallback(async (credentials: IntegrationCredentials) => {
    setState(prev => ({ ...prev, isValidating: true }));

    const results: IntegrationCheckResult[] = [];
    
    for (const config of INTEGRATION_CONFIGS) {
      const result = await validateIntegration(config.id, credentials);
      results.push(result);
    }

    const summary = {
      active: results.filter(r => r.status === 'active').length,
      inactive: results.filter(r => r.status === 'inactive').length,
      error: results.filter(r => r.status === 'error').length
    };

    setState({
      results,
      isValidating: false,
      lastValidation: new Date().toISOString(),
      summary
    });

    return { results, summary };
  }, [validateIntegration]);

  const validateSingle = useCallback(async (
    integrationId: string, 
    credentials: IntegrationCredentials
  ) => {
    setState(prev => ({ ...prev, isValidating: true }));

    const result = await validateIntegration(integrationId, credentials);

    setState(prev => {
      const existingIndex = prev.results.findIndex(r => r.id === integrationId);
      const newResults = existingIndex >= 0
        ? [...prev.results.slice(0, existingIndex), result, ...prev.results.slice(existingIndex + 1)]
        : [...prev.results, result];

      const summary = {
        active: newResults.filter(r => r.status === 'active').length,
        inactive: newResults.filter(r => r.status === 'inactive').length,
        error: newResults.filter(r => r.status === 'error').length
      };

      return {
        results: newResults,
        isValidating: false,
        lastValidation: new Date().toISOString(),
        summary
      };
    });

    return result;
  }, [validateIntegration]);

  return {
    ...state,
    validateAll,
    validateSingle,
    validateIntegration
  };
};
