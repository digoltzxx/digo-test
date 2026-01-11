import { ArrowLeft, Banknote, CreditCard, FileText, RefreshCcw, Shield, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const pricingItems = [
  {
    icon: Banknote,
    name: "PIX D+0",
    rate: "4,99%",
    color: "text-green-400",
    description: "Receba instantaneamente",
    features: ["Aprovação imediata", "Sem taxa fixa", "Disponível 24/7"]
  },
  {
    icon: CreditCard,
    name: "Cartão de Crédito D+2",
    rate: "6,99%",
    color: "text-accent",
    description: "Parcelamento em até 12x",
    features: ["Parcelamento sem juros", "Antecipação disponível", "Todas as bandeiras"]
  },
  {
    icon: FileText,
    name: "Boleto D+1",
    rate: "5,99%",
    color: "text-yellow-400",
    description: "Compensação rápida",
    features: ["Vencimento flexível", "Compensação D+1", "Baixo custo"]
  }
];

const additionalFeatures = [
  { name: "Recuperação de vendas", rate: "3,99%", description: "Recupere carrinhos abandonados automaticamente" },
  { name: "Reserva de segurança", rate: "0%", description: "Sem retenção do seu dinheiro" },
  { name: "Saques", rate: "Grátis", description: "Transfira para sua conta quando quiser" },
  { name: "Área de Membros", rate: "Incluso", description: "Crie cursos e comunidades" },
];

const Taxas = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Taxas Transparentes
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Sem surpresas, sem taxas escondidas. Você sabe exatamente quanto vai pagar.
            </p>
          </div>
          
          {/* Main pricing */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {pricingItems.map((item, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-8 text-center hover:border-accent/40 transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto mb-6 flex items-center justify-center border border-border/30">
                  <item.icon className={`w-8 h-8 ${item.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                <p className="text-4xl font-bold text-accent mb-2">{item.rate}</p>
                <p className="text-muted-foreground text-sm mb-6">{item.description}</p>
                <ul className="space-y-2 text-sm">
                  {item.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 justify-center text-muted-foreground">
                      <Check className="w-4 h-4 text-green-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          {/* Additional features */}
          <div className="bg-card/40 border border-border/50 rounded-2xl p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Recursos Adicionais</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {additionalFeatures.map((feature, index) => (
                <div key={index} className="text-center">
                  <p className="text-2xl font-bold text-accent mb-1">{feature.rate}</p>
                  <p className="font-medium mb-1">{feature.name}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-12 border border-accent/20">
            <h2 className="text-2xl font-bold mb-4">Pronto para começar?</h2>
            <p className="text-muted-foreground mb-6">
              Crie sua conta gratuitamente e comece a vender hoje mesmo.
            </p>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/cadastro">Criar Conta Grátis</Link>
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Taxas;
