import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";

interface ThankYouMessageProps {
  message: string;
  onMessageChange: (value: string) => void;
  error?: string;
  maxLength?: number;
}

export const DEFAULT_THANK_YOU_MESSAGE = "Obrigado pela sua compra! Em breve você receberá o acesso.";
export const MAX_MESSAGE_LENGTH = 500;

const ThankYouMessage = ({
  message,
  onMessageChange,
  error,
  maxLength = MAX_MESSAGE_LENGTH,
}: ThankYouMessageProps) => {
  const isNearLimit = message.length > maxLength * 0.9;

  return (
    <Card className="bg-[#161b22] border-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Mensagem Personalizada</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-sm">Mensagem de Agradecimento</Label>
            <Textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              className={`bg-[#0d1117] border-gray-700 text-white mt-2 resize-none ${
                error ? "border-red-500" : ""
              }`}
              placeholder={DEFAULT_THANK_YOU_MESSAGE}
              rows={4}
              data-testid="textarea-message"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Esta mensagem será exibida na tela de sucesso após o pagamento
              </p>
              <span
                className={`text-xs ${isNearLimit ? "text-yellow-400" : "text-gray-500"}`}
                data-testid="char-counter"
              >
                {message.length}/{maxLength}
              </span>
            </div>
            {error && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="error-message">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>

          {!message && (
            <div className="p-3 bg-[#0d1117] rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400">
                <span className="text-gray-300">Mensagem padrão:</span> "{DEFAULT_THANK_YOU_MESSAGE}"
              </p>
            </div>
          )}

          <Alert className="bg-green-500/10 border-green-500/30">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200 text-sm">
              Você pode usar emojis e quebras de linha para personalizar sua mensagem! 🎉
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThankYouMessage;
