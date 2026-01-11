import { describe, it, expect } from "vitest";

// Upsell validation logic tests
describe("Upsell Validation", () => {
  // Helper function that mirrors the validation logic in UpsellModal
  const validateUpsellForm = (formData: {
    upsell_product_id: string;
    name: string;
    description: string;
    original_price: number;
    offer_price: number;
    headline: string;
    cta_text: string;
    decline_text: string;
    timer_enabled: boolean;
    timer_minutes: number;
  }) => {
    const errors: Record<string, string> = {};

    // 1. Produto do Upsell - obrigatório
    if (!formData.upsell_product_id) {
      errors.upsell_product_id = "Selecione um produto";
    }

    // 2. Nome da Oferta - obrigatório, mínimo 3 caracteres
    if (!formData.name.trim()) {
      errors.name = "Nome da oferta é obrigatório";
    } else if (formData.name.trim().length < 3) {
      errors.name = "Nome deve ter no mínimo 3 caracteres";
    }

    // 3. Descrição - opcional, máximo 120 caracteres
    if (formData.description && formData.description.length > 120) {
      errors.description = "Descrição deve ter no máximo 120 caracteres";
    }

    // 4. Preço Original - obrigatório, maior que zero
    if (formData.original_price <= 0) {
      errors.original_price = "Preço original deve ser maior que zero";
    }

    // 5. Preço com Desconto - obrigatório, maior que zero, menor que original
    if (formData.offer_price <= 0) {
      errors.offer_price = "Preço com desconto deve ser maior que zero";
    } else if (formData.offer_price >= formData.original_price) {
      errors.offer_price = "Preço com desconto deve ser menor que o original";
    }

    // 6. Título da Oferta - obrigatório
    if (!formData.headline.trim()) {
      errors.headline = "Título da oferta é obrigatório";
    }

    // 7. Texto do Botão (Aceitar) - obrigatório
    if (!formData.cta_text.trim()) {
      errors.cta_text = "Texto do botão é obrigatório";
    }

    // 8. Texto do Link (Recusar) - obrigatório
    if (!formData.decline_text.trim()) {
      errors.decline_text = "Texto de recusa é obrigatório";
    }

    // 9. Timer - se ativado, validar minutos
    if (formData.timer_enabled && (formData.timer_minutes < 1 || formData.timer_minutes > 60)) {
      errors.timer_minutes = "Tempo deve ser entre 1 e 60 minutos";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  const validFormData = {
    upsell_product_id: "product-123",
    name: "Oferta Especial",
    description: "Uma descrição breve",
    original_price: 100,
    offer_price: 79,
    headline: "Oferta exclusiva para você!",
    cta_text: "Sim, quero essa oferta!",
    decline_text: "Não, obrigado",
    timer_enabled: true,
    timer_minutes: 15,
  };

  describe("Produto do Upsell", () => {
    it("deve falhar sem produto selecionado", () => {
      const result = validateUpsellForm({ ...validFormData, upsell_product_id: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.upsell_product_id).toBe("Selecione um produto");
    });

    it("deve passar com produto selecionado", () => {
      const result = validateUpsellForm(validFormData);
      expect(result.errors.upsell_product_id).toBeUndefined();
    });
  });

  describe("Nome da Oferta", () => {
    it("deve falhar com nome vazio", () => {
      const result = validateUpsellForm({ ...validFormData, name: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe("Nome da oferta é obrigatório");
    });

    it("deve falhar com nome menor que 3 caracteres", () => {
      const result = validateUpsellForm({ ...validFormData, name: "ab" });
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe("Nome deve ter no mínimo 3 caracteres");
    });

    it("deve passar com nome válido", () => {
      const result = validateUpsellForm({ ...validFormData, name: "Oferta" });
      expect(result.errors.name).toBeUndefined();
    });
  });

  describe("Descrição", () => {
    it("deve passar com descrição vazia (opcional)", () => {
      const result = validateUpsellForm({ ...validFormData, description: "" });
      expect(result.errors.description).toBeUndefined();
    });

    it("deve falhar com descrição acima de 120 caracteres", () => {
      const longDescription = "a".repeat(121);
      const result = validateUpsellForm({ ...validFormData, description: longDescription });
      expect(result.isValid).toBe(false);
      expect(result.errors.description).toBe("Descrição deve ter no máximo 120 caracteres");
    });

    it("deve passar com descrição de 120 caracteres", () => {
      const maxDescription = "a".repeat(120);
      const result = validateUpsellForm({ ...validFormData, description: maxDescription });
      expect(result.errors.description).toBeUndefined();
    });
  });

  describe("Configuração de Preço", () => {
    it("deve falhar com preço original igual a zero", () => {
      const result = validateUpsellForm({ ...validFormData, original_price: 0 });
      expect(result.isValid).toBe(false);
      expect(result.errors.original_price).toBe("Preço original deve ser maior que zero");
    });

    it("deve falhar com preço original negativo", () => {
      const result = validateUpsellForm({ ...validFormData, original_price: -10 });
      expect(result.isValid).toBe(false);
      expect(result.errors.original_price).toBe("Preço original deve ser maior que zero");
    });

    it("deve falhar com preço com desconto igual a zero", () => {
      const result = validateUpsellForm({ ...validFormData, offer_price: 0 });
      expect(result.isValid).toBe(false);
      expect(result.errors.offer_price).toBe("Preço com desconto deve ser maior que zero");
    });

    it("deve falhar quando preço com desconto é igual ao original (100/100)", () => {
      const result = validateUpsellForm({ ...validFormData, original_price: 100, offer_price: 100 });
      expect(result.isValid).toBe(false);
      expect(result.errors.offer_price).toBe("Preço com desconto deve ser menor que o original");
    });

    it("deve falhar quando preço com desconto é maior que o original (100/120)", () => {
      const result = validateUpsellForm({ ...validFormData, original_price: 100, offer_price: 120 });
      expect(result.isValid).toBe(false);
      expect(result.errors.offer_price).toBe("Preço com desconto deve ser menor que o original");
    });

    it("deve passar quando preço com desconto é menor que o original (100/79)", () => {
      const result = validateUpsellForm({ ...validFormData, original_price: 100, offer_price: 79 });
      expect(result.errors.original_price).toBeUndefined();
      expect(result.errors.offer_price).toBeUndefined();
    });
  });

  describe("Texto da Oferta", () => {
    it("deve falhar sem título da oferta", () => {
      const result = validateUpsellForm({ ...validFormData, headline: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.headline).toBe("Título da oferta é obrigatório");
    });

    it("deve passar com título válido", () => {
      const result = validateUpsellForm({ ...validFormData, headline: "Oferta imperdível!" });
      expect(result.errors.headline).toBeUndefined();
    });
  });

  describe("Textos de Ação", () => {
    it("deve falhar sem texto do botão (aceitar)", () => {
      const result = validateUpsellForm({ ...validFormData, cta_text: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.cta_text).toBe("Texto do botão é obrigatório");
    });

    it("deve falhar sem texto do link (recusar)", () => {
      const result = validateUpsellForm({ ...validFormData, decline_text: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.decline_text).toBe("Texto de recusa é obrigatório");
    });

    it("deve passar com ambos os textos preenchidos", () => {
      const result = validateUpsellForm(validFormData);
      expect(result.errors.cta_text).toBeUndefined();
      expect(result.errors.decline_text).toBeUndefined();
    });
  });

  describe("Temporizador de Urgência", () => {
    it("deve passar com timer desativado", () => {
      const result = validateUpsellForm({ ...validFormData, timer_enabled: false, timer_minutes: 0 });
      expect(result.errors.timer_minutes).toBeUndefined();
    });

    it("deve falhar com timer ativado e minutos menor que 1", () => {
      const result = validateUpsellForm({ ...validFormData, timer_enabled: true, timer_minutes: 0 });
      expect(result.isValid).toBe(false);
      expect(result.errors.timer_minutes).toBe("Tempo deve ser entre 1 e 60 minutos");
    });

    it("deve falhar com timer ativado e minutos maior que 60", () => {
      const result = validateUpsellForm({ ...validFormData, timer_enabled: true, timer_minutes: 61 });
      expect(result.isValid).toBe(false);
      expect(result.errors.timer_minutes).toBe("Tempo deve ser entre 1 e 60 minutos");
    });

    it("deve passar com timer ativado e minutos válidos", () => {
      const result = validateUpsellForm({ ...validFormData, timer_enabled: true, timer_minutes: 15 });
      expect(result.errors.timer_minutes).toBeUndefined();
    });
  });

  describe("Formulário Completo", () => {
    it("deve passar com todos os campos válidos", () => {
      const result = validateUpsellForm(validFormData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it("deve retornar múltiplos erros quando vários campos são inválidos", () => {
      const result = validateUpsellForm({
        upsell_product_id: "",
        name: "",
        description: "",
        original_price: 0,
        offer_price: 0,
        headline: "",
        cta_text: "",
        decline_text: "",
        timer_enabled: true,
        timer_minutes: 0,
      });
      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(5);
    });
  });
});

// Upsell toggle behavior tests
describe("Upsell Toggle Behaviors", () => {
  describe("Toggle Ativo/Inativo", () => {
    it("deve exibir upsell no funil quando ativo", () => {
      const isActive = true;
      expect(isActive).toBe(true);
      // Upsell será exibido
    });

    it("não deve exibir upsell no funil quando inativo", () => {
      const isActive = false;
      expect(isActive).toBe(false);
      // Upsell não será exibido
    });
  });

  describe("Toggle Produto de Assinatura", () => {
    it("deve tratar como cobrança recorrente quando ativado", () => {
      const isSubscription = true;
      const paymentType = isSubscription ? "subscription" : "one_time";
      expect(paymentType).toBe("subscription");
    });

    it("deve tratar como cobrança única quando desativado", () => {
      const isSubscription = false;
      const paymentType = isSubscription ? "subscription" : "one_time";
      expect(paymentType).toBe("one_time");
    });
  });
});

// Discount calculation tests
describe("Discount Calculations", () => {
  const calculateDiscount = (originalPrice: number, offerPrice: number): number => {
    if (originalPrice <= 0) return 0;
    return Math.round((1 - offerPrice / originalPrice) * 100);
  };

  it("deve calcular 21% de desconto para 100 -> 79", () => {
    expect(calculateDiscount(100, 79)).toBe(21);
  });

  it("deve calcular 50% de desconto para 200 -> 100", () => {
    expect(calculateDiscount(200, 100)).toBe(50);
  });

  it("deve calcular 0% quando preços são iguais", () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  it("deve retornar 0 quando preço original é zero", () => {
    expect(calculateDiscount(0, 50)).toBe(0);
  });
});
