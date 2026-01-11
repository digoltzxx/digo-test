import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Users, 
  RefreshCcw, 
  DollarSign, 
  TrendingUp,
  CalendarCheck,
  Clock,
  AlertCircle,
  XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  user_id: string;
  product_id: string;
  status: string;
  plan_interval: string;
  amount: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  products: {
    id: string;
    name: string;
    image_url: string | null;
  } | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const Assinaturas = () => {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch subscription products owned by user
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("user_id", user.id)
        .eq("payment_type", "subscription");

      if (productsError) throw productsError;

      if (products && products.length > 0) {
        const productIds = products.map(p => p.id);

        // Fetch subscriptions for seller's products
        const { data: subs, error: subsError } = await supabase
          .from("subscriptions")
          .select(`
            *,
            products:product_id (
              id,
              name,
              image_url
            )
          `)
          .in("product_id", productIds)
          .order("created_at", { ascending: false });

        if (subsError) throw subsError;
        setSubscriptions(subs || []);
      } else {
        setSubscriptions([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as assinaturas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from a single source of truth
  const stats = useMemo(() => {
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    const canceledSubscriptions = subscriptions.filter(s => s.status === 'canceled');
    
    const activeSubscribers = activeSubscriptions.length;
    const mrr = activeSubscriptions.reduce((sum, s) => sum + Number(s.amount), 0);
    
    // Renovations: active subscriptions where period start is after creation date
    const renewals = activeSubscriptions.filter(s => {
      const start = new Date(s.created_at);
      const periodStart = new Date(s.current_period_start);
      return periodStart > start;
    }).length;
    
    // Churn rate: canceled / (active + canceled) * 100
    const totalRelevant = activeSubscribers + canceledSubscriptions.length;
    const churnRate = totalRelevant > 0 
      ? Number(((canceledSubscriptions.length / totalRelevant) * 100).toFixed(1))
      : 0;

    return { activeSubscribers, mrr, renewals, churnRate };
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => 
    subscriptions.filter(sub =>
      sub.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.id.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [subscriptions, searchQuery]
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd && status === 'active') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Cancelando</Badge>;
    }
    
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativa</Badge>;
      case "pending":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Pendente</Badge>;
      case "past_due":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Em atraso</Badge>;
      case "canceled":
        return <Badge className="bg-muted/50 text-muted-foreground border-muted">Cancelada</Badge>;
      case "expired":
        return <Badge className="bg-muted/50 text-muted-foreground border-muted">Expirada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getIntervalLabel = (interval: string) => {
    switch (interval) {
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      case 'yearly': return 'Anual';
      default: return interval;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CalendarCheck className="w-4 h-4 text-emerald-400" />;
      case "pending":
        return <Clock className="w-4 h-4 text-blue-400" />;
      case "past_due":
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case "canceled":
      case "expired":
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <CalendarCheck className="w-4 h-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assinaturas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie assinaturas e recorrências dos seus produtos
          </p>
        </div>

        {/* Stats KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-card/60 border-border/40">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Skeleton className="w-11 h-11 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-12" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10">
                    <Users className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.activeSubscribers}</p>
                    <p className="text-xs text-muted-foreground">Assinantes ativos</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-sky-500/10">
                    <DollarSign className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(stats.mrr)}</p>
                    <p className="text-xs text-muted-foreground">MRR (Receita Mensal)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-violet-500/10">
                    <RefreshCcw className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.renewals}</p>
                    <p className="text-xs text-muted-foreground">Renovações</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/40">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-rose-500/10">
                    <TrendingUp className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.churnRate}%</p>
                    <p className="text-xs text-muted-foreground">Taxa de cancelamento</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar assinaturas por produto ou ID..." 
            className="pl-10 bg-card/40 border-border/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Content */}
        {loading ? (
          <Card className="bg-card/60 border-border/40">
            <CardContent className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
              </div>
            </CardContent>
          </Card>
        ) : filteredSubscriptions.length === 0 ? (
          <Card className="bg-card/60 border-border/40">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-full bg-sky-500/10 mb-4">
                <Users className="w-8 h-8 text-sky-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma assinatura ainda</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Quando clientes assinarem seus produtos, as assinaturas aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Assinaturas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredSubscriptions.map((sub) => (
                  <div 
                    key={sub.id} 
                    className="p-4 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        {sub.products?.image_url ? (
                          <img 
                            src={sub.products.image_url} 
                            alt={sub.products.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                            {getStatusIcon(sub.status)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">{sub.products?.name || 'Produto'}</p>
                            {getStatusBadge(sub.status, sub.cancel_at_period_end)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ID: {sub.id.slice(0, 8)}... • {getIntervalLabel(sub.plan_interval)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCurrency(sub.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Renovação: {formatDate(sub.current_period_end)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Assinaturas;
