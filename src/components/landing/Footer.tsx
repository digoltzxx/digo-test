import { useState } from "react";
import Logo from "@/components/ui/Logo";
import { Link } from "react-router-dom";
import { Mail, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "E-mail obrigatório",
        description: "Por favor, insira seu e-mail.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Inscrito com sucesso!",
      description: "Você receberá nossas novidades em breve.",
    });
    
    setEmail("");
    setIsLoading(false);
  };

  return (
    <footer id="contato" className="py-16 border-t border-border/50 scroll-mt-20">
      <div className="container">
        {/* Newsletter section */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h3 className="text-2xl font-bold mb-4">
            Fique por dentro das novidades
          </h3>
          <p className="text-muted-foreground mb-6">
            Receba dicas, atualizações e conteúdos exclusivos sobre vendas digitais.
          </p>
          <form onSubmit={handleNewsletterSubmit} className="flex gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-12 h-12 bg-secondary/50 border-border/50"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>

        {/* Links and info */}
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <Link to="/">
              <Logo />
            </Link>
            <p className="text-muted-foreground text-sm mt-4">
              A plataforma completa para vender produtos digitais com as melhores taxas do mercado.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</Link></li>
              <li><Link to="/taxas" className="hover:text-foreground transition-colors">Taxas</Link></li>
              <li><Link to="/area-membros" className="hover:text-foreground transition-colors">Área de Membros</Link></li>
              <li><Link to="/integracoes" className="hover:text-foreground transition-colors">Integrações</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/sobre" className="hover:text-foreground transition-colors">Sobre nós</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link to="/carreiras" className="hover:text-foreground transition-colors">Carreiras</Link></li>
              <li><Link to="/contato" className="hover:text-foreground transition-colors">Contato</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Suporte</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/central-ajuda" className="hover:text-foreground transition-colors">Central de Ajuda</Link></li>
              <li><Link to="/documentacao" className="hover:text-foreground transition-colors">Documentação</Link></li>
              <li><Link to="/status" className="hover:text-foreground transition-colors">Status</Link></li>
              <li><Link to="/api" className="hover:text-foreground transition-colors">API</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border/30">
          <p className="text-sm text-muted-foreground">
            © 2024 Royal Pay. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/central-ajuda" className="hover:text-foreground transition-colors">Termos de uso</Link>
            <Link to="/central-ajuda" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/central-ajuda" className="hover:text-foreground transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
