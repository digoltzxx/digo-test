import { Banknote, CreditCard, FileText, RefreshCcw, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const pricingItems = [
  {
    icon: Banknote,
    name: "PIX D+0",
    rate: "4,99%",
    color: "text-green-400",
    description: "Receba instantaneamente"
  },
  {
    icon: CreditCard,
    name: "Cartão de Crédito D+2",
    rate: "6,99%",
    color: "text-accent",
    description: "Parcelamento em até 12x"
  },
  {
    icon: FileText,
    name: "Boleto D+1",
    rate: "5,99%",
    color: "text-yellow-400",
    description: "Compensação rápida"
  }
];

const PricingSection = () => {
  const { toast } = useToast();

  const handlePricingClick = (name: string) => {
    toast({
      title: `${name}`,
      description: "Crie sua conta para começar a usar este método de pagamento.",
    });
  };

  return (
    <section id="taxas" className="py-20 md:py-28 relative scroll-mt-20">
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Taxas perfeitas para sua operação
          </h2>
          <p className="text-muted-foreground text-lg">
            Custos reduzidos, lucros elevados.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {pricingItems.map((item, index) => (
              <button 
                key={index}
                onClick={() => handlePricingClick(item.name)}
                className="bg-card/60 border border-border/50 rounded-2xl p-6 text-center hover:border-accent/40 transition-all duration-300 hover:bg-card/80 hover:scale-105 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary mx-auto mb-4 flex items-center justify-center border border-border/30">
                  <item.icon className={`w-7 h-7 ${item.color}`} />
                </div>
                <h3 className="font-semibold mb-2 text-sm">{item.name}</h3>
                <p className="text-3xl font-bold gradient-text-blue mb-2">{item.rate}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </button>
            ))}
          </div>

          {/* Additional rates */}
          <div className="grid md:grid-cols-2 gap-4">
            <button 
              onClick={() => handlePricingClick("Recuperação de vendas")}
              className="bg-card/60 border border-border/50 rounded-xl p-5 flex items-center justify-between hover:border-accent/30 transition-all hover:bg-card/80 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <RefreshCcw className="w-5 h-5 text-accent" />
                </div>
                <span className="font-medium">Recuperação de vendas</span>
              </div>
              <span className="font-bold text-xl text-accent">3,99%</span>
            </button>
            <button 
              onClick={() => handlePricingClick("Reserva de segurança")}
              className="bg-card/60 border border-border/50 rounded-xl p-5 flex items-center justify-between hover:border-green-500/30 transition-all hover:bg-card/80 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <span className="font-medium">Reserva de segurança</span>
              </div>
              <span className="font-bold text-xl text-green-400">0%</span>
            </button>
          </div>

        </div>
      </div>
    </section>
  );
};

export default PricingSection;