import { ArrowLeft, CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const services = [
  { name: "API", status: "operational", uptime: "99.99%" },
  { name: "Dashboard", status: "operational", uptime: "99.98%" },
  { name: "Checkout", status: "operational", uptime: "99.99%" },
  { name: "Webhooks", status: "operational", uptime: "99.97%" },
  { name: "Área de Membros", status: "operational", uptime: "99.95%" },
  { name: "Pagamentos PIX", status: "operational", uptime: "99.99%" },
  { name: "Pagamentos Cartão", status: "operational", uptime: "99.98%" },
  { name: "Pagamentos Boleto", status: "operational", uptime: "99.96%" }
];

const incidents = [
  {
    date: "05 Jan 2024",
    title: "Manutenção programada",
    status: "resolved",
    description: "Atualização de infraestrutura concluída com sucesso."
  },
  {
    date: "28 Dez 2023",
    title: "Lentidão no processamento de webhooks",
    status: "resolved",
    description: "Identificamos e corrigimos um problema de performance."
  }
];

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "operational":
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case "degraded":
      return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    case "outage":
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
};

const Status = () => {
  const allOperational = services.every(s => s.status === "operational");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container max-w-4xl">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Status do Sistema
            </h1>
            <p className="text-xl text-muted-foreground">
              Monitore o status de todos os serviços Royal Pay.
            </p>
          </div>
          
          {/* Overall status */}
          <div className={`rounded-2xl p-8 mb-8 text-center ${
            allOperational 
              ? "bg-green-500/10 border border-green-500/20" 
              : "bg-yellow-500/10 border border-yellow-500/20"
          }`}>
            <div className="flex items-center justify-center gap-3 mb-2">
              {allOperational ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              )}
              <h2 className="text-2xl font-bold">
                {allOperational ? "Todos os sistemas operacionais" : "Alguns sistemas com degradação"}
              </h2>
            </div>
            <p className="text-muted-foreground">
              Última atualização: há 5 minutos
            </p>
          </div>
          
          {/* Services */}
          <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden mb-12">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold">Serviços</h3>
            </div>
            <div className="divide-y divide-border/50">
              {services.map((service, index) => (
                <div key={index} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={service.status} />
                    <span className="font-medium">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {service.uptime} uptime
                    </span>
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      service.status === "operational" 
                        ? "bg-green-500/10 text-green-400" 
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}>
                      {service.status === "operational" ? "Operacional" : "Degradado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Incidents */}
          <h3 className="text-xl font-bold mb-4">Histórico de Incidentes</h3>
          <div className="space-y-4">
            {incidents.map((incident, index) => (
              <div 
                key={index}
                className="bg-card/60 border border-border/50 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold">{incident.title}</h4>
                  <span className="text-sm text-muted-foreground">{incident.date}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-2">{incident.description}</p>
                <span className="text-sm text-green-400">Resolvido</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Status;
