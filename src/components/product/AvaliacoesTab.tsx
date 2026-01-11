import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Loader2, Star, Check, X, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Review {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string | null;
  rating: number;
  review_text: string | null;
  status: string;
  is_featured: boolean;
}

interface AvaliacoesTabProps {
  productId: string;
}

const AvaliacoesTab = ({ productId }: AvaliacoesTabProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    rating: 5,
    review_text: "",
    status: "pending",
    is_featured: false,
  });

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error("Erro ao carregar avaliações");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.customer_name.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        rating: formData.rating,
        review_text: formData.review_text || null,
        status: formData.status,
        is_featured: formData.is_featured,
      };

      if (editingReview) {
        const { error } = await supabase
          .from("product_reviews")
          .update(payload)
          .eq("id", editingReview.id);

        if (error) throw error;
        toast.success("Avaliação atualizada!");
      } else {
        const { error } = await supabase
          .from("product_reviews")
          .insert({ ...payload, product_id: productId });

        if (error) throw error;
        toast.success("Avaliação adicionada!");
      }

      setDialogOpen(false);
      resetForm();
      fetchReviews();
    } catch (error) {
      console.error("Error saving review:", error);
      toast.error("Erro ao salvar avaliação");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta avaliação?")) return;

    try {
      const { error } = await supabase
        .from("product_reviews")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Avaliação excluída!");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Erro ao excluir avaliação");
    }
  };

  const handleUpdateStatus = async (review: Review, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("product_reviews")
        .update({ status: newStatus })
        .eq("id", review.id);

      if (error) throw error;
      fetchReviews();
      toast.success(`Avaliação ${newStatus === "approved" ? "aprovada" : "rejeitada"}!`);
    } catch (error) {
      console.error("Error updating review status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const openEditDialog = (review: Review) => {
    setEditingReview(review);
    setFormData({
      customer_name: review.customer_name,
      customer_email: review.customer_email || "",
      rating: review.rating,
      review_text: review.review_text || "",
      status: review.status,
      is_featured: review.is_featured,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingReview(null);
    setFormData({
      customer_name: "",
      customer_email: "",
      rating: 5,
      review_text: "",
      status: "pending",
      is_featured: false,
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      approved: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
    };
    const labels: Record<string, string> = {
      pending: "Pendente",
      approved: "Aprovada",
      rejected: "Rejeitada",
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Avaliações</h3>
            <p className="text-sm text-gray-500">Gerencie avaliações dos clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Avaliação
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#161b22] border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {editingReview ? "Editar Avaliação" : "Nova Avaliação"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400">Nome do Cliente *</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="bg-[#0d1117] border-gray-700 text-white"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Email (opcional)</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                    className="bg-[#0d1117] border-gray-700 text-white"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Avaliação</Label>
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= formData.rating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-600 hover:text-yellow-400"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Comentário</Label>
                  <Textarea
                    value={formData.review_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, review_text: e.target.value }))}
                    className="bg-[#0d1117] border-gray-700 text-white"
                    placeholder="Comentário do cliente..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-gray-700">
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="approved">Aprovada</SelectItem>
                      <SelectItem value="rejected">Rejeitada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingReview ? "Salvar Alterações" : "Adicionar Avaliação"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {reviews.length === 0 ? (
          <div className="bg-[#0d1117] border border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center">
            <MessageSquare className="w-12 h-12 text-gray-500 mb-3" />
            <p className="text-sm text-gray-500 text-center">Nenhuma avaliação ainda</p>
            <p className="text-xs text-gray-600 text-center mt-1">
              Adicione avaliações de clientes para aumentar a credibilidade
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-[#0d1117] border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-white font-medium">{review.customer_name}</h4>
                      {renderStars(review.rating)}
                      {getStatusBadge(review.status)}
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-gray-400 line-clamp-2">{review.review_text}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {review.status === "pending" && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/20"
                          onClick={() => handleUpdateStatus(review, "approved")}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          onClick={() => handleUpdateStatus(review, "rejected")}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-400 hover:text-white"
                      onClick={() => openEditDialog(review)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-400 hover:text-red-400"
                      onClick={() => handleDelete(review.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AvaliacoesTab;
