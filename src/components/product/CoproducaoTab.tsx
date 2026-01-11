import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, Loader2, Users, User, AlertTriangle, DollarSign, Percent, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoProducer {
  id: string;
  product_id: string;
  user_id: string;
  commission_percentage: number;
  commission_type: string;
  status: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface CoproducaoTabProps {
  productId: string;
}

const CoproducaoTab = ({ productId }: CoproducaoTabProps) => {
  const [coProducers, setCoProducers] = useState<CoProducer[]>([]);
  const [productPrice, setProductPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<CoProducer | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    commission_percentage: 10,
    commission_type: "percentage" as "percentage" | "fixed",
  });

  // Calculate total commission and validation
  const commissionSummary = useMemo(() => {
    const totalPercentage = coProducers
      .filter(cp => cp.commission_type === "percentage" || !cp.commission_type)
      .reduce((acc, cp) => acc + cp.commission_percentage, 0);

    const totalFixed = coProducers
      .filter(cp => cp.commission_type === "fixed")
      .reduce((acc, cp) => acc + cp.commission_percentage, 0);

    const producerPercentage = Math.max(0, 100 - totalPercentage);
    const isOverLimit = totalPercentage > 99 || (productPrice > 0 && totalFixed >= productPrice);

    return {
      totalPercentage,
      totalFixed,
      producerPercentage,
      isOverLimit,
    };
  }, [coProducers, productPrice]);

  useEffect(() => {
    fetchCoProducers();
    fetchProductPrice();
  }, [productId]);

  const fetchProductPrice = async () => {
    try {
      const { data } = await supabase
        .from("products")
        .select("price")
        .eq("id", productId)
        .single();
      
      if (data) {
        setProductPrice(data.price);
      }
    } catch (error) {
      console.error("Error fetching product price:", error);
    }
  };

  const fetchCoProducers = async () => {
    try {
      const { data, error } = await supabase
        .from("co_producers")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles for each co-producer
      if (data && data.length > 0) {
        const userIds = data.map(cp => cp.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        const enrichedData = data.map(cp => {
          const profile = profiles?.find(p => p.user_id === cp.user_id);
          return {
            ...cp,
            user_name: profile?.full_name || "Usuário",
            user_email: profile?.email || "",
          };
        });

        setCoProducers(enrichedData);
      } else {
        setCoProducers([]);
      }
    } catch (error) {
      console.error("Error fetching co-producers:", error);
      toast.error("Erro ao carregar coprodutores");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate based on commission type
    if (formData.commission_type === "percentage") {
      if (formData.commission_percentage < 1 || formData.commission_percentage > 99) {
        toast.error("Comissão percentual deve estar entre 1% e 99%");
        return;
      }
      
      // Validate total doesn't exceed 99%
      const currentTotal = coProducers
        .filter(cp => cp.id !== editingProducer?.id && (cp.commission_type === "percentage" || !cp.commission_type))
        .reduce((acc, cp) => acc + cp.commission_percentage, 0);
      
      if (currentTotal + formData.commission_percentage > 99) {
        toast.error(`Total de comissões excede 99%. Máximo disponível: ${99 - currentTotal}%`);
        return;
      }
    } else {
      // Fixed commission validation
      if (formData.commission_percentage < 0.01) {
        toast.error("Valor da comissão deve ser maior que R$ 0,01");
        return;
      }
      
      if (productPrice > 0 && formData.commission_percentage >= productPrice) {
        toast.error(`Valor fixo não pode exceder o preço do produto (R$ ${productPrice.toFixed(2)})`);
        return;
      }
    }

    if (editingProducer) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from("co_producers")
          .update({
            commission_percentage: formData.commission_percentage,
            commission_type: formData.commission_type,
          })
          .eq("id", editingProducer.id);

        if (error) throw error;
        toast.success("Coprodutor atualizado!");
        setDialogOpen(false);
        resetForm();
        fetchCoProducers();
      } catch (error) {
        console.error("Error updating co-producer:", error);
        toast.error("Erro ao atualizar coprodutor");
      } finally {
        setSaving(false);
      }
    } else {
      if (!formData.email.trim()) {
        toast.error("Email é obrigatório");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Email inválido");
        return;
      }

      setSaving(true);
      try {
        // Look up user by email in profiles
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", formData.email.toLowerCase())
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
          toast.error("Usuário não encontrado com este email");
          setSaving(false);
          return;
        }

        // Check if already a co-producer
        const existing = coProducers.find(cp => cp.user_id === profile.user_id);
        if (existing) {
          toast.error("Este usuário já é um coprodutor deste produto");
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("co_producers")
          .insert({
            product_id: productId,
            user_id: profile.user_id,
            commission_percentage: formData.commission_percentage,
            commission_type: formData.commission_type,
            status: "pending",
          });

        if (error) throw error;
        toast.success("Convite enviado ao coprodutor!");
        setDialogOpen(false);
        resetForm();
        fetchCoProducers();
      } catch (error) {
        console.error("Error adding co-producer:", error);
        toast.error("Erro ao adicionar coprodutor");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este coprodutor?")) return;

    try {
      const { error } = await supabase
        .from("co_producers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Coprodutor removido!");
      fetchCoProducers();
    } catch (error) {
      console.error("Error deleting co-producer:", error);
      toast.error("Erro ao remover coprodutor");
    }
  };

  const openEditDialog = (producer: CoProducer) => {
    setEditingProducer(producer);
    setFormData({
      email: "",
      commission_percentage: producer.commission_percentage,
      commission_type: (producer.commission_type as "percentage" | "fixed") || "percentage",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProducer(null);
    setFormData({
      email: "",
      commission_percentage: 10,
      commission_type: "percentage",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      active: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
    };
    const labels: Record<string, string> = {
      pending: "Pendente",
      active: "Ativo",
      rejected: "Recusado",
    };
    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#161b22] border-gray-800">
      <CardContent className="p-6">
        {/* Summary Section */}
        {coProducers.length > 0 && (
          <div className="mb-6 p-4 bg-[#0d1117] border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">Divisão de Comissões</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Coprodutores (%)</p>
                <p className="text-lg font-semibold text-purple-400">{commissionSummary.totalPercentage}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Produtor recebe</p>
                <p className="text-lg font-semibold text-green-400">{commissionSummary.producerPercentage}%</p>
              </div>
              {commissionSummary.totalFixed > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Fixo total</p>
                  <p className="text-lg font-semibold text-yellow-400">R$ {commissionSummary.totalFixed.toFixed(2)}</p>
                </div>
              )}
            </div>
            {commissionSummary.isOverLimit && (
              <Alert className="mt-3 bg-red-500/10 border-red-500/30">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <AlertDescription className="text-red-400 text-sm">
                  Soma das comissões excede o limite permitido!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Coprodução</h3>
            <p className="text-sm text-gray-500">Gerencie coprodutores e comissões</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Convidar Coprodutor
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#161b22] border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {editingProducer ? "Editar Coprodutor" : "Convidar Coprodutor"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!editingProducer && (
                  <div>
                    <Label className="text-gray-400">Email do Coprodutor *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="bg-[#0d1117] border-gray-700 text-white"
                      placeholder="email@exemplo.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      O usuário precisa ter uma conta na plataforma
                    </p>
                  </div>
                )}
                
                <div>
                  <Label className="text-gray-400">Tipo de Comissão</Label>
                  <Select
                    value={formData.commission_type}
                    onValueChange={(value: "percentage" | "fixed") => 
                      setFormData(prev => ({ ...prev, commission_type: value }))
                    }
                  >
                    <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-gray-700">
                      <SelectItem value="percentage">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          <span>Percentual (%)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="fixed">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>Valor Fixo (R$)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-400">
                    {formData.commission_type === "percentage" ? "Percentual de Comissão (%)" : "Valor Fixo (R$)"}
                  </Label>
                  <Input
                    type="number"
                    min={formData.commission_type === "percentage" ? 1 : 0.01}
                    max={formData.commission_type === "percentage" ? 99 : productPrice || 999999}
                    step={formData.commission_type === "percentage" ? 1 : 0.01}
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      commission_percentage: parseFloat(e.target.value) || 0 
                    }))}
                    className="bg-[#0d1117] border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.commission_type === "percentage" 
                      ? `Disponível: até ${99 - commissionSummary.totalPercentage + (editingProducer?.commission_percentage || 0)}%`
                      : `Valor máximo: R$ ${(productPrice || 0).toFixed(2)}`
                    }
                  </p>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving || commissionSummary.isOverLimit}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingProducer ? "Salvar Alterações" : "Enviar Convite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {coProducers.length === 0 ? (
          <div className="bg-[#0d1117] border border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center">
            <Users className="w-12 h-12 text-gray-500 mb-3" />
            <p className="text-sm text-gray-500 text-center">Nenhum coprodutor adicionado</p>
            <p className="text-xs text-gray-600 text-center mt-1">
              Convide coprodutores para dividir comissões
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {coProducers.map((producer) => (
              <div
                key={producer.id}
                className="bg-[#0d1117] border border-gray-700 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{producer.user_name || "Coprodutor"}</h4>
                    <p className="text-sm text-gray-400">{producer.user_email}</p>
                    <p className="text-xs text-purple-400 mt-0.5">
                      {producer.commission_type === "fixed" 
                        ? `R$ ${producer.commission_percentage.toFixed(2)} fixo`
                        : `${producer.commission_percentage}% de comissão`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(producer.status)}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                    onClick={() => openEditDialog(producer)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-gray-400 hover:text-red-400"
                    onClick={() => handleDelete(producer.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CoproducaoTab;
