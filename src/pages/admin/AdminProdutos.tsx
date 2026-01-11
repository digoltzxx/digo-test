import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, MoreVertical, Eye, Pencil, Ban, Trash2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  product_type: string;
  status: string;
  payment_type: string;
  marketplace_enabled: boolean;
  created_at: string;
  image_url: string | null;
  commission_percentage: number | null;
  sales_page_url: string | null;
  sac_name: string | null;
  sac_email: string | null;
  sales_count?: number;
  total_revenue?: number;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

const AdminProdutos = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    commission_percentage: "",
    marketplace_enabled: false,
    status: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel('admin-products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchProducts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set(productsData?.map((p) => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      // Fetch sales for each product (includes pending and approved for deletion blocking)
      const { data: salesData } = await supabase
        .from("sales")
        .select("product_id, amount, status")
        .in("product_id", productsData?.map(p => p.id) || []);

      const blockingStatuses = ["completed", "approved", "paid", "pending", "waiting_payment", "in_analysis", "authorized"];

      const productsWithData = productsData?.map((p) => {
        const productSalesForRevenue = salesData?.filter(s => s.product_id === p.id && s.status === 'completed') || [];
        const productSalesForBlocking = salesData?.filter(s => s.product_id === p.id && blockingStatuses.includes(s.status)) || [];
        return {
          ...p,
          profile: profiles?.find((pr) => pr.user_id === p.user_id),
          sales_count: productSalesForBlocking.length,
          total_revenue: productSalesForRevenue.reduce((sum, s) => sum + Number(s.amount), 0),
        };
      });

      setProducts(productsWithData || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from("products")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Produto ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso`);
      fetchProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Erro ao atualizar produto");
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    // Find the product to check sales count
    const product = products.find(p => p.id === productToDelete);
    
    // Block deletion if product has sales (approved or pending)
    if (product && (product.sales_count || 0) > 0) {
      toast.error("Este produto não pode ser excluído porque possui vendas registradas ou pendentes. Para preservar a integridade dos dados e o histórico de compradores, apenas edição é permitida.");
      setShowDeleteDialog(false);
      setProductToDelete(null);
      return;
    }

    try {
      const { error } = await supabase.from("products").delete().eq("id", productToDelete);

      if (error) throw error;

      toast.success("Produto removido com sucesso");
      setShowDeleteDialog(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao remover produto");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0 hover:bg-emerald-500/30">● Ativo</Badge>;
      case "draft":
        return <Badge className="bg-gray-500/20 text-gray-400 border-0 hover:bg-gray-500/30">● Rascunho</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-0 hover:bg-yellow-500/30">● Pendente</Badge>;
      case "inactive":
        return <Badge className="bg-gray-500/20 text-gray-400 border-0 hover:bg-gray-500/30">● Inativo</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-0">{status}</Badge>;
    }
  };

  const categories = [...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalSales = products.reduce((sum, p) => sum + (p.sales_count || 0), 0);

  const formatPrice = (product: Product) => {
    if (product.payment_type === 'subscription') {
      return `${formatCurrency(product.price)}/mês`;
    }
    return formatCurrency(product.price);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciar Produtos</h1>
          <p className="text-muted-foreground">Visualize e gerencie todos os produtos da plataforma</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Produtos</p>
              <p className="text-2xl font-bold text-primary">{products.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold text-emerald-400">{products.filter(p => p.status === 'active').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Vendas</p>
              <p className="text-2xl font-bold text-yellow-400">{totalSales.toLocaleString('pt-BR')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48 bg-card border-border">
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-36 bg-card border-border">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pendente</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">PRODUTO</TableHead>
                  <TableHead className="text-muted-foreground">CATEGORIA</TableHead>
                  <TableHead className="text-muted-foreground">PREÇO</TableHead>
                  <TableHead className="text-muted-foreground text-center">VENDAS</TableHead>
                  <TableHead className="text-muted-foreground">FATURAMENTO</TableHead>
                  <TableHead className="text-muted-foreground">STATUS</TableHead>
                  <TableHead className="text-muted-foreground text-right">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.profile?.full_name || "N/A"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.category}</TableCell>
                      <TableCell className="text-foreground">{formatPrice(product)}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{product.sales_count || 0}</TableCell>
                      <TableCell className="text-primary font-medium">{formatCurrency(product.total_revenue || 0)}</TableCell>
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowDetailsDialog(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2 text-primary" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProduct(product);
                                setEditFormData({
                                  name: product.name,
                                  description: product.description || "",
                                  price: product.price.toString(),
                                  category: product.category,
                                  commission_percentage: product.commission_percentage?.toString() || "30",
                                  marketplace_enabled: product.marketplace_enabled || false,
                                  status: product.status,
                                });
                                setShowEditDialog(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(product.id, product.status)}
                              className="cursor-pointer"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              {product.status === 'active' ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            {isAdmin && (
                              (product.sales_count || 0) > 0 ? (
                                <div 
                                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed opacity-50" 
                                  title="Este produto não pode ser excluído porque possui vendas registradas ou pendentes. Para preservar a integridade dos dados e o histórico de compradores, apenas edição é permitida."
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  Remover
                                </div>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setProductToDelete(product.id);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Product Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Detalhes do Produto</DialogTitle>
            <p className="text-sm text-muted-foreground">Informações completas do produto</p>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Header with Image */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-lg">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.profile?.full_name || "N/A"}</p>
                  <div className="mt-1">{getStatusBadge(selectedProduct.status)}</div>
                </div>
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm text-foreground">{selectedProduct.description}</p>
                </div>
              )}

              {/* Product Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p className="font-medium text-foreground">{selectedProduct.category}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-medium text-foreground">{selectedProduct.product_type === 'digital' ? 'Digital' : 'Físico'}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Preço</p>
                  <p className="font-medium text-foreground">{formatPrice(selectedProduct)}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Comissão Afiliado</p>
                  <p className="font-medium text-foreground">{selectedProduct.commission_percentage || 30}%</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Vendas</p>
                  <p className="font-medium text-foreground">{selectedProduct.sales_count || 0}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="font-medium text-primary">{formatCurrency(selectedProduct.total_revenue || 0)}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Marketplace</p>
                  <p className="font-medium text-foreground">{selectedProduct.marketplace_enabled ? 'Habilitado' : 'Desabilitado'}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(selectedProduct.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* SAC Info */}
              {(selectedProduct.sac_name || selectedProduct.sac_email) && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Suporte ao Cliente (SAC)</p>
                  <p className="text-sm text-foreground">{selectedProduct.sac_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.sac_email}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Fechar
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    setEditFormData({
                      name: selectedProduct.name,
                      description: selectedProduct.description || "",
                      price: selectedProduct.price.toString(),
                      category: selectedProduct.category,
                      commission_percentage: selectedProduct.commission_percentage?.toString() || "30",
                      marketplace_enabled: selectedProduct.marketplace_enabled || false,
                      status: selectedProduct.status,
                    });
                    setShowEditDialog(true);
                  }}
                >
                  Editar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Editar Produto</DialogTitle>
            <p className="text-sm text-muted-foreground">Atualize as informações do produto</p>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Image Preview */}
              <div className="flex items-center gap-4">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-foreground">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {selectedProduct.id.slice(0, 8)}...</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground">Nome do Produto</Label>
                  <Input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="mt-1 bg-muted/30 border-border"
                  />
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Descrição</Label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="mt-1 bg-muted/30 border-border min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Preço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editFormData.price}
                      onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                      className="mt-1 bg-muted/30 border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Comissão Afiliado (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editFormData.commission_percentage}
                      onChange={(e) => setEditFormData({ ...editFormData, commission_percentage: e.target.value })}
                      className="mt-1 bg-muted/30 border-border"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Select value={editFormData.status} onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}>
                    <SelectTrigger className="mt-1 bg-muted/30 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Marketplace</p>
                    <p className="text-xs text-muted-foreground">Permitir que afiliados vendam este produto</p>
                  </div>
                  <Switch
                    checked={editFormData.marketplace_enabled}
                    onCheckedChange={(checked) => setEditFormData({ ...editFormData, marketplace_enabled: checked })}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={() => setShowEditDialog(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={isSaving}
                  onClick={async () => {
                    if (!selectedProduct) return;
                    setIsSaving(true);
                    try {
                      const { error } = await supabase
                        .from("products")
                        .update({
                          name: editFormData.name,
                          description: editFormData.description || null,
                          price: parseFloat(editFormData.price) || 0,
                          commission_percentage: parseFloat(editFormData.commission_percentage) || 30,
                          marketplace_enabled: editFormData.marketplace_enabled,
                          status: editFormData.status,
                        })
                        .eq("id", selectedProduct.id);

                      if (error) throw error;

                      toast.success("Produto atualizado com sucesso");
                      setShowEditDialog(false);
                      fetchProducts();
                    } catch (error) {
                      console.error("Error updating product:", error);
                      toast.error("Erro ao atualizar produto");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminProdutos;
