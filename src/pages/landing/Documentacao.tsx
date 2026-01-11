import { ArrowLeft, Book, Code, Webhook, Key, FileJson, Terminal, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const sections = [
  {
    icon: Book,
    title: "Começando",
    description: "Primeiros passos com a API Royal Pay",
    articles: ["Autenticação", "Ambiente de testes", "Primeiros passos"]
  },
  {
    icon: Code,
    title: "Referência da API",
    description: "Documentação completa de todos os endpoints",
    articles: ["Transações", "Clientes", "Produtos", "Assinaturas"]
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Receba notificações em tempo real",
    articles: ["Configuração", "Eventos", "Segurança", "Retry policy"]
  },
  {
    icon: Key,
    title: "Autenticação",
    description: "Como autenticar suas requisições",
    articles: ["API Keys", "OAuth 2.0", "Tokens"]
  },
  {
    icon: FileJson,
    title: "SDKs",
    description: "Bibliotecas oficiais para integração",
    articles: ["JavaScript/Node.js", "PHP", "Python", "Ruby"]
  },
  {
    icon: Terminal,
    title: "Exemplos",
    description: "Exemplos de código prontos para usar",
    articles: ["Checkout básico", "Assinaturas", "Webhooks"]
  }
];

const Documentacao = () => {
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
              Documentação
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para integrar com a API Royal Pay.
            </p>
          </div>
          
          {/* Quick start */}
          <div className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-8 border border-accent/20 mb-12">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                <Terminal className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Quick Start</h2>
                <p className="text-muted-foreground mb-4">
                  Comece a integrar em minutos com nosso guia rápido.
                </p>
                <pre className="bg-background/50 rounded-lg p-4 text-sm overflow-x-auto">
                  <code className="text-accent">
                    curl -X POST https://api.royalpay.com.br/v1/transactions \{"\n"}
                    {"  "}-H "Authorization: Bearer YOUR_API_KEY" \{"\n"}
                    {"  "}-H "Content-Type: application/json" \{"\n"}
                    {"  "}-d '{"{"}"amount": 1000, "payment_method": "pix"{"}"}'
                  </code>
                </pre>
              </div>
            </div>
          </div>
          
          {/* Sections */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((section, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-6 hover:border-accent/40 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <section.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{section.description}</p>
                <ul className="space-y-2">
                  {section.articles.map((article, idx) => (
                    <li key={idx}>
                      <a 
                        href="#" 
                        className="text-sm text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                        {article}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          {/* API Reference */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Referência Completa da API</h2>
            <p className="text-muted-foreground mb-6">
              Explore todos os endpoints disponíveis na nossa API.
            </p>
            <Link 
              to="/api"
              className="inline-flex items-center gap-2 text-accent hover:underline font-medium"
            >
              Acessar Referência da API
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Documentacao;
