import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full opacity-25 blur-[150px]"
          style={{
            background: 'linear-gradient(180deg, hsl(210 100% 55%), hsl(220 90% 50%))'
          }}
        />
      </div>

      <div className="container relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            <span className="gradient-text-blue">Plataforma completa</span> para{" "}
            <br className="hidden md:block" />
            venda de Produtos Digitais
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Alta conversão, recuperação de vendas e segurança antifraude com nossa 
            plataforma. Sem bloqueios, aprovação automática, saque rápido, e as taxas 
            mais baixas do mercado.
          </p>

          {/* CTA Button */}
          <Button 
            size="lg" 
            className="bg-foreground text-background font-semibold px-8 py-6 text-lg rounded-full hover:bg-foreground/90 transition-all duration-300 group shadow-lg shadow-white/10"
            onClick={() => navigate("/cadastro")}
          >
            Comece a vender agora
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-20 relative">
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-blue-500/10">
              {/* Dashboard mockup */}
              <div className="bg-card p-4 md:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg gradient-blue-vibrant" />
                    <span className="text-sm font-semibold">Dashboard</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-secondary/50 rounded-xl p-4 border border-border/30">
                    <p className="text-muted-foreground text-xs mb-1">Saldo disponível</p>
                    <p className="text-xl font-bold">R$ 15.521,90</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 border border-border/30">
                    <p className="text-muted-foreground text-xs mb-1">Vendas hoje</p>
                    <p className="text-xl font-bold">7.450</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 border border-border/30">
                    <p className="text-muted-foreground text-xs mb-1">Faturamento</p>
                    <p className="text-xl font-bold">R$ 378.024,48</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 border border-border/30">
                    <p className="text-muted-foreground text-xs mb-1">Conversão</p>
                    <p className="text-xl font-bold text-accent">86%</p>
                  </div>
                </div>

                {/* Chart placeholder */}
                <div className="bg-secondary/30 rounded-xl p-6 h-48 flex items-end gap-2 border border-border/20">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((height, i) => (
                    <div 
                      key={i}
                      className="flex-1 rounded-t-md gradient-blue-vibrant opacity-70"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute -inset-1 rounded-2xl gradient-blue-vibrant opacity-15 blur-xl -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;