import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoRoyalpay from "@/assets/logo-royalpay.png";

const TermosDeUso = () => {
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
        <h1 className="text-3xl font-bold mb-8">Termos de Uso</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar nossa plataforma, você concorda em cumprir e estar vinculado a estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não poderá acessar o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Uso da Plataforma</h2>
            <p>
              Você concorda em usar a plataforma apenas para fins legais e de acordo com estes Termos. 
              Você não deve usar a plataforma de qualquer forma que possa danificar, desativar ou sobrecarregar nossos servidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Conta do Usuário</h2>
            <p>
              Ao criar uma conta, você é responsável por manter a confidencialidade de suas credenciais de login 
              e por todas as atividades que ocorram em sua conta. Você deve nos notificar imediatamente sobre 
              qualquer uso não autorizado de sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Pagamentos e Taxas</h2>
            <p>
              Todas as taxas e comissões aplicáveis serão claramente informadas antes de qualquer transação. 
              Você concorda em pagar todas as taxas associadas ao uso de nossos serviços conforme estabelecido 
              em nossa página de preços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, recursos e funcionalidades da plataforma são de nossa propriedade exclusiva 
              e protegidos por leis de propriedade intelectual. Você não pode reproduzir, distribuir ou 
              criar trabalhos derivados sem nossa autorização expressa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Limitação de Responsabilidade</h2>
            <p>
              Em nenhuma circunstância seremos responsáveis por quaisquer danos indiretos, incidentais, 
              especiais ou consequentes decorrentes do uso ou impossibilidade de uso de nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão 
              em vigor imediatamente após a publicação. O uso continuado da plataforma após as alterações 
              constitui sua aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Contato</h2>
            <p>
              Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco através de 
              nossos canais de suporte.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
