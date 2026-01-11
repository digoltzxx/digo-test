import { ArrowLeft, Users, BookOpen, Video, Lock, BarChart3, Bell, Settings, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const features = [
  {
    icon: BookOpen,
    title: "Cursos Ilimitados",
    description: "Crie quantos cursos quiser, sem limites de alunos ou conteúdo."
  },
  {
    icon: Video,
    title: "Múltiplos Formatos",
    description: "Vídeos, PDFs, textos, áudios e muito mais em um só lugar."
  },
  {
    icon: Users,
    title: "Gestão de Alunos",
    description: "Controle total sobre matrículas, acessos e progresso."
  },
  {
    icon: Lock,
    title: "Acesso Automático",
    description: "Libere conteúdo automaticamente após a compra."
  },
  {
    icon: BarChart3,
    title: "Relatórios Detalhados",
    description: "Acompanhe o progresso dos alunos em tempo real."
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Envie avisos e atualizações para seus alunos."
  },
  {
    icon: Settings,
    title: "Personalização",
    description: "Customize cores, logo e domínio da sua área."
  },
  {
    icon: Crown,
    title: "Certificados",
    description: "Emita certificados automáticos de conclusão."
  }
];

const AreaMembros = () => {
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
              Área de Membros
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Crie cursos, comunidades e conteúdos exclusivos para seus clientes.
            </p>
          </div>
          
          {/* Hero feature */}
          <div className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-12 border border-accent/20 mb-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Tudo Incluso no Seu Plano</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              A área de membros é gratuita para todos os usuários. Crie cursos ilimitados sem pagar nada a mais.
            </p>
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
              <Crown className="w-4 h-4" />
              100% Gratuito
            </div>
          </div>
          
          {/* Features grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/40 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <div className="text-center">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/cadastro">Criar Minha Área de Membros</Link>
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AreaMembros;
