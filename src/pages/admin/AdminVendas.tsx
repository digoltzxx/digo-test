import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, getValueColorClass, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminAllPeriodsMetrics from "@/components/admin/AdminAllPeriodsMetrics";

interface Sale {
  id: string;
  transaction_id: string;
  seller_user_id: string;
  product_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_document: string | null;
  amount: number;
  commission_amount: number;
  platform_fee: number;
  payment_fee: number;
  net_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  product?: {
    name: string;
  };
  seller?: {
    full_name: string | null;
    email: string | null;
  };
}

const AdminVendas = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchSales();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('admin-sales-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        fetchSales();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSales = async () => {
    try {
      const { data: salesData, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch products and sellers
      const productIds = [...new Set(salesData?.map((s) => s.product_id) || [])];
      const sellerIds = [...new Set(salesData?.map((s) => s.seller_user_id) || [])];

      const [{ data: products }, { data: sellers }] = await Promise.all([
        supabase.from("products").select("id, name").in("id", productIds),
        supabase.from("profiles").select("*").in("user_id", sellerIds),
      ]);

      const salesWithDetails = salesData?.map((s) => ({
        ...s,
        product: products?.find((p) => p.id === s.product_id),
        seller: sellers?.find((se) => se.user_id === s.seller_user_id),
      }));

      setSales(salesWithDetails || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0 hover:bg-emerald-500/30">● Concluída</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-0 hover:bg-yellow-500/30">● Pendente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-0 hover:bg-red-500/30">● Cancelada</Badge>;
      case "refunded":
        return <Badge className="bg-gray-500/20 text-gray-400 border-0 hover:bg-gray-500/30">● Reembolsada</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-0">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "pix":
        return "PIX";
      case "credit_card":
        return "Cartão";
      case "boleto":
        return "Boleto";
      default:
        return method;
    }
  };

  const filteredSales = sales.filter((s) => {
    const matchesSearch = 
      s.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.buyer_email.toLowerCase().includes(search.toLowerCase()) ||
      s.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
      s.product?.name?.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && s.status === statusFilter;
  });

  const completedSales = sales.filter(s => s.status === 'completed');
  const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalCommissions = completedSales.reduce((sum, s) => sum + Number(s.commission_amount), 0);
  const avgTicket = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">Visualize todas as vendas da plataforma</p>
        </div>

        {/* Métricas de vendas: DIA | SEMANA | MÊS com filtros */}
        <AdminAllPeriodsMetrics />

        {/* Filters and Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-semibold">Lista de vendas ({filteredSales.length})</h2>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por comprador, ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/30 border-border"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 bg-muted/30 border-border">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="approved">Aprovada</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="refunded">Reembolsada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">ID</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Comprador</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Produto</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Vendedor</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Valor Bruto</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Taxa Plat.</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Taxa Adq.</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Comissão</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Líquido</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Pagamento</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Status</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => {
                    const isApproved = sale.status === 'completed' || sale.status === 'approved';
                    return (
                      <TableRow key={sale.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{sale.transaction_id.slice(0, 10)}...</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sale.buyer_name}</p>
                            <p className="text-xs text-blue-400">{sale.buyer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{sale.product?.name || "N/A"}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sale.seller?.full_name || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">{sale.seller?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{formatCurrency(sale.amount)}</TableCell>
                        <TableCell className="text-red-400">
                          {isApproved ? `-${formatCurrency(sale.platform_fee || 0)}` : '-'}
                        </TableCell>
                        <TableCell className="text-orange-400">
                          {isApproved ? `-${formatCurrency(sale.payment_fee || 0)}` : '-'}
                        </TableCell>
                        <TableCell className="text-purple-400">
                          {isApproved ? `-${formatCurrency(sale.commission_amount)}` : '-'}
                        </TableCell>
                        <TableCell className={cn("font-medium", isApproved ? getValueColorClass(sale.net_amount || 0) : "text-muted-foreground")}>
                          {isApproved ? formatCurrency(sale.net_amount || 0) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{getPaymentMethodLabel(sale.payment_method)}</TableCell>
                        <TableCell>{getStatusBadge(sale.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminVendas;
