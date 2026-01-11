import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Retorna a classe de cor para um valor numérico
 * - Negativo: vermelho
 * - Zero: neutro
 * - Positivo: verde
 */
export function getValueColorClass(value: number): string {
  if (value < 0) return "text-red-500";
  if (value > 0) return "text-green-500";
  return "text-muted-foreground";
}
