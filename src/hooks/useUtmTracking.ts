/**
 * Hook para captura e persistência de UTMs
 * 
 * Captura UTMs da URL, cookies e localStorage
 * Persiste durante toda a jornada do usuário até o pagamento
 */

import { useState, useEffect, useCallback } from 'react';

export interface UtmParameters {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  src: string | null;
  sck: string | null;
}

const UTM_STORAGE_KEY = 'royalpay_utm_params';
const UTM_COOKIE_NAME = 'royalpay_utm';
const UTM_EXPIRY_DAYS = 30;

// Lista de parâmetros UTM para capturar
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'] as const;

/**
 * Parseia os parâmetros UTM da URL atual
 */
function parseUtmsFromUrl(): Partial<UtmParameters> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const utms: Partial<UtmParameters> = {};
  
  UTM_PARAMS.forEach(param => {
    const value = params.get(param);
    if (value) {
      utms[param] = decodeURIComponent(value);
    }
  });
  
  return utms;
}

/**
 * Lê cookie pelo nome
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

/**
 * Define um cookie com expiração
 */
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Lê UTMs do localStorage
 */
function getUtmsFromStorage(): Partial<UtmParameters> {
  if (typeof localStorage === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[UTM] Erro ao ler do localStorage:', error);
  }
  
  return {};
}

/**
 * Salva UTMs no localStorage
 */
function saveUtmsToStorage(utms: UtmParameters): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utms));
  } catch (error) {
    console.warn('[UTM] Erro ao salvar no localStorage:', error);
  }
}

/**
 * Lê UTMs do cookie
 */
function getUtmsFromCookie(): Partial<UtmParameters> {
  const cookie = getCookie(UTM_COOKIE_NAME);
  if (!cookie) return {};
  
  try {
    return JSON.parse(cookie);
  } catch {
    return {};
  }
}

/**
 * Salva UTMs no cookie
 */
function saveUtmsToCookie(utms: UtmParameters): void {
  try {
    setCookie(UTM_COOKIE_NAME, JSON.stringify(utms), UTM_EXPIRY_DAYS);
  } catch (error) {
    console.warn('[UTM] Erro ao salvar no cookie:', error);
  }
}

/**
 * Mescla UTMs priorizando valores não-nulos mais recentes
 */
function mergeUtms(...sources: Partial<UtmParameters>[]): UtmParameters {
  const result: UtmParameters = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    src: null,
    sck: null,
  };
  
  // Prioridade: URL > Cookie > LocalStorage
  for (const source of sources) {
    UTM_PARAMS.forEach(param => {
      if (source[param]) {
        result[param] = source[param] as string;
      }
    });
  }
  
  return result;
}

/**
 * Hook principal para gerenciamento de UTMs
 */
export function useUtmTracking() {
  const [utms, setUtms] = useState<UtmParameters>({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    src: null,
    sck: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializa UTMs na montagem
  useEffect(() => {
    // Ordem de prioridade: localStorage < cookie < URL
    const fromStorage = getUtmsFromStorage();
    const fromCookie = getUtmsFromCookie();
    const fromUrl = parseUtmsFromUrl();
    
    const merged = mergeUtms(fromStorage, fromCookie, fromUrl);
    
    // Verifica se há alguma UTM válida
    const hasAnyUtm = UTM_PARAMS.some(param => merged[param] !== null);
    
    if (hasAnyUtm) {
      // Persiste nos dois lugares
      saveUtmsToStorage(merged);
      saveUtmsToCookie(merged);
      
      console.log('[UTM] UTMs capturadas:', merged);
    }
    
    setUtms(merged);
    setIsInitialized(true);
  }, []);

  /**
   * Atualiza UTMs (útil para SPA ao navegar)
   */
  const refreshUtms = useCallback(() => {
    const fromUrl = parseUtmsFromUrl();
    const hasNewUtms = UTM_PARAMS.some(param => fromUrl[param]);
    
    if (hasNewUtms) {
      setUtms(prev => {
        const merged = mergeUtms(prev, fromUrl);
        saveUtmsToStorage(merged);
        saveUtmsToCookie(merged);
        return merged;
      });
    }
  }, []);

  /**
   * Limpa UTMs após conversão
   */
  const clearUtms = useCallback(() => {
    const emptyUtms: UtmParameters = {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      src: null,
      sck: null,
    };
    
    setUtms(emptyUtms);
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(UTM_STORAGE_KEY);
    }
    
    // Remove cookie setando expiração no passado
    if (typeof document !== 'undefined') {
      document.cookie = `${UTM_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
    
    console.log('[UTM] UTMs limpas após conversão');
  }, []);

  /**
   * Retorna UTMs em formato para envio ao backend
   */
  const getUtmsForCheckout = useCallback((): UtmParameters => {
    return { ...utms };
  }, [utms]);

  /**
   * Verifica se há alguma UTM válida
   */
  const hasUtms = useCallback((): boolean => {
    return UTM_PARAMS.some(param => utms[param] !== null);
  }, [utms]);

  return {
    utms,
    isInitialized,
    refreshUtms,
    clearUtms,
    getUtmsForCheckout,
    hasUtms,
  };
}

/**
 * Função utilitária para obter UTMs sem hook (para uso em funções puras)
 */
export function getStoredUtms(): UtmParameters {
  const fromStorage = getUtmsFromStorage();
  const fromCookie = getUtmsFromCookie();
  
  return mergeUtms(fromStorage, fromCookie);
}

export default useUtmTracking;
