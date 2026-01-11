import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, Mail, Clock, HelpCircle, Bot, RefreshCw, Sparkles, Trash2, Phone } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

const faqs = [
  {
    question: "Como faço para criar um produto?",
    answer: "Vá até 'Meus Produtos' no menu lateral e clique em 'Novo Produto'. Preencha as informações do seu produto e clique em criar."
  },
  {
    question: "Qual o prazo para receber meus saques?",
    answer: "Os saques são processados em até 24 horas úteis após a solicitação. O valor será depositado via PIX na conta cadastrada."
  },
  {
    question: "Como funciona o programa de afiliados?",
    answer: "Você pode convidar afiliados para vender seus produtos. Cada venda realizada por um afiliado gera uma comissão definida por você."
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer: "Aceitamos PIX, cartão de crédito e boleto bancário. Os clientes podem parcelar em até 12x no cartão."
  },
];

interface Message {
  id: string;
  message: string;
  is_from_user: boolean;
  created_at: string;
  agent_name?: string | null;
  session_id?: string | null;
}

const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Keywords that trigger WhatsApp button
const HUMAN_SUPPORT_KEYWORDS = [
  "não resolveu",
  "nao resolveu",
  "quero falar com um atendente",
  "suporte humano",
  "atendimento",
  "falar com humano",
  "pessoa real",
  "atendente",
  "não ajudou",
  "nao ajudou",
  "não funcionou",
  "nao funcionou",
];

// Error/generic responses from AI that trigger WhatsApp button
const AI_ERROR_PATTERNS = [
  "não consegui processar",
  "nao consegui processar",
  "ocorreu um erro",
  "tente novamente",
  "não entendi",
  "nao entendi",
  "não possuo informações",
  "nao possuo informacoes",
  "gerente irá atendê-lo",
];

const WHATSAPP_NUMBER = "5521967247433";
const WHATSAPP_MESSAGE = encodeURIComponent("Olá, preciso de ajuda com o suporte.");

const Suporte = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<Date>(new Date());
  const [showWhatsAppButton, setShowWhatsAppButton] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadUserAndMessages();
  }, []);

  // Check for session timeout every minute
  useEffect(() => {
    const checkTimeout = () => {
      const now = new Date();
      const timeSinceLastActivity = now.getTime() - lastActivityTime.getTime();
      
      if (timeSinceLastActivity >= SESSION_TIMEOUT_MS && messages.length > 0) {
        archiveAndClearSession();
      }
    };

    const interval = setInterval(checkTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastActivityTime, messages.length]);

  // Check if WhatsApp button should be shown based on messages
  useEffect(() => {
    if (messages.length === 0) {
      setShowWhatsAppButton(false);
      setFailedAttempts(0);
      return;
    }

    const lastMessage = messages[messages.length - 1];
    
    // Check if user requested human support
    if (lastMessage.is_from_user) {
      const lowerMessage = lastMessage.message.toLowerCase();
      const requestedHuman = HUMAN_SUPPORT_KEYWORDS.some(keyword => 
        lowerMessage.includes(keyword)
      );
      if (requestedHuman) {
        setShowWhatsAppButton(true);
        return;
      }
    }

    // Check if AI response indicates error or inability to help
    if (!lastMessage.is_from_user) {
      const lowerMessage = lastMessage.message.toLowerCase();
      const isErrorResponse = AI_ERROR_PATTERNS.some(pattern => 
        lowerMessage.includes(pattern)
      );
      if (isErrorResponse) {
        setShowWhatsAppButton(true);
        return;
      }
    }

    // Show after 3 failed attempts (AI responses without resolution keywords)
    if (failedAttempts >= 3) {
      setShowWhatsAppButton(true);
    }
  }, [messages, failedAttempts]);

  const loadUserAndMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      await loadActiveSession(user.id);
    }
  };

  const loadActiveSession = async (uid: string) => {
    // Get only non-archived messages from the last hour
    const oneHourAgo = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();
    
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", uid)
      .eq("chat_type", "ai")
      .is("archived_at", null)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: true });
    
    if (data && data.length > 0) {
      setMessages(data);
      setSessionId(data[0].session_id);
      // Set last activity to the most recent message
      const lastMsg = data[data.length - 1];
      setLastActivityTime(new Date(lastMsg.created_at));
    } else {
      // No active session, create new one
      setMessages([]);
      setSessionId(crypto.randomUUID());
    }
  };

  const archiveAndClearSession = async () => {
    if (!userId || messages.length === 0) return;

    try {
      // Archive current session messages
      const messageIds = messages.map(m => m.id);
      await supabase
        .from("support_messages")
        .update({ archived_at: new Date().toISOString() })
        .in("id", messageIds);

      // Clear local state and create new session
      setMessages([]);
      setSessionId(crypto.randomUUID());
      setLastActivityTime(new Date());
      setShowWhatsAppButton(false);
      setFailedAttempts(0);

      toast({
        title: "Sessão encerrada",
        description: "Sua conversa foi arquivada. Inicie uma nova conversa.",
      });
    } catch (error) {
      console.error("Error archiving session:", error);
    }
  };

  const clearChat = async () => {
    if (messages.length === 0) return;
    
    await archiveAndClearSession();
  };

  const getAiResponse = async (userMessage: string): Promise<string> => {
    try {
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.is_from_user ? "user" : "assistant",
        content: msg.message,
      }));

      const { data, error } = await supabase.functions.invoke("support-ai", {
        body: { 
          message: userMessage,
          conversationHistory,
        },
      });

      if (error) throw error;
      
      const reply = data?.reply || "Desculpe, não consegui processar sua mensagem. Tente novamente.";
      
      // Check if this is an error/unhelpful response
      const lowerReply = reply.toLowerCase();
      const isUnhelpful = AI_ERROR_PATTERNS.some(pattern => lowerReply.includes(pattern));
      if (isUnhelpful) {
        setFailedAttempts(prev => prev + 1);
      }
      
      return reply;
    } catch (error) {
      console.error("AI response error:", error);
      setShowWhatsAppButton(true); // Show WhatsApp on error
      return "Ocorreu um erro ao processar sua mensagem. Clique no botão abaixo para falar com nosso suporte via WhatsApp.";
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !userId) return;
    
    setLoading(true);
    const userMessage = message.trim();
    setMessage("");
    setLastActivityTime(new Date()); // Reset activity timer

    // Check if user is requesting human support
    const lowerMessage = userMessage.toLowerCase();
    const requestedHuman = HUMAN_SUPPORT_KEYWORDS.some(keyword => 
      lowerMessage.includes(keyword)
    );
    if (requestedHuman) {
      setShowWhatsAppButton(true);
    }

    try {
      // Save user message with session
      const { data: savedMessage, error: messageError } = await supabase
        .from("support_messages")
        .insert({
          user_id: userId,
          message: userMessage,
          is_from_user: true,
          session_id: sessionId,
          chat_type: "ai",
        })
        .select()
        .single();

      if (messageError) throw messageError;

      setMessages(prev => [...prev, savedMessage]);
      setIsAiTyping(true);

      // Get AI response
      const aiResponse = await getAiResponse(userMessage);

      // Save AI response with same session
      const { data: aiMessage, error: aiError } = await supabase
        .from("support_messages")
        .insert({
          user_id: userId,
          message: aiResponse,
          is_from_user: false,
          agent_name: "IA de Suporte",
          session_id: sessionId,
          chat_type: "ai",
        })
        .select()
        .single();

      setIsAiTyping(false);
      setLastActivityTime(new Date()); // Reset activity timer

      if (!aiError && aiMessage) {
        setMessages(prev => [...prev, aiMessage]);
      }

      toast({
        title: "Mensagem enviada!",
        description: "A IA respondeu sua dúvida.",
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      setIsAiTyping(false);
      setShowWhatsAppButton(true); // Show WhatsApp on error
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const handleWhatsAppClick = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Suporte</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tire dúvidas com nossa IA ou receba suporte personalizado
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold">IA de Suporte</p>
                <p className="text-xs text-muted-foreground">Resposta instantânea</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Mail className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">E-mail</p>
                <p className="text-xs text-muted-foreground">contato@royalpaybr.com</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold">Horário</p>
                <p className="text-xs text-muted-foreground">Seg-Sex, 9h-18h</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat Area */}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Conversa com IA
                </span>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearChat}
                      title="Limpar conversa"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => userId && loadActiveSession(userId)}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages */}
              <ScrollArea className="h-[300px] pr-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Sparkles className="w-12 h-12 mb-2 opacity-50" />
                    <p className="text-sm">Olá! Sou a IA de Suporte</p>
                    <p className="text-xs">Pergunte qualquer coisa sobre a plataforma!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_from_user ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.is_from_user
                              ? "bg-accent text-accent-foreground"
                              : "bg-secondary/50 border border-border/30"
                          }`}
                        >
                          {!msg.is_from_user && msg.agent_name && (
                            <div className="flex items-center gap-1 mb-1">
                              <Sparkles className="w-3 h-3 text-accent" />
                              <span className="text-xs font-medium text-accent">{msg.agent_name}</span>
                            </div>
                          )}
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.is_from_user ? "text-accent-foreground/70" : "text-muted-foreground"}`}>
                            {formatDate(msg.created_at)} • {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isAiTyping && (
                      <div className="flex justify-start">
                        <div className="bg-secondary/50 border border-border/30 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-accent animate-pulse" />
                            <span className="text-xs text-muted-foreground">IA está digitando...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* WhatsApp Button - Conditional */}
              {showWhatsAppButton && (
                <div className="p-4 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-sm text-muted-foreground mb-3">
                    Não conseguimos resolver sua dúvida? Fale diretamente com nosso suporte:
                  </p>
                  <Button
                    onClick={handleWhatsAppClick}
                    className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium"
                  >
                    <svg 
                      className="w-5 h-5 mr-2" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Falar com o Suporte no WhatsApp
                  </Button>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Pergunte algo à IA..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  className="flex-1 resize-none"
                  disabled={loading || isAiTyping}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={loading || !message.trim() || isAiTyping}
                  className="bg-accent hover:bg-accent/90"
                >
                  {loading || isAiTyping ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Chat limpa automaticamente após 1h sem atividade</span>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-accent" />
                Perguntas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {/* WhatsApp CTA Block - Replaces old IA info block */}
              <div className="mt-6 p-4 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <svg 
                    className="w-4 h-4 text-[#25D366]" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Suporte via WhatsApp
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Precisa de atendimento humano? Fale diretamente com nossa equipe de suporte.
                </p>
                <Button
                  onClick={handleWhatsAppClick}
                  size="sm"
                  className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium"
                >
                  <svg 
                    className="w-4 h-4 mr-2" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Falar com o Suporte
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Suporte;
