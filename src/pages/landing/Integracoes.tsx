import { ArrowLeft, Webhook, Zap, Code, Link2, Globe, Mail, MessageSquare, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const integrations = [
  {
    name: "Webhooks",
    icon: Webhook,
    description: "Receba notificações em tempo real de todos os eventos.",
    category: "Automação"
  },
  {
    name: "Zapier",
    icon: Zap,
    description: "Conecte com mais de 5.000 aplicativos automaticamente.",
    category: "Automação"
  },
  {
    name: "API REST",
    icon: Code,
    description: "API completa para integração com seu sistema.",
    category: "Desenvolvedores"
  },
  {
    name: "Facebook Pixel",
    icon: BarChart3,
    description: "Rastreie conversões e otimize seus anúncios.",
    category: "Marketing"
  },
  {
    name: "Google Analytics",
    icon: Globe,
    description: "Acompanhe métricas detalhadas de vendas.",
    category: "Marketing"
  },
  {
    name: "E-mail Marketing",
    icon: Mail,
    description: "Integre com as principais ferramentas de email.",
    category: "Marketing"
  },
  {
    name: "WhatsApp",
    icon: MessageSquare,
    description: "Notificações automáticas via WhatsApp.",
    category: "Comunicação"
  },
  {
    name: "TikTok Pixel",
    icon: BarChart3,
    description: "Rastreie conversões do TikTok Ads.",
    category: "Marketing"
  }
];

const Integracoes = () => {
  const categories = [...new Set(integrations.map(i => i.category))];

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
              Integrações
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Conecte a Royal Pay com suas ferramentas favoritas e automatize seu negócio.
            </p>
          </div>
          
          {categories.map((category) => (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold mb-6">{category}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {integrations.filter(i => i.category === category).map((integration, index) => (
                  <div 
                    key={index}
                    className="bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/40 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                      <integration.icon className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-semibold mb-2">{integration.name}</h3>
                    <p className="text-muted-foreground text-sm">{integration.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="text-center mt-12">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/cadastro">Começar a Integrar</Link>
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Integracoes;
