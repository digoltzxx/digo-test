import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('OTP Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OTP Code Generation', () => {
    it('should generate 6-digit numeric codes', () => {
      // Simulate the OTP generation logic
      const generateOtpCode = (): string => {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return String(array[0] % 1000000).padStart(6, "0");
      };

      const code = generateOtpCode();
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should generate unique codes', () => {
      const generateOtpCode = (): string => {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return String(array[0] % 1000000).padStart(6, "0");
      };

      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateOtpCode());
      }
      
      // Most codes should be unique (allowing some collisions due to randomness)
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('OTP Hashing', () => {
    it('should hash OTP codes consistently', async () => {
      const hashCode = async (code: string): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      };

      const code = "123456";
      const hash1 = await hashCode(code);
      const hash2 = await hashCode(code);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different codes', async () => {
      const hashCode = async (code: string): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      };

      const hash1 = await hashCode("123456");
      const hash2 = await hashCode("654321");
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits correctly', () => {
      const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

      const checkRateLimit = (email: string): { allowed: boolean; remainingAttempts: number } => {
        const now = Date.now();
        const key = email.toLowerCase();
        const limit = rateLimitMap.get(key);
        
        if (!limit || now > limit.resetAt) {
          rateLimitMap.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
          return { allowed: true, remainingAttempts: 2 };
        }
        
        if (limit.count >= 3) {
          return { allowed: false, remainingAttempts: 0 };
        }
        
        limit.count++;
        return { allowed: true, remainingAttempts: 3 - limit.count };
      };

      const email = "test@example.com";
      
      // First 3 attempts should be allowed
      expect(checkRateLimit(email).allowed).toBe(true);
      expect(checkRateLimit(email).allowed).toBe(true);
      expect(checkRateLimit(email).allowed).toBe(true);
      
      // 4th attempt should be blocked
      expect(checkRateLimit(email).allowed).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', () => {
      const validateEmail = (email: string): boolean => {
        return email && email.includes("@");
      };

      expect(validateEmail("valid@email.com")).toBe(true);
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("")).toBe(false);
    });

    it('should validate OTP code format', () => {
      const validateCode = (code: string): boolean => {
        return /^\d{6}$/.test(code);
      };

      expect(validateCode("123456")).toBe(true);
      expect(validateCode("12345")).toBe(false);
      expect(validateCode("1234567")).toBe(false);
      expect(validateCode("abcdef")).toBe(false);
      expect(validateCode("12345a")).toBe(false);
    });
  });

  describe('Expiration Handling', () => {
    it('should correctly identify expired OTPs', () => {
      const isExpired = (expiresAt: Date): boolean => {
        return new Date() > expiresAt;
      };

      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      const pastDate = new Date(Date.now() - 1000);

      expect(isExpired(futureDate)).toBe(false);
      expect(isExpired(pastDate)).toBe(true);
    });

    it('should format remaining time correctly', () => {
      const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      };

      expect(formatTime(300)).toBe("5:00");
      expect(formatTime(65)).toBe("1:05");
      expect(formatTime(30)).toBe("0:30");
      expect(formatTime(0)).toBe("0:00");
    });
  });

  describe('Security Masking', () => {
    it('should mask email addresses in logs', () => {
      const maskEmail = (email: string): string => {
        if (!email) return "none";
        const parts = email.split("@");
        if (parts.length !== 2) return "invalid";
        return `${parts[0].substring(0, 3)}***@${parts[1]}`;
      };

      expect(maskEmail("johndoe@example.com")).toBe("joh***@example.com");
      expect(maskEmail("ab@test.com")).toBe("ab***@test.com");
      expect(maskEmail("")).toBe("none");
    });
  });
});
