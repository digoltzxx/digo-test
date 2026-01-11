import { describe, it, expect } from 'vitest';

// =============================================
// TESTES DO ANALYTICS DO FUNIL PÓS-COMPRA
// =============================================

describe('Funnel Analytics - Cálculos de Taxas', () => {
  // Função que simula o cálculo de taxa de upsell
  const calculateUpsellRate = (accepted: number, viewed: number): number => {
    if (viewed === 0) return 0;
    return Number(((accepted / viewed) * 100).toFixed(2));
  };

  // Função que simula o cálculo de taxa de downsell
  const calculateDownsellRate = (accepted: number, viewed: number): number => {
    if (viewed === 0) return 0;
    return Number(((accepted / viewed) * 100).toFixed(2));
  };

  it('deve calcular taxa de upsell corretamente', () => {
    expect(calculateUpsellRate(5, 10)).toBe(50);
    expect(calculateUpsellRate(1, 3)).toBe(33.33);
    expect(calculateUpsellRate(7, 20)).toBe(35);
  });

  it('deve retornar 0% quando não há visualizações', () => {
    expect(calculateUpsellRate(0, 0)).toBe(0);
    expect(calculateDownsellRate(0, 0)).toBe(0);
  });

  it('deve retornar 100% quando todas as visualizações convertem', () => {
    expect(calculateUpsellRate(10, 10)).toBe(100);
    expect(calculateDownsellRate(5, 5)).toBe(100);
  });

  it('deve arredondar para 2 casas decimais', () => {
    // 1/3 = 33.333...%
    expect(calculateUpsellRate(1, 3)).toBe(33.33);
    // 2/7 = 28.571...%
    expect(calculateDownsellRate(2, 7)).toBe(28.57);
  });

  it('deve lidar com divisão por zero graciosamente', () => {
    expect(calculateUpsellRate(5, 0)).toBe(0);
    expect(calculateDownsellRate(10, 0)).toBe(0);
  });
});

describe('Funnel Analytics - Cálculo de Receita', () => {
  interface FunnelOrder {
    order_type: 'upsell' | 'downsell';
    amount: number;
    net_amount: number;
    status: string;
  }

  const calculateRevenue = (orders: FunnelOrder[], type: 'upsell' | 'downsell'): number => {
    return orders
      .filter(o => o.order_type === type && o.status === 'approved')
      .reduce((sum, o) => sum + (o.net_amount || o.amount || 0), 0);
  };

  const calculateTotalRevenue = (orders: FunnelOrder[]): number => {
    return calculateRevenue(orders, 'upsell') + calculateRevenue(orders, 'downsell');
  };

  it('deve somar apenas vendas aprovadas', () => {
    const orders: FunnelOrder[] = [
      { order_type: 'upsell', amount: 100, net_amount: 90, status: 'approved' },
      { order_type: 'upsell', amount: 50, net_amount: 45, status: 'pending' },
      { order_type: 'upsell', amount: 200, net_amount: 180, status: 'approved' },
    ];

    expect(calculateRevenue(orders, 'upsell')).toBe(270); // 90 + 180
  });

  it('deve separar receita por tipo corretamente', () => {
    const orders: FunnelOrder[] = [
      { order_type: 'upsell', amount: 100, net_amount: 90, status: 'approved' },
      { order_type: 'downsell', amount: 50, net_amount: 45, status: 'approved' },
      { order_type: 'upsell', amount: 200, net_amount: 180, status: 'approved' },
    ];

    expect(calculateRevenue(orders, 'upsell')).toBe(270);
    expect(calculateRevenue(orders, 'downsell')).toBe(45);
    expect(calculateTotalRevenue(orders)).toBe(315);
  });

  it('deve retornar 0 para lista vazia', () => {
    expect(calculateRevenue([], 'upsell')).toBe(0);
    expect(calculateRevenue([], 'downsell')).toBe(0);
    expect(calculateTotalRevenue([])).toBe(0);
  });

  it('deve ignorar reembolsos e chargebacks', () => {
    const orders: FunnelOrder[] = [
      { order_type: 'upsell', amount: 100, net_amount: 90, status: 'approved' },
      { order_type: 'upsell', amount: 50, net_amount: 45, status: 'refunded' },
      { order_type: 'downsell', amount: 30, net_amount: 27, status: 'chargeback' },
    ];

    expect(calculateTotalRevenue(orders)).toBe(90);
  });

  it('deve usar net_amount quando disponível, senão amount', () => {
    const orders: FunnelOrder[] = [
      { order_type: 'upsell', amount: 100, net_amount: 90, status: 'approved' },
      { order_type: 'upsell', amount: 50, net_amount: 0, status: 'approved' },
    ];

    // Primeiro usa net_amount (90), segundo usa net_amount mesmo sendo 0
    expect(calculateRevenue(orders, 'upsell')).toBe(90);
  });
});

describe('Funnel Analytics - Contagem de Eventos', () => {
  interface FunnelEvent {
    step: 'upsell' | 'downsell';
    action: 'viewed' | 'accepted' | 'declined';
    sale_id: string;
  }

  const countEvents = (events: FunnelEvent[], step: string, action: string): number => {
    return events.filter(e => e.step === step && e.action === action).length;
  };

  // Conta eventos únicos por sale_id
  const countUniqueEvents = (events: FunnelEvent[], step: string, action: string): number => {
    const uniqueSaleIds = new Set(
      events
        .filter(e => e.step === step && e.action === action)
        .map(e => e.sale_id)
    );
    return uniqueSaleIds.size;
  };

  it('deve contar eventos corretamente', () => {
    const events: FunnelEvent[] = [
      { step: 'upsell', action: 'viewed', sale_id: 'sale1' },
      { step: 'upsell', action: 'viewed', sale_id: 'sale2' },
      { step: 'upsell', action: 'accepted', sale_id: 'sale1' },
      { step: 'downsell', action: 'viewed', sale_id: 'sale2' },
      { step: 'downsell', action: 'accepted', sale_id: 'sale2' },
    ];

    expect(countEvents(events, 'upsell', 'viewed')).toBe(2);
    expect(countEvents(events, 'upsell', 'accepted')).toBe(1);
    expect(countEvents(events, 'downsell', 'viewed')).toBe(1);
    expect(countEvents(events, 'downsell', 'accepted')).toBe(1);
  });

  it('não deve contar eventos duplicados por pedido', () => {
    const events: FunnelEvent[] = [
      { step: 'upsell', action: 'viewed', sale_id: 'sale1' },
      { step: 'upsell', action: 'viewed', sale_id: 'sale1' }, // Duplicado
      { step: 'upsell', action: 'viewed', sale_id: 'sale2' },
    ];

    expect(countUniqueEvents(events, 'upsell', 'viewed')).toBe(2);
  });

  it('deve lidar com lista vazia', () => {
    expect(countEvents([], 'upsell', 'viewed')).toBe(0);
    expect(countUniqueEvents([], 'downsell', 'accepted')).toBe(0);
  });
});

describe('Funnel Analytics - Filtro de Período', () => {
  const filterByPeriod = <T extends { created_at: string }>(
    items: T[],
    days: number
  ): T[] => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    return items.filter(item => new Date(item.created_at) >= startDate);
  };

  it('deve filtrar por últimos 7 dias', () => {
    const now = new Date();
    const items = [
      { id: 1, created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() }, // 2 dias atrás
      { id: 2, created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() }, // 10 dias atrás
      { id: 3, created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() }, // 5 dias atrás
    ];

    const filtered = filterByPeriod(items, 7);
    expect(filtered.length).toBe(2);
    expect(filtered.map(i => i.id)).toContain(1);
    expect(filtered.map(i => i.id)).toContain(3);
  });

  it('deve filtrar por últimos 15 dias', () => {
    const now = new Date();
    const items = [
      { id: 1, created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 2, created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 3, created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString() },
    ];

    const filtered = filterByPeriod(items, 15);
    expect(filtered.length).toBe(2);
  });

  it('deve filtrar por últimos 30 dias', () => {
    const now = new Date();
    const items = [
      { id: 1, created_at: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 2, created_at: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString() },
    ];

    const filtered = filterByPeriod(items, 30);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(1);
  });

  it('deve filtrar por últimos 90 dias', () => {
    const now = new Date();
    const items = [
      { id: 1, created_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 2, created_at: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString() },
    ];

    const filtered = filterByPeriod(items, 90);
    expect(filtered.length).toBe(1);
  });
});

describe('Funnel Analytics - Consistência de Dados', () => {
  interface FunnelStats {
    checkoutCompleted: number;
    upsellViewed: number;
    upsellAccepted: number;
    downsellViewed: number;
    downsellAccepted: number;
  }

  // Regra: upsell aceito <= upsell visualizado
  const validateUpsellConsistency = (stats: FunnelStats): boolean => {
    return stats.upsellAccepted <= stats.upsellViewed;
  };

  // Regra: downsell visualizado <= upsell recusado
  const validateDownsellConsistency = (stats: FunnelStats): boolean => {
    const upsellDeclined = stats.upsellViewed - stats.upsellAccepted;
    return stats.downsellViewed <= upsellDeclined;
  };

  // Regra: downsell aceito <= downsell visualizado
  const validateDownsellAcceptedConsistency = (stats: FunnelStats): boolean => {
    return stats.downsellAccepted <= stats.downsellViewed;
  };

  it('deve validar que upsell aceito <= upsell visualizado', () => {
    expect(validateUpsellConsistency({
      checkoutCompleted: 100,
      upsellViewed: 100,
      upsellAccepted: 50,
      downsellViewed: 30,
      downsellAccepted: 10,
    })).toBe(true);

    expect(validateUpsellConsistency({
      checkoutCompleted: 100,
      upsellViewed: 50,
      upsellAccepted: 60, // Inválido
      downsellViewed: 30,
      downsellAccepted: 10,
    })).toBe(false);
  });

  it('deve validar que downsell visualizado <= upsell recusado', () => {
    // 100 visualizaram, 70 aceitaram, 30 recusaram
    // downsell visualizado deve ser <= 30
    expect(validateDownsellConsistency({
      checkoutCompleted: 100,
      upsellViewed: 100,
      upsellAccepted: 70,
      downsellViewed: 30,
      downsellAccepted: 10,
    })).toBe(true);

    expect(validateDownsellConsistency({
      checkoutCompleted: 100,
      upsellViewed: 100,
      upsellAccepted: 70,
      downsellViewed: 40, // Inválido, só 30 recusaram
      downsellAccepted: 10,
    })).toBe(false);
  });

  it('deve validar que downsell aceito <= downsell visualizado', () => {
    expect(validateDownsellAcceptedConsistency({
      checkoutCompleted: 100,
      upsellViewed: 100,
      upsellAccepted: 50,
      downsellViewed: 30,
      downsellAccepted: 20,
    })).toBe(true);

    expect(validateDownsellAcceptedConsistency({
      checkoutCompleted: 100,
      upsellViewed: 100,
      upsellAccepted: 50,
      downsellViewed: 30,
      downsellAccepted: 35, // Inválido
    })).toBe(false);
  });
});

describe('Funnel Analytics - Formatação de Moeda', () => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  it('deve formatar valores corretamente', () => {
    expect(formatCurrency(1000)).toBe('R$ 1.000,00');
    expect(formatCurrency(99.99)).toBe('R$ 99,99');
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('deve formatar valores negativos', () => {
    expect(formatCurrency(-100)).toBe('-R$ 100,00');
  });

  it('deve formatar centavos corretamente', () => {
    expect(formatCurrency(0.01)).toBe('R$ 0,01');
    expect(formatCurrency(0.99)).toBe('R$ 0,99');
  });
});
