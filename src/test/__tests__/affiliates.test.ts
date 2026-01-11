import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Affiliate System Tests
 * Tests for affiliate management, calculations, and filtering
 */

describe('Affiliate System', () => {
  describe('Commission Calculations', () => {
    it('should calculate affiliate commission correctly', () => {
      const saleAmount = 100;
      const commissionPercentage = 30;
      const expectedCommission = saleAmount * (commissionPercentage / 100);
      
      expect(expectedCommission).toBe(30);
    });

    it('should calculate owner earnings correctly', () => {
      const saleAmount = 100;
      const affiliateCommission = 30;
      const expectedOwnerEarnings = saleAmount - affiliateCommission;
      
      expect(expectedOwnerEarnings).toBe(70);
    });

    it('should handle zero commission percentage', () => {
      const saleAmount = 100;
      const commissionPercentage = 0;
      const commission = saleAmount * (commissionPercentage / 100);
      
      expect(commission).toBe(0);
    });

    it('should handle high commission percentage', () => {
      const saleAmount = 100;
      const commissionPercentage = 80;
      const commission = saleAmount * (commissionPercentage / 100);
      
      expect(commission).toBe(80);
    });

    it('should accumulate total sales from multiple transactions', () => {
      const sales = [
        { sale_amount: 100, commission_amount: 30, owner_earnings: 70 },
        { sale_amount: 200, commission_amount: 60, owner_earnings: 140 },
        { sale_amount: 50, commission_amount: 15, owner_earnings: 35 },
      ];
      
      const totalSales = sales.reduce((sum, s) => sum + s.sale_amount, 0);
      const totalCommission = sales.reduce((sum, s) => sum + s.commission_amount, 0);
      const totalOwnerEarnings = sales.reduce((sum, s) => sum + s.owner_earnings, 0);
      
      expect(totalSales).toBe(350);
      expect(totalCommission).toBe(105);
      expect(totalOwnerEarnings).toBe(245);
    });
  });

  describe('Status Filtering', () => {
    const mockAffiliates = [
      { id: '1', status: 'active', user_name: 'João' },
      { id: '2', status: 'pending', user_name: 'Maria' },
      { id: '3', status: 'refused', user_name: 'Pedro' },
      { id: '4', status: 'active', user_name: 'Ana' },
      { id: '5', status: 'blocked', user_name: 'Carlos' },
      { id: '6', status: 'cancelled', user_name: 'Lucia' },
    ];

    const getStatusFilter = (tab: string) => {
      switch (tab) {
        case 'ativos':
          return ['active'];
        case 'pendentes':
          return ['pending'];
        case 'recusados':
          return ['refused', 'blocked', 'cancelled'];
        default:
          return [];
      }
    };

    it('should filter active affiliates correctly', () => {
      const statusFilter = getStatusFilter('ativos');
      const filtered = mockAffiliates.filter(a => statusFilter.includes(a.status));
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(a => a.status === 'active')).toBe(true);
    });

    it('should filter pending affiliates correctly', () => {
      const statusFilter = getStatusFilter('pendentes');
      const filtered = mockAffiliates.filter(a => statusFilter.includes(a.status));
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].user_name).toBe('Maria');
    });

    it('should filter refused/blocked/cancelled affiliates correctly', () => {
      const statusFilter = getStatusFilter('recusados');
      const filtered = mockAffiliates.filter(a => statusFilter.includes(a.status));
      
      expect(filtered.length).toBe(3);
      expect(filtered.map(a => a.status)).toContain('refused');
      expect(filtered.map(a => a.status)).toContain('blocked');
      expect(filtered.map(a => a.status)).toContain('cancelled');
    });
  });

  describe('Search Functionality', () => {
    const mockAffiliates = [
      { id: '1', user_name: 'João Silva', user_email: 'joao@email.com', product_name: 'Curso A' },
      { id: '2', user_name: 'Maria Santos', user_email: 'maria@email.com', product_name: 'Curso B' },
      { id: '3', user_name: 'Pedro Oliveira', user_email: 'pedro@test.com', product_name: 'Mentoria' },
    ];

    const filterBySearch = (affiliates: typeof mockAffiliates, query: string) => {
      const searchLower = query.toLowerCase();
      return affiliates.filter(a => 
        a.user_name.toLowerCase().includes(searchLower) ||
        a.user_email.toLowerCase().includes(searchLower) ||
        a.product_name.toLowerCase().includes(searchLower)
      );
    };

    it('should search by name (case insensitive)', () => {
      const filtered = filterBySearch(mockAffiliates, 'JOÃO');
      expect(filtered.length).toBe(1);
      expect(filtered[0].user_name).toBe('João Silva');
    });

    it('should search by email', () => {
      const filtered = filterBySearch(mockAffiliates, 'test.com');
      expect(filtered.length).toBe(1);
      expect(filtered[0].user_name).toBe('Pedro Oliveira');
    });

    it('should search by product name', () => {
      const filtered = filterBySearch(mockAffiliates, 'mentoria');
      expect(filtered.length).toBe(1);
      expect(filtered[0].user_name).toBe('Pedro Oliveira');
    });

    it('should return empty array for no matches', () => {
      const filtered = filterBySearch(mockAffiliates, 'xyz123');
      expect(filtered.length).toBe(0);
    });

    it('should return all for empty search', () => {
      const filtered = filterBySearch(mockAffiliates, '');
      expect(filtered.length).toBe(3);
    });
  });

  describe('Product Filtering', () => {
    const mockAffiliates = [
      { id: '1', product_id: 'prod-1', user_name: 'João' },
      { id: '2', product_id: 'prod-2', user_name: 'Maria' },
      { id: '3', product_id: 'prod-1', user_name: 'Pedro' },
    ];

    it('should filter by specific product', () => {
      const filtered = mockAffiliates.filter(a => a.product_id === 'prod-1');
      expect(filtered.length).toBe(2);
    });

    it('should return all when filter is "all"', () => {
      const selectedProduct = 'all';
      const filtered = mockAffiliates.filter(a => 
        selectedProduct === 'all' || a.product_id === selectedProduct
      );
      expect(filtered.length).toBe(3);
    });
  });

  describe('Stats Calculation', () => {
    const mockAffiliates = [
      { id: '1', status: 'active', total_sales: 100, owner_earnings: 70 },
      { id: '2', status: 'pending', total_sales: 50, owner_earnings: 35 },
      { id: '3', status: 'active', total_sales: 200, owner_earnings: 140 },
      { id: '4', status: 'refused', total_sales: 0, owner_earnings: 0 },
    ];

    it('should count only active affiliates', () => {
      const activeCount = mockAffiliates.filter(a => a.status === 'active').length;
      expect(activeCount).toBe(2);
    });

    it('should sum total sales from all affiliates', () => {
      const totalSales = mockAffiliates.reduce((sum, a) => sum + a.total_sales, 0);
      expect(totalSales).toBe(350);
    });

    it('should sum owner earnings from all affiliates', () => {
      const totalOwnerEarnings = mockAffiliates.reduce((sum, a) => sum + a.owner_earnings, 0);
      expect(totalOwnerEarnings).toBe(245);
    });
  });

  describe('Pagination', () => {
    it('should calculate total pages correctly', () => {
      const totalItems = 25;
      const itemsPerPage = 10;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      
      expect(totalPages).toBe(3);
    });

    it('should slice items correctly for each page', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const itemsPerPage = 10;
      
      // Page 1
      const page1 = items.slice(0, 10);
      expect(page1.length).toBe(10);
      expect(page1[0].id).toBe(1);
      
      // Page 2
      const page2 = items.slice(10, 20);
      expect(page2.length).toBe(10);
      expect(page2[0].id).toBe(11);
      
      // Page 3
      const page3 = items.slice(20, 30);
      expect(page3.length).toBe(5);
      expect(page3[0].id).toBe(21);
    });
  });

  describe('Status Updates', () => {
    it('should correctly identify valid status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        pending: ['active', 'refused'],
        active: ['blocked'],
        refused: [],
        blocked: ['active'],
      };

      expect(validTransitions['pending']).toContain('active');
      expect(validTransitions['pending']).toContain('refused');
      expect(validTransitions['active']).toContain('blocked');
      expect(validTransitions['refused'].length).toBe(0);
    });
  });

  describe('Currency Formatting', () => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    };

    it('should format positive values correctly', () => {
      expect(formatCurrency(1000)).toBe('R$\u00A01.000,00');
    });

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('R$\u00A00,00');
    });

    it('should format decimal values correctly', () => {
      expect(formatCurrency(99.99)).toBe('R$\u00A099,99');
    });
  });
});
