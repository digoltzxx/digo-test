import { ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const posts = [
  {
    title: "Como aumentar suas vendas com PIX",
    excerpt: "Descubra como o PIX pode aumentar suas conversões em até 30% e reduzir custos.",
    date: "10 Jan 2024",
    readTime: "5 min",
    category: "Pagamentos"
  },
  {
    title: "Guia completo de precificação de infoprodutos",
    excerpt: "Aprenda a definir o preço ideal para seus cursos e e-books.",
    date: "08 Jan 2024",
    readTime: "8 min",
    category: "Vendas"
  },
  {
    title: "5 estratégias para recuperar carrinhos abandonados",
    excerpt: "Técnicas comprovadas para recuperar vendas perdidas e aumentar seu faturamento.",
    date: "05 Jan 2024",
    readTime: "6 min",
    category: "Marketing"
  },
  {
    title: "Como criar uma área de membros que engaja",
    excerpt: "Dicas práticas para manter seus alunos engajados e reduzir o churn.",
    date: "02 Jan 2024",
    readTime: "7 min",
    category: "Produtos"
  },
  {
    title: "Tendências de infoprodutos para 2024",
    excerpt: "O que esperar do mercado de produtos digitais neste ano.",
    date: "28 Dez 2023",
    readTime: "10 min",
    category: "Tendências"
  },
  {
    title: "Integrações essenciais para seu negócio digital",
    excerpt: "Ferramentas que todo empreendedor digital precisa conhecer.",
    date: "25 Dez 2023",
    readTime: "5 min",
    category: "Ferramentas"
  }
];

const Blog = () => {
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
              Blog
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Dicas, estratégias e novidades sobre vendas digitais.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => (
              <article 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden hover:border-accent/40 transition-all group"
              >
                <div className="h-40 bg-gradient-to-br from-accent/20 to-primary/20" />
                <div className="p-6">
                  <span className="text-xs text-accent font-medium">{post.category}</span>
                  <h2 className="font-semibold text-lg mt-2 mb-3 group-hover:text-accent transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 group-hover:text-accent transition-colors" />
                  </div>
                </div>
              </article>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Carregar Mais Artigos
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Blog;
