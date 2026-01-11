import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle } from "lucide-react";

interface SaveButtonProps {
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}

const SaveButton = ({ onSave, saving, hasChanges }: SaveButtonProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        {hasChanges && (
          <p className="text-sm text-yellow-400 flex items-center gap-2" data-testid="unsaved-warning">
            <AlertCircle className="w-4 h-4" />
            Você tem alterações não salvas
          </p>
        )}
      </div>
      <Button
        onClick={onSave}
        disabled={saving || !hasChanges}
        className={`px-8 transition-all ${
          hasChanges ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600"
        } text-white`}
        data-testid="btn-save"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Salvar Configurações
          </>
        )}
      </Button>
    </div>
  );
};

export default SaveButton;
