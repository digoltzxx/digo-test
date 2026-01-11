import { useState } from "react";
import { ArrowLeft, Search, HelpCircle, CreditCard, Users, Settings, Shield, FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const categories = [
  { icon: CreditCard, title: "Pagamentos", count: 15 },
  { icon: Users, title: "Conta", count: 12 },
  { icon: Settings, title: "Configurações", count: 8 },
  { icon: Shield, title: "Segurança", count: 10 },
  { icon: FileText, title: "Documentos", count: 6 },
  { icon: HelpCircle, title: "Outros", count: 5 }
];

const faqs = [
  {
    question: "Como funciona o recebimento por PIX?",
    answer: "O recebimento por PIX é instantâneo (D+0). Assim que o pagamento é confirmado, o valor fica disponível para saque na sua conta Royal Pay."
  },
  {
    question: "Quais são as taxas cobradas?",
    answer: "PIX: 4,99%, Cartão de Crédito: 6,99% (D+2), Boleto: 5,99% (D+1). Não cobramos taxa de adesão ou mensalidade."
  },
  {
    question: "Como faço para sacar meu dinheiro?",
    answer: "Basta acessar a área de Carteira no seu painel, inserir o valor desejado e confirmar. O saque é processado em até 1 dia útil."
  },
  {
    question: "Posso parcelar vendas no cartão?",
    answer: "Sim! Você pode oferecer parcelamento em até 12x para seus clientes. As taxas variam conforme o número de parcelas."
  },
  {
    question: "Como funciona a área de membros?",
    answer: "A área de membros é gratuita e permite que você crie cursos ilimitados. Seus clientes recebem acesso automaticamente após a compra."
  },
  {
    question: "Preciso de CNPJ para usar a plataforma?",
    answer: "Não, você pode utilizar a Royal Pay como pessoa física (CPF) ou jurídica (CNPJ)."
  }
];

const CentralAjuda = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Central de Ajuda
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Encontre respostas para suas dúvidas.
            </p>
            
            {/* Search */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar artigos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-card/60"
              />
            </div>
          </div>
          
          {/* Categories */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
            {categories.map((category, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-4 text-center hover:border-accent/40 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3 mx-auto group-hover:bg-accent/20 transition-colors">
                  <category.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-medium text-sm">{category.title}</h3>
                <p className="text-xs text-muted-foreground">{category.count} artigos</p>
              </div>
            ))}
          </div>
          
          {/* FAQs */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Perguntas Frequentes</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="bg-card/60 border border-border/50 rounded-2xl px-6"
                >
                  <AccordionTrigger className="hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {filteredFaqs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum resultado encontrado para "{searchQuery}"
              </p>
            )}
          </div>
          
          {/* Contact CTA */}
          <div className="text-center mt-16 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-12 border border-accent/20">
            <h2 className="text-2xl font-bold mb-4">Não encontrou o que procurava?</h2>
            <p className="text-muted-foreground mb-6">
              Nossa equipe de suporte está pronta para ajudar.
            </p>
            <Link 
              to="/contato"
              className="inline-flex items-center gap-2 text-accent hover:underline font-medium"
            >
              Falar com o Suporte
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default CentralAjuda;
