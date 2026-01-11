import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  CreditCard,
  BookOpen,
  Shield,
  Save,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfileData {
  full_name: string;
  email: string;
  document_number: string | null;
}

interface Enrollment {
  id: string;
  status: string;
  enrolled_at: string;
  expires_at: string | null;
  course: {
    name: string;
  };
  product: {
    name: string;
  };
}

interface Purchase {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  product: {
    name: string;
  };
}

export default function AlunoPerfil() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    email: "",
    document_number: null,
  });
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, document_number")
        .eq("user_id", user.id)
        .single();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          email: profileData.email || user.email || "",
          document_number: profileData.document_number,
        });
      }

      const email = profileData?.email || user.email;
      if (!email) return;

      // Get student
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("email", email);

      if (!students || students.length === 0) {
        setLoading(false);
        return;
      }

      const studentIds = students.map(s => s.id);

      // Get enrollments
      const { data: enrollmentData } = await supabase
        .from("enrollments")
        .select(`
          id,
          status,
          enrolled_at,
          expires_at,
          courses (name),
          products:product_id (name)
        `)
        .in("student_id", studentIds)
        .order("enrolled_at", { ascending: false });

      if (enrollmentData) {
        setEnrollments(
          enrollmentData.map((e: any) => ({
            id: e.id,
            status: e.status,
            enrolled_at: e.enrolled_at,
            expires_at: e.expires_at,
            course: { name: e.courses?.name || "Curso" },
            product: { name: e.products?.name || "Produto" },
          }))
        );
      }

      // Get purchases
      const { data: purchaseData } = await supabase
        .from("sales")
        .select(`
          id,
          amount,
          status,
          payment_method,
          created_at,
          products:product_id (name)
        `)
        .eq("buyer_email", email)
        .order("created_at", { ascending: false });

      if (purchaseData) {
        setPurchases(
          purchaseData.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            status: p.status,
            payment_method: p.payment_method,
            created_at: p.created_at,
            product: { name: p.products?.name || "Produto" },
          }))
        );
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Ativo</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Aprovado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
      case "cancelled":
      case "revoked":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/aluno")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Meu Perfil</h1>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="enrollments">
              <BookOpen className="h-4 w-4 mr-2" />
              Matrículas
            </TabsTrigger>
            <TabsTrigger value="purchases">
              <CreditCard className="h-4 w-4 mr-2" />
              Compras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={profile.full_name}
                        onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                        className="pl-10"
                        placeholder="Seu nome completo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={profile.email}
                        disabled
                        className="pl-10 bg-muted"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document">CPF/CNPJ</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="document"
                        value={profile.document_number || ""}
                        disabled
                        className="pl-10 bg-muted"
                        placeholder="Não informado"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrollments">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Minhas Matrículas</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Você não possui matrículas</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{enrollment.course.name}</p>
                          <p className="text-sm text-muted-foreground">{enrollment.product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Matriculado em {formatDate(enrollment.enrolled_at)}
                            {enrollment.expires_at && (
                              <span>• Expira em {formatDate(enrollment.expires_at)}</span>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(enrollment.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Histórico de Compras</CardTitle>
              </CardHeader>
              <CardContent>
                {purchases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma compra encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{purchase.product.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatCurrency(purchase.amount)}</span>
                            <span>•</span>
                            <span className="capitalize">{purchase.payment_method}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(purchase.created_at)}
                          </div>
                        </div>
                        {getStatusBadge(purchase.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
