import { ArrowLeft, Code, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const endpoints = [
  {
    method: "POST",
    path: "/v1/transactions",
    description: "Criar uma nova transação",
    methodColor: "bg-green-500/20 text-green-400"
  },
  {
    method: "GET",
    path: "/v1/transactions/:id",
    description: "Buscar transação por ID",
    methodColor: "bg-blue-500/20 text-blue-400"
  },
  {
    method: "GET",
    path: "/v1/transactions",
    description: "Listar todas as transações",
    methodColor: "bg-blue-500/20 text-blue-400"
  },
  {
    method: "POST",
    path: "/v1/customers",
    description: "Criar um novo cliente",
    methodColor: "bg-green-500/20 text-green-400"
  },
  {
    method: "GET",
    path: "/v1/customers/:id",
    description: "Buscar cliente por ID",
    methodColor: "bg-blue-500/20 text-blue-400"
  },
  {
    method: "POST",
    path: "/v1/subscriptions",
    description: "Criar uma nova assinatura",
    methodColor: "bg-green-500/20 text-green-400"
  },
  {
    method: "DELETE",
    path: "/v1/subscriptions/:id",
    description: "Cancelar uma assinatura",
    methodColor: "bg-red-500/20 text-red-400"
  },
  {
    method: "POST",
    path: "/v1/webhooks",
    description: "Configurar webhook",
    methodColor: "bg-green-500/20 text-green-400"
  }
];

const API = () => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "Código copiado para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const exampleCode = `// Exemplo: Criar uma transação PIX
const response = await fetch('https://api.royalpay.com.br/v1/transactions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 10000, // R$ 100,00 em centavos
    payment_method: 'pix',
    customer: {
      name: 'João Silva',
      email: 'joao@email.com',
      document: '12345678900'
    }
  })
});

const transaction = await response.json();
console.log(transaction.pix_qr_code);`;

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
              Referência da API
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Documentação completa da API REST Royal Pay.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Endpoints */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Endpoints</h2>
              <div className="space-y-3">
                {endpoints.map((endpoint, index) => (
                  <div 
                    key={index}
                    className="bg-card/60 border border-border/50 rounded-xl p-4 hover:border-accent/40 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${endpoint.methodColor}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono text-accent">{endpoint.path}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Example */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Exemplo de Código</h2>
              <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">JavaScript</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopy(exampleCode)}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <pre className="p-4 overflow-x-auto text-sm">
                  <code className="text-muted-foreground">{exampleCode}</code>
                </pre>
              </div>
              
              {/* Auth info */}
              <div className="mt-6 bg-accent/10 border border-accent/20 rounded-2xl p-6">
                <h3 className="font-semibold mb-2">Autenticação</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Todas as requisições devem incluir o header de autorização com sua API Key.
                </p>
                <code className="text-sm text-accent bg-background/50 px-3 py-2 rounded-lg block">
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>
              
              {/* Base URL */}
              <div className="mt-6 bg-card/60 border border-border/50 rounded-2xl p-6">
                <h3 className="font-semibold mb-2">Base URL</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Todas as requisições devem ser feitas para:
                </p>
                <code className="text-sm text-accent">
                  https://api.royalpay.com.br
                </code>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default API;
