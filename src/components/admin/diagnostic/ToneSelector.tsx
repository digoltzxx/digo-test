import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Building2 } from 'lucide-react';
import { 
  CommunicationTone, 
  TONE_OPTIONS, 
  getDefaultTone, 
  setDefaultTone,
  getMessage,
} from '@/lib/communicationTone';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ToneSelectorProps {
  onToneChange?: (tone: CommunicationTone) => void;
  showPreview?: boolean;
}

export function ToneSelector({ onToneChange, showPreview = true }: ToneSelectorProps) {
  const [selectedTone, setSelectedTone] = useState<CommunicationTone>(getDefaultTone());

  useEffect(() => {
    setSelectedTone(getDefaultTone());
  }, []);

  const handleToneChange = (tone: CommunicationTone) => {
    setSelectedTone(tone);
    setDefaultTone(tone);
    onToneChange?.(tone);
    toast.success(`Tom alterado para: ${tone === 'informal' ? 'Informal' : 'Corporativo'}`);
  };

  const previewMessage = getMessage('PAYMENT_RECEIVED', selectedTone);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Tom de Comunicação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={selectedTone}
          onValueChange={(value) => handleToneChange(value as CommunicationTone)}
          className="space-y-3"
        >
          {TONE_OPTIONS.map((option) => (
            <div 
              key={option.tone} 
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                selectedTone === option.tone 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value={option.tone} id={option.tone} className="mt-1" />
              <div className="flex-1">
                <Label htmlFor={option.tone} className="flex items-center gap-2 cursor-pointer">
                  {option.tone === 'informal' ? (
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                  ) : (
                    <Building2 className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="font-medium">{option.label}</span>
                  {selectedTone === option.tone && (
                    <Badge variant="secondary" className="text-xs">Ativo</Badge>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        {showPreview && (
          <>
            <div className="pt-3 border-t">
              <Label className="text-xs text-muted-foreground">Prévia da mensagem</Label>
              <div className="mt-2 p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">{previewMessage.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{previewMessage.description}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
