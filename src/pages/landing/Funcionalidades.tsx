import { ArrowLeft, CreditCard, Zap, Shield, BarChart3, Users, Smartphone, Globe, Lock, Bell, RefreshCcw, Headphones } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const features = [
  {
    icon: Zap,
    title: "Pagamentos Instantâneos",
    description: "Receba via PIX em segundos, sem esperar dias para o dinheiro cair na conta."
  },
  {
    icon: CreditCard,
    title: "Múltiplos Métodos de Pagamento",
    description: "Aceite PIX, cartão de crédito, boleto e muito mais em um só lugar."
  },
  {
    icon: Shield,
    title: "Segurança Avançada",
    description: "Proteção contra fraudes e chargebacks com criptografia de ponta a ponta."
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    description: "Acompanhe vendas, métricas e relatórios em tempo real."
  },
  {
    icon: Users,
    title: "Área de Membros",
    description: "Crie cursos e comunidades exclusivas para seus clientes."
  },
  {
    icon: Smartphone,
    title: "Checkout Otimizado",
    description: "Páginas de pagamento responsivas e otimizadas para conversão."
  },
  {
    icon: Globe,
    title: "Venda Global",
    description: "Aceite pagamentos de qualquer lugar do mundo."
  },
  {
    icon: Lock,
    title: "Entrega Automática",
    description: "Libere produtos digitais automaticamente após a confirmação do pagamento."
  },
  {
    icon: Bell,
    title: "Notificações em Tempo Real",
    description: "Receba alertas de vendas instantaneamente por email ou push."
  },
  {
    icon: RefreshCcw,
    title: "Recuperação de Vendas",
    description: "Recupere carrinhos abandonados automaticamente."
  },
  {
    icon: Headphones,
    title: "Suporte Dedicado",
    description: "Equipe especializada pronta para ajudar você a crescer."
  },
  {
    icon: BarChart3,
    title: "Afiliados",
    description: "Programa de afiliados completo para escalar suas vendas."
  }
];

const Funcionalidades = () => {
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
              Funcionalidades
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para vender produtos digitais com eficiência e segurança.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/40 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-16">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/cadastro">Começar Agora</Link>
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Funcionalidades;
