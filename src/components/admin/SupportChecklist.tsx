import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  SUPPORT_CHECKLIST, 
  SupportChecklistItem,
  getFrontendMessage 
} from '@/lib/deliveryErrors';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  MessageSquare,
  CreditCard,
  Mail,
  Users,
  FileText,
  Package
} from 'lucide-react';

interface ChecklistAnswer {
  itemId: string;
  value: 'yes' | 'no' | 'na' | null;
}

const categoryIcons = {
  payment: CreditCard,
  delivery: Package,
  email: Mail,
  member_area: Users,
  subscription: RotateCcw,
  logs: FileText,
};

const categoryLabels = {
  payment: 'Pagamento',
  delivery: 'Entrega',
  email: 'Email',
  member_area: 'Área de Membros',
  subscription: 'Assinatura',
  logs: 'Logs',
};

export function SupportChecklist() {
  const [answers, setAnswers] = useState<ChecklistAnswer[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const sortedChecklist = [...SUPPORT_CHECKLIST].sort((a, b) => a.priority - b.priority);
  const currentItem = sortedChecklist[currentStep];

  const handleAnswer = (value: 'yes' | 'no' | 'na') => {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.itemId === currentItem.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { itemId: currentItem.id, value };
        return updated;
      }
      return [...prev, { itemId: currentItem.id, value }];
    });
  };

  const getCurrentAnswer = () => {
    return answers.find(a => a.itemId === currentItem?.id)?.value || null;
  };

  const goNext = () => {
    if (currentStep < sortedChecklist.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const reset = () => {
    setAnswers([]);
    setCurrentStep(0);
    setShowResult(false);
  };

  const getRecommendations = (): string[] => {
    const recs: string[] = [];
    
    answers.forEach(answer => {
      const item = SUPPORT_CHECKLIST.find(i => i.id === answer.itemId);
      if (!item?.followUp) return;
      
      if (answer.value === 'yes' && item.followUp.onYes) {
        recs.push(item.followUp.onYes);
      }
      if (answer.value === 'no' && item.followUp.onNo) {
        recs.push(item.followUp.onNo);
      }
    });
    
    return recs;
  };

  const getDiagnosis = () => {
    const paymentAnswer = answers.find(a => a.itemId === 'payment_status');
    const deliveryAnswer = answers.find(a => a.itemId === 'delivery_type');
    const errorAnswer = answers.find(a => a.itemId === 'error_logged');
    
    if (paymentAnswer?.value === 'no') {
      return {
        status: 'warning',
        title: 'Pagamento não confirmado',
        message: getFrontendMessage('PAYMENT_PENDING'),
      };
    }
    
    if (errorAnswer?.value === 'yes') {
      return {
        status: 'error',
        title: 'Erro identificado nos logs',
        message: {
          title: 'Verificar logs',
          description: 'Foi identificado um erro nos logs do sistema. Consulte os detalhes técnicos.',
          action: 'Escalar para equipe técnica se necessário.',
        },
      };
    }
    
    if (errorAnswer?.value === 'no' && paymentAnswer?.value === 'yes') {
      return {
        status: 'warning',
        title: 'Escalar para equipe técnica',
        message: {
          title: 'Análise técnica necessária',
          description: 'Pagamento confirmado mas sem erros registrados. Necessário investigação técnica.',
          action: 'Abrir ticket para equipe de desenvolvimento.',
        },
      };
    }
    
    return {
      status: 'success',
      title: 'Diagnóstico inconclusivo',
      message: {
        title: 'Revisar informações',
        description: 'Complete todas as etapas do checklist para um diagnóstico preciso.',
      },
    };
  };

  if (showResult) {
    const diagnosis = getDiagnosis();
    const recommendations = getRecommendations();
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Resultado do Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Diagnosis Result */}
          <div className={`p-4 rounded-lg ${
            diagnosis.status === 'success' ? 'bg-green-500/10 border border-green-500/20' :
            diagnosis.status === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
            'bg-red-500/10 border border-red-500/20'
          }`}>
            <div className="flex items-start gap-3">
              {diagnosis.status === 'success' && <CheckCircle2 className="h-6 w-6 text-green-500 mt-0.5" />}
              {diagnosis.status === 'warning' && <AlertTriangle className="h-6 w-6 text-yellow-500 mt-0.5" />}
              {diagnosis.status === 'error' && <XCircle className="h-6 w-6 text-red-500 mt-0.5" />}
              <div>
                <p className="font-semibold">{diagnosis.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{diagnosis.message.description}</p>
                {diagnosis.message.action && (
                  <p className="text-sm font-medium mt-2">{diagnosis.message.action}</p>
                )}
              </div>
            </div>
          </div>

          {/* Answers Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground">Respostas</h4>
            <div className="grid gap-2">
              {answers.map(answer => {
                const item = SUPPORT_CHECKLIST.find(i => i.id === answer.itemId);
                if (!item) return null;
                const Icon = categoryIcons[item.category];
                return (
                  <div key={answer.itemId} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.question}</span>
                    <Badge variant={answer.value === 'yes' ? 'default' : answer.value === 'no' ? 'destructive' : 'secondary'}>
                      {answer.value === 'yes' ? 'Sim' : answer.value === 'no' ? 'Não' : 'N/A'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Ações Recomendadas
              </h4>
              <ul className="space-y-1">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ArrowRight className="h-3 w-3 mt-1.5 text-blue-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={reset} variant="outline" className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Novo Diagnóstico
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!currentItem) return null;

  const Icon = categoryIcons[currentItem.category];
  const currentAnswer = getCurrentAnswer();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Checklist de Suporte
          </CardTitle>
          <Badge variant="outline">
            {currentStep + 1} de {sortedChecklist.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / sortedChecklist.length) * 100}%` }}
          />
        </div>

        {/* Current Question */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <Badge variant="secondary">{categoryLabels[currentItem.category]}</Badge>
          </div>
          
          <h3 className="text-lg font-semibold">{currentItem.question}</h3>
          
          <RadioGroup 
            value={currentAnswer || ''} 
            onValueChange={(v) => handleAnswer(v as 'yes' | 'no' | 'na')}
            className="grid gap-2"
          >
            {currentItem.options.map(option => (
              <div 
                key={option.value}
                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  currentAnswer === option.value 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => handleAnswer(option.value)}
              >
                <RadioGroupItem value={option.value} id={`${currentItem.id}-${option.value}`} />
                <Label 
                  htmlFor={`${currentItem.id}-${option.value}`}
                  className="flex-1 cursor-pointer font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={goPrev}
            disabled={currentStep === 0}
            className="flex-1"
          >
            Anterior
          </Button>
          <Button 
            onClick={goNext}
            disabled={!currentAnswer}
            className="flex-1"
          >
            {currentStep === sortedChecklist.length - 1 ? 'Ver Resultado' : 'Próximo'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
