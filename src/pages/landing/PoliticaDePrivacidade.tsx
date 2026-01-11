import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoRoyalpay from "@/assets/logo-royalpay.png";

const PoliticaDePrivacidade = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border py-4">
        <div className="container max-w-4xl mx-auto px-4 flex items-center justify-between">
          <Link to="/cadastro">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <img src={logoRoyalpay} alt="RoyalPay" className="h-8" />
        </div>
      </header>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Coleta de Informações</h2>
            <p>
              Coletamos informações que você nos fornece diretamente, como nome, e-mail, telefone, 
              CPF/CNPJ e informações bancárias necessárias para o funcionamento de nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Uso das Informações</h2>
            <p>
              Utilizamos suas informações para:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fornecer, manter e melhorar nossos serviços</li>
              <li>Processar transações e enviar notificações relacionadas</li>
              <li>Comunicar sobre produtos, serviços e eventos</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Compartilhamento de Dados</h2>
            <p>
              Não vendemos suas informações pessoais. Podemos compartilhar dados com:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Processadores de pagamento para completar transações</li>
              <li>Prestadores de serviços que nos auxiliam em nossas operações</li>
              <li>Autoridades governamentais quando exigido por lei</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Segurança dos Dados</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais para proteger suas 
              informações contra acesso não autorizado, alteração, divulgação ou destruição. 
              Utilizamos criptografia e outros protocolos de segurança padrão da indústria.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Seus Direitos</h2>
            <p>
              De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade de seus dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Cookies</h2>
            <p>
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, 
              analisar o tráfego do site e personalizar conteúdo. Você pode gerenciar 
              suas preferências de cookies através das configurações do seu navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Retenção de Dados</h2>
            <p>
              Mantemos suas informações pelo tempo necessário para fornecer nossos serviços 
              e cumprir obrigações legais. Após esse período, os dados são excluídos ou anonimizados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos sobre alterações 
              significativas por e-mail ou através de aviso em nossa plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Contato</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, 
              entre em contato com nosso Encarregado de Proteção de Dados através 
              de nossos canais de suporte.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PoliticaDePrivacidade;
