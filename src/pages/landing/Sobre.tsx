import { ArrowLeft, Target, Heart, Rocket, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const values = [
  {
    icon: Target,
    title: "Missão",
    description: "Democratizar o acesso a ferramentas de pagamento de alta qualidade para empreendedores digitais de todos os tamanhos."
  },
  {
    icon: Heart,
    title: "Valores",
    description: "Transparência, inovação e foco no cliente estão no centro de tudo que fazemos."
  },
  {
    icon: Rocket,
    title: "Visão",
    description: "Ser a plataforma de pagamentos preferida dos empreendedores digitais na América Latina."
  },
  {
    icon: Users,
    title: "Equipe",
    description: "Um time apaixonado por tecnologia e comprometido com o sucesso dos nossos clientes."
  }
];

const stats = [
  { value: "10K+", label: "Clientes Ativos" },
  { value: "R$ 50M+", label: "Transacionados" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Suporte" }
];

const Sobre = () => {
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
              Sobre Nós
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Conheça a história e os valores da Royal Pay.
            </p>
          </div>
          
          {/* Story */}
          <div className="bg-card/60 border border-border/50 rounded-2xl p-8 md:p-12 mb-12">
            <h2 className="text-2xl font-bold mb-4">Nossa História</h2>
            <p className="text-muted-foreground mb-4">
              A Royal Pay nasceu da frustração de empreendedores digitais que buscavam uma plataforma de pagamentos justa, transparente e fácil de usar. Cansados de taxas abusivas e sistemas complicados, decidimos criar a solução que sempre quisemos ter.
            </p>
            <p className="text-muted-foreground">
              Hoje, ajudamos milhares de produtores digitais a vender seus cursos, e-books e serviços com as melhores taxas do mercado, suporte dedicado e uma experiência de checkout que converte.
            </p>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <div key={index} className="bg-card/60 border border-border/50 rounded-2xl p-6 text-center">
                <p className="text-3xl font-bold text-accent mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
          
          {/* Values */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {values.map((value, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/40 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/cadastro">Junte-se a Nós</Link>
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Sobre;
