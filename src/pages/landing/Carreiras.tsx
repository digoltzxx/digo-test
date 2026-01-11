import { ArrowLeft, Briefcase, MapPin, Clock, ArrowRight, Heart, Zap, Users, Coffee } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const benefits = [
  { icon: Heart, title: "Plano de Saúde", description: "Cobertura completa para você e família" },
  { icon: Zap, title: "Trabalho Remoto", description: "Trabalhe de onde quiser" },
  { icon: Users, title: "Cultura Incrível", description: "Time colaborativo e inovador" },
  { icon: Coffee, title: "Horário Flexível", description: "Organize seu tempo como preferir" }
];

const positions = [
  {
    title: "Desenvolvedor Full Stack Senior",
    department: "Engenharia",
    location: "Remoto",
    type: "Tempo integral"
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remoto",
    type: "Tempo integral"
  },
  {
    title: "Customer Success Manager",
    department: "Sucesso do Cliente",
    location: "São Paulo",
    type: "Tempo integral"
  },
  {
    title: "Analista de Marketing Digital",
    department: "Marketing",
    location: "Remoto",
    type: "Tempo integral"
  },
  {
    title: "DevOps Engineer",
    department: "Engenharia",
    location: "Remoto",
    type: "Tempo integral"
  }
];

const Carreiras = () => {
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
              Carreiras
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Junte-se ao time que está transformando o mercado de pagamentos digitais.
            </p>
          </div>
          
          {/* Benefits */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card/60 border border-border/50 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 mx-auto">
                  <benefit.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-1">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
          
          {/* Positions */}
          <h2 className="text-2xl font-bold mb-6">Vagas Abertas</h2>
          <div className="space-y-4 mb-12">
            {positions.map((position, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/40 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-accent transition-colors">
                      {position.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{position.department}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {position.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {position.type}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-12 border border-accent/20">
            <h2 className="text-2xl font-bold mb-4">Não encontrou sua vaga?</h2>
            <p className="text-muted-foreground mb-6">
              Envie seu currículo e entraremos em contato quando surgir uma oportunidade.
            </p>
            <Button size="lg" className="bg-accent hover:bg-accent/90">
              Enviar Currículo
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Carreiras;
