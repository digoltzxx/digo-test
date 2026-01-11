import { 
  ShoppingCart, 
  Zap, 
  Users, 
  Share2, 
  ShieldCheck, 
  RefreshCcw,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: ShoppingCart,
    title: "Checkout Transparente e Personalizável",
    description: "Todas as opções, como elementos do seu Checkout podem ser personalizados por você para casar com sua identidade!"
  },
  {
    icon: Zap,
    title: "Aprovação Instantânea de Produtos",
    description: "Cadastre seu produto e comece a vender imediatamente, sem atrasos ou processos burocráticos."
  },
  {
    icon: Users,
    title: "Área de Membros Estilo Netflix",
    description: "Uma área de membros personalizada e sem custo para você armazenar seus conteúdos e gerenciar seus cursos com facilidade."
  },
  {
    icon: Share2,
    title: "Afiliação, Marketplace e Co-produção",
    description: "Todas as formas de monetizar no digital. Indique e receba comissões como afiliado ou utilize nossa Marketplace!"
  },
  {
    icon: ShieldCheck,
    title: "Sem bloqueios",
    description: "Sua conta não vai ser bloqueada do nada. Usamos inteligência de dados contra chargeback e fraude com segurança."
  },
  {
    icon: RefreshCcw,
    title: "Recuperação de Vendas (Smart Recovery)",
    description: "Sistema exclusivo que aumenta suas vendas fazendo a recuperação de boletos e PIX pendentes automaticamente!"
  }
];

const FeaturesSection = () => {
  const navigate = useNavigate();

  return (
    <section id="funcionalidades" className="py-20 md:py-28 relative scroll-mt-20">
      {/* Section header */}
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Por que a <span className="gradient-text-blue">Royal Pay</span>?
          </h2>
          <p className="text-muted-foreground text-lg">
            Escolha a Royal Pay e transforme sua experiência no mundo digital.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/50 transition-all duration-300 hover:bg-card/80"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Button 
            size="lg"
            className="bg-foreground text-background font-semibold px-8 rounded-full hover:bg-foreground/90 transition-all group shadow-lg shadow-white/10"
            onClick={() => navigate("/cadastro")}
          >
            Começar agora
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;