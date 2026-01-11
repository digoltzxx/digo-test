import { useState, useEffect, useRef } from "react";
import { X, Send, Smile, Paperclip, Loader2, Sparkles, Trash2, RefreshCw, MessageCircle, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole } from "@/hooks/useAdminRole";
import iconRoyalPayWhite from "@/assets/icon-royalpay-white.png";
import iconRoyalPayChat from "@/assets/icon-royalpay-chat.png";

interface Message {
  id?: string;
  text: string;
  isUser: boolean;
  agentName?: string;
  created_at?: string;
  imageUrl?: string;
}

const faqData: Record<string, string> = {
  "Como sacar meu saldo?": "Para sacar seu saldo, acesse 'Minha Carteira' no menu lateral, verifique se você tem uma conta bancária cadastrada e clique em 'Solicitar Saque'. O prazo de processamento é de 1-3 dias úteis.",
  "Como criar um produto?": "Para criar um produto, clique no botão '+ Produtos' no topo da página e selecione 'Novo Produto Digital'. Preencha os dados como nome, preço, descrição e faça upload dos arquivos.",
  "Como funciona a comissão?": "A comissão é um percentual que você define para afiliados venderem seu produto. Quando uma venda é realizada através de um afiliado, ele recebe a comissão configurada automaticamente.",
  "Como me tornar afiliado?": "Acesse o 'Marketplace', encontre produtos que deseja promover e clique em 'Afiliar-se'. Após aprovação do produtor, você receberá seu link exclusivo de afiliado.",
};

const commonEmojis = ["😊", "👍", "❤️", "😂", "🎉", "✅", "🔥", "💪", "🙏", "👏", "😍", "🤔", "😅", "🚀", "💰", "📦"];

const commonStickers = ["🎁", "🏆", "💎", "⭐", "🌟", "💫", "✨", "🎯", "🔔", "💡", "📢", "🎊", "🎈", "💝", "🎀", "🌈"];

// Component to load images from private storage with signed URLs
const ImageFromStorage = ({ filePath }: { filePath: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSignedUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(filePath, 3600);
        
        if (error) throw error;
        setImageUrl(data.signedUrl);
      } catch (error) {
        console.error("Error loading image:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSignedUrl();
  }, [filePath]);

  if (loading) {
    return <div className="w-40 h-32 bg-slate-700/50 rounded-xl animate-pulse flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
    </div>;
  }

  if (!imageUrl) {
    return <span className="text-slate-400 text-sm">📷 Imagem indisponível</span>;
  }

  return (
    <img 
      src={imageUrl} 
      alt="Anexo" 
      className="max-w-full rounded-xl max-h-52 object-cover cursor-pointer shadow-lg hover:opacity-90 transition-opacity"
      onClick={() => window.open(imageUrl, "_blank")}
    />
  );
};

const LiveChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAdminRole();

  // Filter messages older than 1 hour for non-admin users
  const filterMessagesByTime = (msgs: Message[]): Message[] => {
    if (isAdmin) return msgs;
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return msgs.filter((msg) => {
      if (!msg.created_at) return true; // Keep messages without timestamp (welcome message)
      return new Date(msg.created_at) > oneHourAgo;
    });
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!userId || !isOpen) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", userId)
        .eq("chat_type", "support")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      if (data && data.length > 0) {
        // Filter out any AI messages that might have slipped through
        const supportOnlyData = data.filter((msg: any) => 
          msg.agent_name !== 'IA de Suporte' && 
          !msg.agent_name?.includes('IA')
        );
        
        const formattedMessages: Message[] = supportOnlyData.map((msg: any) => ({
          id: msg.id,
          text: msg.message,
          isUser: msg.is_from_user,
          agentName: msg.agent_name || "Suporte RoyalPay",
          created_at: msg.created_at,
        }));
        const filteredMessages = filterMessagesByTime(formattedMessages);
        if (filteredMessages.length > 0) {
          setMessages(filteredMessages);
        } else {
          setMessages([{ text: "Olá! Sou do suporte da RoyalPay. Como posso ajudar você hoje? 😊", isUser: false, agentName: "Suporte RoyalPay" }]);
        }
      } else {
        setMessages([{ text: "Olá! Sou do suporte da RoyalPay. Como posso ajudar você hoje? 😊", isUser: false, agentName: "Suporte RoyalPay" }]);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("support_messages_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Only show messages that are for support chat (not AI chat)
          if (!newMsg.is_from_user && newMsg.chat_type === 'support') {
            setMessages((prev) => [
              ...prev,
              {
                id: newMsg.id,
                text: newMsg.message,
                isUser: false,
                agentName: newMsg.agent_name || "Suporte RoyalPay",
                created_at: newMsg.created_at,
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isOpen, isAdmin]);

  const handleSend = async () => {
    if (!message.trim() || !userId) return;
    
    const newMessage = { text: message, isUser: true };
    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.from("support_messages").insert({
        user_id: userId,
        message: message.trim(),
        is_from_user: true,
        chat_type: "support",
      });

      if (error) throw error;
      toast.success("Mensagem enviada!");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setEmojiOpen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Apenas imagens são permitidas (JPG, PNG, GIF, WEBP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL instead of public URL for private bucket
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(fileName, 3600); // 1 hour expiration

      if (signedUrlError) throw signedUrlError;

      const imageUrl = signedUrlData.signedUrl;
      // Show image preview immediately in the chat
      const imageMessage = { text: `[Imagem: ${fileName}]`, isUser: true, imageUrl };
      setMessages((prev) => [...prev, imageMessage]);

      // Store just the file name (not full path) for regenerating signed URLs later
      const { error } = await supabase.from("support_messages").insert({
        user_id: userId,
        message: `[Imagem: ${fileName}]`,
        is_from_user: true,
        chat_type: "support",
      });

      if (error) throw error;
      toast.success("Imagem enviada!");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleStickerSelect = (sticker: string) => {
    setMessage((prev) => prev + sticker);
    setStickerOpen(false);
  };

  const handleFaqClick = (question: string) => {
    setMessages((prev) => [...prev, { text: question, isUser: true }]);
    
    // Mudar para a aba de chat para mostrar a resposta
    setActiveTab("chat");
    
    setTimeout(() => {
      const answer = faqData[question];
      setMessages((prev) => [
        ...prev,
        { text: answer, isUser: false, agentName: "Suporte" },
      ]);
    }, 500);
  };

  const renderMessageContent = (msg: Message) => {
    // Check for new format: [Imagem: userId/timestamp.ext] or [Imagem: chat-attachments/userId/timestamp.ext]
    const newFormatMatch = msg.text.match(/\[Imagem: (?:chat-attachments\/)?([^\]]+)\]/);
    // Check for legacy format: [Imagem: https://...]
    const legacyMatch = msg.text.match(/\[Imagem: (https?:\/\/[^\]]+)\]/);
    
    // If we have a direct imageUrl (for just-uploaded images), use it
    if (msg.imageUrl) {
      return (
        <img 
          src={msg.imageUrl} 
          alt="Anexo" 
          className="max-w-full rounded-xl max-h-52 object-cover cursor-pointer shadow-lg hover:opacity-90 transition-opacity"
          onClick={() => window.open(msg.imageUrl, "_blank")}
        />
      );
    }
    
    if (newFormatMatch && !legacyMatch) {
      const filePath = newFormatMatch[1];
      return <ImageFromStorage filePath={filePath} />;
    }
    
    if (legacyMatch) {
      return (
        <img 
          src={legacyMatch[1]} 
          alt="Anexo" 
          className="max-w-full rounded-xl max-h-52 object-cover cursor-pointer shadow-lg hover:opacity-90 transition-opacity"
          onClick={() => window.open(legacyMatch[1], "_blank")}
        />
      );
    }
    return msg.text;
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-110 ring-2 ring-blue-400/30 animate-[wiggle_3s_ease-in-out_infinite]"
        style={{ animation: 'wiggle 3s ease-in-out infinite' }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <img src={iconRoyalPayChat} alt="RoyalPay" className="w-8 h-8" />
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] h-[620px] max-h-[85vh] bg-gradient-to-b from-[#0f172a] via-[#0f172a] to-[#020617] border border-blue-500/30 rounded-3xl shadow-[0_0_15px_rgba(59,130,246,0.15),0_20px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Suporte ao Vivo</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    Atendente disponível
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setMessages([{ text: "Olá! Sou do suporte da RoyalPay. Como posso ajudar você hoje? 😊", isUser: false, agentName: "Suporte RoyalPay" }])}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                  title="Limpar conversa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                  title="Recarregar"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 py-3 bg-[#0f172a]/80">
              <TabsList className="bg-slate-800/60 w-full p-1 border border-slate-700/50 rounded-xl">
                <TabsTrigger 
                  value="chat" 
                  className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-400 text-xs font-medium transition-all duration-200 rounded-lg py-2"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                  Conversação
                </TabsTrigger>
                <TabsTrigger 
                  value="help" 
                  className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-400 text-xs font-medium transition-all duration-200 rounded-lg py-2"
                >
                  📖 Centro de ajuda
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden min-h-0">
              <ScrollArea className="flex-1 min-h-0 p-4 bg-gradient-to-b from-slate-900/50 to-slate-950 [&_[data-radix-scroll-area-scrollbar]]:w-2 [&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-thumb]]:bg-blue-500/50 [&_[data-radix-scroll-area-thumb]]:rounded-full">
                <div className="space-y-5 pr-2">
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex ${msg.isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      {!msg.isUser && (
                        <div className="flex gap-3 max-w-[90%]">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/20">
                            <MessageCircle className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs text-blue-400 font-medium block mb-1.5 flex items-center gap-1.5">
                              <MessageCircle className="w-3 h-3" />
                              {msg.agentName}
                            </span>
                            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 text-slate-100 p-4 rounded-2xl rounded-tl-sm text-sm border border-slate-700/50 shadow-lg backdrop-blur-sm leading-relaxed">
                              {renderMessageContent(msg)}
                            </div>
                            {msg.created_at && (
                              <span className="text-[10px] text-slate-500 mt-1.5 block">
                                {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {msg.isUser && (
                        <div className="max-w-[80%]">
                          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 rounded-2xl rounded-tr-sm text-sm shadow-lg shadow-blue-500/20 leading-relaxed">
                            {renderMessageContent(msg)}
                          </div>
                          {msg.created_at && (
                            <span className="text-[10px] text-slate-500 mt-1.5 block text-right">
                              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-slate-700/50 bg-gradient-to-t from-slate-900 to-slate-900/95 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2 bg-slate-800/80 rounded-2xl px-4 py-3 border border-slate-700/50 shadow-inner">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 text-sm placeholder:text-slate-500 text-white"
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    disabled={loading || uploading}
                  />
                  <div className="flex items-center gap-0.5">
                    {/* Emoji Picker */}
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                      <PopoverTrigger asChild>
                        <button 
                          className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
                          disabled={loading || uploading}
                          title="Emojis"
                        >
                          <Smile className="w-5 h-5 text-slate-400 hover:text-blue-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-auto p-3 bg-slate-800 border-slate-700 rounded-xl" 
                        side="top" 
                        align="center"
                        sideOffset={10}
                      >
                        <p className="text-xs text-slate-400 mb-2 font-medium">Emojis</p>
                        <div className="grid grid-cols-8 gap-1">
                          {commonEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="text-xl p-1.5 hover:bg-slate-700 rounded-lg transition-colors hover:scale-110"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Sticker Picker */}
                    <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
                      <PopoverTrigger asChild>
                        <button 
                          className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
                          disabled={loading || uploading}
                          title="Figurinhas"
                        >
                          <Sparkles className="w-5 h-5 text-slate-400 hover:text-yellow-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-auto p-3 bg-slate-800 border-slate-700 rounded-xl" 
                        side="top" 
                        align="center"
                        sideOffset={10}
                      >
                        <p className="text-xs text-slate-400 mb-2 font-medium">Figurinhas</p>
                        <div className="grid grid-cols-8 gap-1">
                          {commonStickers.map((sticker) => (
                            <button
                              key={sticker}
                              onClick={() => handleStickerSelect(sticker)}
                              className="text-2xl p-1.5 hover:bg-slate-700 rounded-lg transition-colors hover:scale-125"
                            >
                              {sticker}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Image Upload */}
                    <button 
                      className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || uploading}
                      title="Enviar imagem"
                    >
                      {uploading ? (
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      ) : (
                        <Image className="w-5 h-5 text-slate-400 hover:text-green-400" />
                      )}
                    </button>

                    <Button 
                      size="icon" 
                      onClick={handleSend} 
                      className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                      disabled={loading || uploading || !message.trim()}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  Chat limpa automaticamente após 1h sem atividade
                </p>
              </div>
            </TabsContent>

            <TabsContent value="help" className="flex-1 flex flex-col m-0 p-4 data-[state=inactive]:hidden bg-gradient-to-b from-slate-900/50 to-slate-950">
              <ScrollArea className="flex-1 [&_[data-radix-scroll-area-scrollbar]]:w-2 [&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-thumb]]:bg-blue-500/50 [&_[data-radix-scroll-area-thumb]]:rounded-full">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-3 text-white flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-400" />
                      Perguntas Frequentes
                    </h4>
                    <div className="space-y-2">
                      {Object.keys(faqData).map((question, index) => (
                        <button 
                          key={index}
                          onClick={() => handleFaqClick(question)}
                          className="w-full text-left p-4 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-blue-500/30 rounded-xl text-sm transition-all duration-200 text-slate-200 shadow-sm"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      Não encontrou? Inicie uma conversa na aba "Conversação"
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
};

export default LiveChatButton;