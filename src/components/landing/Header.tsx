import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/ui/Logo";
import { Link, useNavigate } from "react-router-dom";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const scrollToSection = (sectionId: string) => {
    setIsMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/">
            <Logo />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToSection("funcionalidades")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Funcionalidades
            </button>
            <button 
              onClick={() => scrollToSection("taxas")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Taxas
            </button>
            <button 
              onClick={() => scrollToSection("area-membros")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Área de Membros
            </button>
            <button 
              onClick={() => scrollToSection("contato")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contato
            </button>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/login")}
            >
              Entrar
            </Button>
            <Button 
              size="sm" 
              className="bg-foreground text-background font-semibold rounded-full hover:bg-foreground/90"
              onClick={() => navigate("/cadastro")}
            >
              Criar conta
            </Button>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/30">
            <nav className="flex flex-col gap-4">
              <button 
                onClick={() => scrollToSection("funcionalidades")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Funcionalidades
              </button>
              <button 
                onClick={() => scrollToSection("taxas")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Taxas
              </button>
              <button 
                onClick={() => scrollToSection("area-membros")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Área de Membros
              </button>
              <button 
                onClick={() => scrollToSection("contato")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Contato
              </button>
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => { setIsMenuOpen(false); navigate("/login"); }}
                >
                  Entrar
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 bg-foreground text-background font-semibold"
                  onClick={() => { setIsMenuOpen(false); navigate("/cadastro"); }}
                >
                  Criar conta
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
