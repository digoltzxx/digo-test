import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, User, Check, Archive, Clock, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import iconRoyalPayWhite from "@/assets/icon-royalpay-white.png";

// Component to load images from storage with signed URLs
const ImageFromStorage = ({ filePath }: { filePath: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Build full path if needed
        const fullPath = filePath.includes('chat-attachments/') ? filePath : `chat-attachments/${filePath}`;
        
        const { data, error } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(fullPath.replace('chat-attachments/', ''), 3600);

        if (error) throw error;
        setImageUrl(data.signedUrl);
      } catch (error) {
        console.error("Error loading image:", error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [filePath]);

  if (loading) {
    return <div className="w-40 h-32 bg-muted rounded-xl animate-pulse flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
    </div>;
  }

  if (!imageUrl) {
    return <span className="text-muted-foreground text-sm">📷 Imagem indisponível</span>;
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

// Helper function to render message content (text or image)
const renderMessageContent = (message: string) => {
  // Check for image format: [Imagem: filepath] or [Imagem: chat-attachments/filepath]
  const imageMatch = message.match(/\[Imagem: (?:chat-attachments\/)?([^\]]+)\]/);
  // Check for legacy format: [Imagem: https://...]
  const legacyMatch = message.match(/\[Imagem: (https?:\/\/[^\]]+)\]/);
  
  if (imageMatch && !legacyMatch) {
    const filePath = imageMatch[1];
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
  
  return <p className="text-sm">{message}</p>;
};

interface Conversation {
  user_id: string;
  session_id: string;
  user_name: string;
  user_email: string;
  last_message: string;
  last_message_at: string;
  started_at: string;
  message_count: number;
  unread_count: number;
  status: "active" | "archived";
}

interface Message {
  id: string;
  message: string;
  is_from_user: boolean;
  agent_name: string | null;
  created_at: string;
  read: boolean;
  session_id: string | null;
}

const AdminSuporte = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState("Suporte RoyalPay");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  useEffect(() => {
    fetchConversations();
    fetchAgentInfo();

    const channel = supabase
      .channel("admin_support_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => {
          fetchConversations();
          if (selectedConversation) {
            fetchMessages(selectedConversation.user_id, selectedConversation.status === "archived");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  const fetchAgentInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (profile?.full_name) {
        setAgentName(profile.full_name);
      }
    }
  };

  const fetchConversations = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by user_id only (not by session)
      const usersMap = new Map<string, any[]>();

      messagesData?.forEach((msg) => {
        if (!usersMap.has(msg.user_id)) {
          usersMap.set(msg.user_id, []);
        }
        usersMap.get(msg.user_id)!.push(msg);
      });

      // Get unique user IDs
      const userIds = [...usersMap.keys()];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      // Build conversations - separate active and archived
      const conversationsList: Conversation[] = [];

      usersMap.forEach((msgs, userId) => {
        const profile = profilesData?.find((p) => p.user_id === userId);
        
        // Separate active and archived messages
        const activeMessages = msgs.filter(m => m.archived_at === null);
        const archivedMessages = msgs.filter(m => m.archived_at !== null);
        
        // Add active conversation if has active messages
        if (activeMessages.length > 0) {
          const sortedActive = [...activeMessages].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const lastActiveMsg = activeMessages[0];
          const firstActiveMsg = sortedActive[0];
          const unreadCount = activeMessages.filter(m => m.is_from_user && !m.read).length;

          conversationsList.push({
            user_id: userId,
            session_id: "active",
            user_name: profile?.full_name || "Usuário",
            user_email: profile?.email || "",
            last_message: lastActiveMsg.message,
            last_message_at: lastActiveMsg.created_at,
            started_at: firstActiveMsg.created_at,
            message_count: activeMessages.length,
            unread_count: unreadCount,
            status: "active",
          });
        }
        
        // Add archived conversation if has archived messages
        if (archivedMessages.length > 0) {
          const sortedArchived = [...archivedMessages].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const lastArchivedMsg = archivedMessages[0];
          const firstArchivedMsg = sortedArchived[0];

          conversationsList.push({
            user_id: userId,
            session_id: "archived",
            user_name: profile?.full_name || "Usuário",
            user_email: profile?.email || "",
            last_message: lastArchivedMsg.message,
            last_message_at: lastArchivedMsg.created_at,
            started_at: firstArchivedMsg.created_at,
            message_count: archivedMessages.length,
            unread_count: 0,
            status: "archived",
          });
        }
      });

      // Sort by last message
      conversationsList.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );

      setConversations(conversationsList);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: string, isArchived: boolean) => {
    try {
      let query = supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      
      // Filter by archived status
      if (isArchived) {
        query = query.not("archived_at", "is", null);
      } else {
        query = query.is("archived_at", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read (only for active messages)
      if (!isArchived) {
        await supabase
          .from("support_messages")
          .update({ read: true })
          .eq("user_id", userId)
          .eq("is_from_user", true)
          .is("archived_at", null);

        fetchConversations();
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    fetchMessages(conv.user_id, conv.status === "archived");
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const { error } = await supabase.from("support_messages").insert({
        user_id: selectedConversation.user_id,
        message: newMessage.trim(),
        is_from_user: false,
        agent_name: agentName,
      });

      if (error) throw error;

      setNewMessage("");
      fetchMessages(selectedConversation.user_id, false);
      toast.success("Mensagem enviada");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const formatDuration = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  };

  const filteredConversations = conversations.filter(c => c.status === activeTab);

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="shrink-0 mb-6">
          <h1 className="text-3xl font-bold text-foreground">Suporte ao Cliente</h1>
          <p className="text-muted-foreground">Gerencie as conversas de suporte com os usuários</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* Conversations List */}
          <Card className="lg:col-span-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversas
              </CardTitle>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "archived")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="active" className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Ativas
                    {conversations.filter(c => c.status === "active").length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {conversations.filter(c => c.status === "active").length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="flex items-center gap-1">
                    <Archive className="w-3 h-3" />
                    Arquivadas
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full scrollbar-thin-blue">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {activeTab === "active" ? "Nenhuma conversa ativa" : "Nenhuma conversa arquivada"}
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <button
                      key={`${conv.user_id}-${conv.status}`}
                      onClick={() => handleSelectConversation(conv)}
                      className={`w-full p-4 text-left border-b border-border hover:bg-muted/50 transition-colors ${
                        selectedConversation?.user_id === conv.user_id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-accent-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{conv.user_name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {conv.status === "archived" && (
                                <Archive className="w-3 h-3 text-muted-foreground" />
                              )}
                              {conv.unread_count > 0 && (
                                <Badge variant="destructive" className="ml-1">
                                  {conv.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground break-all">{conv.user_email}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {conv.last_message}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(conv.last_message_at)} {formatTime(conv.last_message_at)}</span>
                            <span>•</span>
                            <span>{conv.message_count} msgs</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="border-b">
              {selectedConversation ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                      <User className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {selectedConversation.user_name}
                        {selectedConversation.status === "archived" && (
                          <Badge variant="secondary" className="text-xs">
                            <Archive className="w-3 h-3 mr-1" />
                            Arquivada
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation.user_email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Iniciada: {formatDate(selectedConversation.started_at)} {formatTime(selectedConversation.started_at)}</p>
                    <p>Duração: {formatDuration(selectedConversation.started_at, selectedConversation.last_message_at)}</p>
                  </div>
                </div>
              ) : (
                <CardTitle className="text-muted-foreground">
                  Selecione uma conversa
                </CardTitle>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              {selectedConversation ? (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.is_from_user ? "justify-start" : "justify-end"}`}
                        >
                          {msg.is_from_user ? (
                            <div className="flex gap-2 max-w-[80%]">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="bg-muted p-3 rounded-2xl rounded-tl-sm">
                                  {renderMessageContent(msg.message)}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(msg.created_at)}
                                  </span>
                                  {msg.read && (
                                    <Check className="w-3 h-3 text-green-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 max-w-[80%]">
                              <div className="text-right">
                                <span className="text-xs text-muted-foreground block mb-1 flex items-center justify-end gap-1">
                                  {msg.agent_name === "IA de Suporte" && (
                                    <Sparkles className="w-3 h-3 text-accent" />
                                  )}
                                  {msg.agent_name || "Suporte"}
                                </span>
                                <div className={`p-3 rounded-2xl rounded-tr-sm ${
                                  msg.agent_name === "IA de Suporte" 
                                    ? "bg-accent/20 border border-accent/30" 
                                    : "bg-blue-600 text-white"
                                }`}>
                                  {renderMessageContent(msg.message)}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(msg.created_at)}
                                </span>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                {msg.agent_name === "IA de Suporte" ? (
                                  <Sparkles className="w-4 h-4 text-accent-foreground" />
                                ) : (
                                  <img src={iconRoyalPayWhite} alt="RoyalPay" className="w-5 h-5 object-contain" />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {selectedConversation.status === "active" && (
                    <div className="p-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Digite sua resposta..."
                          className="flex-1"
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        />
                        <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700">
                          <Send className="w-4 h-4 mr-2" />
                          Enviar
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedConversation.status === "archived" && (
                    <div className="p-4 border-t border-border bg-muted/50 text-center">
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Archive className="w-4 h-4" />
                        Esta conversa foi arquivada e é somente leitura
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Selecione uma conversa para começar</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSuporte;
