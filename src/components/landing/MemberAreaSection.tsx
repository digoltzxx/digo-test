import { ArrowRight, Play, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const MemberAreaSection = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("membros");

  const tabContent = {
    membros: {
      title: "Uma área de membros personalizada e sem custo para você armazenar e gerenciar seus conteúdos com facilidade.",
      subtitle: "A personalização aumenta a conversão, evitando vendas abandonadas e garantindo alto índice de retenção."
    },
    comunidade: {
      title: "Crie uma comunidade engajada com seus alunos e clientes em um espaço exclusivo.",
      subtitle: "Promova interações, tire dúvidas e construa relacionamentos duradouros com seu público."
    },
    aplicativo: {
      title: "Seu conteúdo disponível em um aplicativo mobile personalizado com sua marca.",
      subtitle: "Ofereça a melhor experiência para seus clientes acessarem de qualquer lugar."
    }
  };

  const currentContent = tabContent[activeTab as keyof typeof tabContent];

  return (
    <section id="area-membros" className="py-20 md:py-28 bg-gradient-to-b from-background via-secondary/20 to-background relative overflow-hidden scroll-mt-20">
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Área de Membros <span className="gradient-text-blue">Premium</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            A melhor experiência para o seu cliente.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Content */}
          <div className="order-2 lg:order-1">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              <button 
                onClick={() => setActiveTab("membros")}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "membros" 
                    ? "bg-foreground text-background" 
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border/50"
                }`}
              >
                Área de membros
              </button>
              <button 
                onClick={() => setActiveTab("comunidade")}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "comunidade" 
                    ? "bg-foreground text-background" 
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border/50"
                }`}
              >
                Comunidade
              </button>
              <button 
                onClick={() => setActiveTab("aplicativo")}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "aplicativo" 
                    ? "bg-foreground text-background" 
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border/50"
                }`}
              >
                Aplicativo
              </button>
            </div>

            <p className="text-foreground/90 text-lg leading-relaxed mb-4">
              {currentContent.title}
            </p>
            <p className="text-muted-foreground mb-8">
              {currentContent.subtitle}
            </p>

            <Button 
              size="lg"
              className="bg-foreground text-background font-semibold px-8 rounded-full hover:bg-foreground/90 transition-all group shadow-lg shadow-white/10"
              onClick={() => navigate("/cadastro")}
            >
              Explorar área de membros
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Preview */}
          <div className="order-1 lg:order-2">
            <div className="relative">
              <div className="bg-card rounded-2xl p-5 shadow-2xl border border-border/50">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg gradient-blue-vibrant" />
                  <div className="flex-1">
                    <div className="h-2.5 w-28 bg-secondary rounded-full" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                </div>

                {/* Content grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/60 rounded-xl p-4 aspect-video flex items-center justify-center border border-border/30 hover:border-accent/30 transition-colors cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Play className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <div className="bg-secondary/60 rounded-xl p-4 aspect-video flex items-center justify-center border border-border/30 hover:border-accent/30 transition-colors cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <div className="bg-secondary/60 rounded-xl p-4 aspect-video flex items-center justify-center border border-border/30 hover:border-accent/30 transition-colors cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <div className="bg-secondary/60 rounded-xl p-4 aspect-video flex items-center justify-center border border-border/30 hover:border-accent/30 transition-colors cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Play className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating glow */}
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
              <div className="absolute -left-8 -top-8 w-32 h-32 bg-blue-500/15 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MemberAreaSection;