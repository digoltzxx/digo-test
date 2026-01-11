import React from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ 
  message = 'Sistema em manutenção. Por favor, tente novamente mais tarde.' 
}) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto">
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto bg-accent/10 rounded-full flex items-center justify-center">
            <Wrench className="w-12 h-12 text-accent animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Sistema em Manutenção
        </h1>
        
        <p className="text-muted-foreground text-lg mb-6">
          {message}
        </p>
        
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Estamos trabalhando para melhorar sua experiência.
            <br />
            Agradecemos sua paciência!
          </p>
        </div>
        
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
};

export default MaintenancePage;
