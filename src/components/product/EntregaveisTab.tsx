import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, Package, Mail, Link, FileText, Trash2, Edit2,
  GripVertical, Users, CheckCircle, Clock, XCircle,
  Upload, RefreshCw, AlertCircle, Download, Eye, X
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EntregaveisTabProps {
  productId: string;
}

interface Deliverable {
  id: string;
  product_id: string;
  delivery_type: string;
  name: string;
  description: string | null;
  content_url: string | null;
  email_subject: string | null;
  email_body: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  max_downloads: number | null;
  link_delivery_method: string | null;
  download_count: number | null;
  is_active: boolean;
  position: number;
}

interface DeliveryLog {
  id: string;
  sale_id: string | null;
  user_email: string;
  user_name: string | null;
  delivery_type: string;
  delivery_status: string;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string;
  retry_count: number | null;
}

interface MemberAccess {
  id: string;
  user_email: string;
  user_name: string | null;
  access_status: string;
  granted_at: string;
  last_accessed_at: string | null;
}

const EntregaveisTab = ({ productId }: EntregaveisTabProps) => {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [memberAccess, setMemberAccess] = useState<MemberAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    delivery_type: 'member_access',
    name: '',
    description: '',
    content_url: '',
    email_subject: '',
    email_body: '',
    file_url: '',
    file_name: '',
    file_size: 0,
    file_type: '',
    max_downloads: 0,
    link_delivery_method: 'both',
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deliverablesRes, logsRes, accessRes] = await Promise.all([
        supabase
          .from('product_deliverables')
          .select('*')
          .eq('product_id', productId)
          .order('position', { ascending: true }),
        supabase
          .from('delivery_logs')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('member_access')
          .select('*')
          .eq('product_id', productId)
          .order('granted_at', { ascending: false })
          .limit(100),
      ]);

      if (deliverablesRes.data) setDeliverables(deliverablesRes.data as Deliverable[]);
      if (logsRes.data) setDeliveryLogs(logsRes.data as DeliveryLog[]);
      if (accessRes.data) setMemberAccess(accessRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (formData.delivery_type === 'email') {
      if (!formData.email_subject.trim()) {
        errors.email_subject = 'Assunto é obrigatório';
      }
      if (!formData.email_body.trim()) {
        errors.email_body = 'Corpo do email é obrigatório';
      }
    }

    if (formData.delivery_type === 'external_link') {
      if (!formData.content_url.trim()) {
        errors.content_url = 'URL é obrigatória';
      } else if (!isValidUrl(formData.content_url)) {
        errors.content_url = 'URL inválida';
      }
    }

    if (formData.delivery_type === 'file') {
      if (!formData.file_url && !editingDeliverable?.file_url) {
        errors.file_url = 'Arquivo é obrigatório';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      const payload: any = {
        product_id: productId,
        delivery_type: formData.delivery_type,
        name: formData.name,
        description: formData.description || null,
        content_url: formData.content_url || null,
        email_subject: formData.email_subject || null,
        email_body: formData.email_body || null,
        file_url: formData.file_url || null,
        file_name: formData.file_name || null,
        file_size: formData.file_size || null,
        file_type: formData.file_type || null,
        max_downloads: formData.max_downloads || 0,
        link_delivery_method: formData.link_delivery_method || 'both',
        is_active: formData.is_active,
        position: editingDeliverable ? editingDeliverable.position : deliverables.length,
      };

      if (editingDeliverable) {
        const { error } = await supabase
          .from('product_deliverables')
          .update(payload)
          .eq('id', editingDeliverable.id);
        
        if (error) throw error;
        toast.success('Entregável atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('product_deliverables')
          .insert(payload);
        
        if (error) throw error;
        toast.success('Entregável criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving deliverable:', error);
      toast.error('Erro ao salvar entregável');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este entregável? Esta ação não pode ser desfeita.')) return;
    
    try {
      const { error } = await supabase
        .from('product_deliverables')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Entregável excluído');
      fetchData();
    } catch (error) {
      console.error('Error deleting deliverable:', error);
      toast.error('Erro ao excluir');
    }
  };

  const handleToggleActive = async (deliverable: Deliverable) => {
    try {
      const { error } = await supabase
        .from('product_deliverables')
        .update({ is_active: !deliverable.is_active })
        .eq('id', deliverable.id);
      
      if (error) throw error;
      toast.success(deliverable.is_active ? 'Entregável desativado' : 'Entregável ativado');
      fetchData();
    } catch (error) {
      console.error('Error toggling deliverable:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleEdit = (deliverable: Deliverable) => {
    setEditingDeliverable(deliverable);
    setFormData({
      delivery_type: deliverable.delivery_type,
      name: deliverable.name,
      description: deliverable.description || '',
      content_url: deliverable.content_url || '',
      email_subject: deliverable.email_subject || '',
      email_body: deliverable.email_body || '',
      file_url: deliverable.file_url || '',
      file_name: deliverable.file_name || '',
      file_size: deliverable.file_size || 0,
      file_type: deliverable.file_type || '',
      max_downloads: deliverable.max_downloads || 0,
      link_delivery_method: deliverable.link_delivery_method || 'both',
      is_active: deliverable.is_active,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingDeliverable(null);
    setFormData({
      delivery_type: 'member_access',
      name: '',
      description: '',
      content_url: '',
      email_subject: '',
      email_body: '',
      file_url: '',
      file_name: '',
      file_size: 0,
      file_type: '',
      max_downloads: 0,
      link_delivery_method: 'both',
      is_active: true,
    });
    setFormErrors({});
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/zip', 'video/mp4', 'audio/mpeg', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use: PDF, ZIP, MP4, MP3, PNG ou JPG');
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 100MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      }));

      toast.success('Arquivo carregado com sucesso!');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao carregar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleRetryDelivery = async (log: DeliveryLog) => {
    try {
      // Call the process-deliverables edge function to retry
      const { error } = await supabase.functions.invoke('process-deliverables', {
        body: {
          saleId: log.sale_id,
          productId: productId,
          retryLogId: log.id,
        }
      });

      if (error) throw error;
      toast.success('Tentativa de reenvio iniciada');
      fetchData();
    } catch (error) {
      console.error('Error retrying delivery:', error);
      toast.error('Erro ao tentar reenviar');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'member_access': return <Users className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'external_link': return <Link className="w-4 h-4" />;
      case 'file': return <FileText className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'member_access': return 'Área de Membros';
      case 'email': return 'Email Personalizado';
      case 'external_link': return 'Link Externo';
      case 'file': return 'Arquivo para Download';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Sucesso</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Falhou</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const activeDeliverables = deliverables.filter(d => d.is_active).length;
  const completedDeliveries = deliveryLogs.filter(l => l.delivery_status === 'completed').length;
  const failedDeliveries = deliveryLogs.filter(l => l.delivery_status === 'failed').length;
  const activeMembers = memberAccess.filter(m => m.access_status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#161b22] border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{activeDeliverables}</p>
                <p className="text-sm text-gray-400">Entregáveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161b22] border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{completedDeliveries}</p>
                <p className="text-sm text-gray-400">Entregas OK</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161b22] border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{failedDeliveries}</p>
                <p className="text-sm text-gray-400">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161b22] border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{activeMembers}</p>
                <p className="text-sm text-gray-400">Membros Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deliverables List */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <CardTitle className="text-lg text-white">Entregáveis do Produto</CardTitle>
            <p className="text-sm text-gray-400 mt-1">Configure o que será entregue ao cliente após a compra</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1117] border-gray-700 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white text-xl">
                  {editingDeliverable ? 'Editar Entregável' : 'Novo Entregável'}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Configure o que será entregue ao cliente após a compra.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-5 py-4">
                {/* Delivery Type */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Tipo de Entrega *</Label>
                  <Select 
                    value={formData.delivery_type} 
                    onValueChange={(v) => setFormData({...formData, delivery_type: v})}
                  >
                    <SelectTrigger className="bg-[#161b22] border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b22] border-gray-600">
                      <SelectItem value="member_access">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-400" />
                          <span>Área de Membros</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-green-400" />
                          <span>Email Personalizado</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="external_link">
                        <div className="flex items-center gap-2">
                          <Link className="w-4 h-4 text-purple-400" />
                          <span>Link Externo</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="file">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-orange-400" />
                          <span>Arquivo para Download</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {formData.delivery_type === 'member_access' && 'Concede acesso automático à área de membros do produto'}
                    {formData.delivery_type === 'email' && 'Envia um email personalizado após a confirmação do pagamento'}
                    {formData.delivery_type === 'external_link' && 'Disponibiliza um link externo para o cliente'}
                    {formData.delivery_type === 'file' && 'Disponibiliza um arquivo para download após a compra'}
                  </p>
                </div>
                
                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Nome do Entregável *</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Acesso ao Curso Completo"
                    className={`bg-[#161b22] border-gray-600 text-white ${formErrors.name ? 'border-red-500' : ''}`}
                  />
                  {formErrors.name && <p className="text-xs text-red-400">{formErrors.name}</p>}
                </div>
                
                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Descrição (opcional)</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descreva o que está sendo entregue ao cliente"
                    rows={2}
                    className="bg-[#161b22] border-gray-600 text-white resize-none"
                  />
                </div>
                
                {/* External Link Fields */}
                {formData.delivery_type === 'external_link' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-gray-300">URL *</Label>
                      <Input 
                        value={formData.content_url}
                        onChange={(e) => setFormData({...formData, content_url: e.target.value})}
                        placeholder="https://exemplo.com/conteudo"
                        className={`bg-[#161b22] border-gray-600 text-white ${formErrors.content_url ? 'border-red-500' : ''}`}
                      />
                      {formErrors.content_url && <p className="text-xs text-red-400">{formErrors.content_url}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Como entregar o link?</Label>
                      <Select 
                        value={formData.link_delivery_method} 
                        onValueChange={(v) => setFormData({...formData, link_delivery_method: v})}
                      >
                        <SelectTrigger className="bg-[#161b22] border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161b22] border-gray-600">
                          <SelectItem value="client_area">Mostrar na área do cliente</SelectItem>
                          <SelectItem value="email">Enviar por email</SelectItem>
                          <SelectItem value="both">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* Email Fields */}
                {formData.delivery_type === 'email' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Assunto do Email *</Label>
                      <Input 
                        value={formData.email_subject}
                        onChange={(e) => setFormData({...formData, email_subject: e.target.value})}
                        placeholder="Seu acesso ao {{produto}} está liberado!"
                        className={`bg-[#161b22] border-gray-600 text-white ${formErrors.email_subject ? 'border-red-500' : ''}`}
                      />
                      {formErrors.email_subject && <p className="text-xs text-red-400">{formErrors.email_subject}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Corpo do Email *</Label>
                      <Textarea 
                        value={formData.email_body}
                        onChange={(e) => setFormData({...formData, email_body: e.target.value})}
                        placeholder="Olá {{nome}}, sua compra do {{produto}} foi confirmada..."
                        rows={6}
                        className={`bg-[#161b22] border-gray-600 text-white resize-none ${formErrors.email_body ? 'border-red-500' : ''}`}
                      />
                      {formErrors.email_body && <p className="text-xs text-red-400">{formErrors.email_body}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-700" onClick={() => setFormData({...formData, email_body: formData.email_body + '{{nome}}'})}>{'{{nome}}'}</Badge>
                        <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-700" onClick={() => setFormData({...formData, email_body: formData.email_body + '{{email}}'})}>{'{{email}}'}</Badge>
                        <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-700" onClick={() => setFormData({...formData, email_body: formData.email_body + '{{produto}}'})}>{'{{produto}}'}</Badge>
                        <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-700" onClick={() => setFormData({...formData, email_body: formData.email_body + '{{data_compra}}'})}>{'{{data_compra}}'}</Badge>
                      </div>
                    </div>
                  </>
                )}
                
                {/* File Upload Fields */}
                {formData.delivery_type === 'file' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Arquivo *</Label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.zip,.mp4,.mp3,.png,.jpg,.jpeg"
                        onChange={handleFileUpload}
                      />
                      
                      {formData.file_url || editingDeliverable?.file_url ? (
                        <div className="p-4 rounded-lg bg-[#161b22] border border-gray-600">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-8 h-8 text-blue-400" />
                              <div>
                                <p className="text-sm font-medium text-white">{formData.file_name || editingDeliverable?.file_name}</p>
                                <p className="text-xs text-gray-400">{formatFileSize(formData.file_size || editingDeliverable?.file_size || 0)}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => setFormData({...formData, file_url: '', file_name: '', file_size: 0, file_type: ''})}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${formErrors.file_url ? 'border-red-500' : 'border-gray-600 hover:border-gray-500'}`}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                              <p className="text-sm text-gray-400">Carregando arquivo...</p>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-10 h-10 mx-auto text-gray-500 mb-3" />
                              <p className="text-sm text-gray-400">Clique para selecionar ou arraste o arquivo</p>
                              <p className="text-xs text-gray-500 mt-1">PDF, ZIP, MP4, MP3, PNG, JPG (máx. 100MB)</p>
                            </>
                          )}
                        </div>
                      )}
                      {formErrors.file_url && <p className="text-xs text-red-400">{formErrors.file_url}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Limite de downloads (0 = ilimitado)</Label>
                      <Input 
                        type="number"
                        min="0"
                        value={formData.max_downloads}
                        onChange={(e) => setFormData({...formData, max_downloads: parseInt(e.target.value) || 0})}
                        className="bg-[#161b22] border-gray-600 text-white w-32"
                      />
                    </div>
                  </>
                )}
                
                {/* Status */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#161b22] border border-gray-700">
                  <div>
                    <Label className="text-gray-300">Status</Label>
                    <p className="text-xs text-gray-500">
                      {formData.is_active ? 'Ativo - será processado automaticamente' : 'Inativo - não será entregue'}
                    </p>
                  </div>
                  <Switch 
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({...formData, is_active: v})}
                  />
                </div>
              </div>
              
              <DialogFooter className="border-t border-gray-700 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingDeliverable ? 'Salvar Alterações' : 'Adicionar Entregável'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {deliverables.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Nenhum entregável configurado</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Adicione o que será entregue após a compra. Pode ser acesso à área de membros, emails personalizados, links ou arquivos.
              </p>
              <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Entregável
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {deliverables.map((d) => (
                <div 
                  key={d.id} 
                  className="flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-gray-600 cursor-move" />
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      d.delivery_type === 'member_access' ? 'bg-blue-500/20' :
                      d.delivery_type === 'email' ? 'bg-green-500/20' :
                      d.delivery_type === 'external_link' ? 'bg-purple-500/20' :
                      'bg-orange-500/20'
                    }`}>
                      {getTypeIcon(d.delivery_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{d.name}</p>
                        {!d.is_active && (
                          <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-400">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                          {getTypeLabel(d.delivery_type)}
                        </Badge>
                        {d.delivery_type === 'file' && d.download_count !== null && d.download_count > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {d.download_count} downloads
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={d.is_active}
                      onCheckedChange={() => handleToggleActive(d)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(d)} className="text-gray-400 hover:text-white">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-white">Entregas Recentes</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Histórico de entregas processadas</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} className="border-gray-600">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {deliveryLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
              <p>Nenhuma entrega registrada ainda</p>
              <p className="text-sm text-gray-500">As entregas aparecerão aqui após as vendas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto">
              {deliveryLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                        log.delivery_status === 'completed' ? 'bg-green-500/20' :
                        log.delivery_status === 'failed' ? 'bg-red-500/20' :
                        'bg-yellow-500/20'
                      }`}>
                        {log.delivery_status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : log.delivery_status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{log.user_name || log.user_email}</p>
                          {getStatusBadge(log.delivery_status)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {getTypeLabel(log.delivery_type)} • {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {log.error_message && (
                          <div className="flex items-start gap-2 mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-400">{log.error_message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {log.delivery_status === 'failed' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRetryDelivery(log)}
                        className="border-gray-600 text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reenviar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members with Access */}
      {memberAccess.length > 0 && (
        <Card className="bg-[#161b22] border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-4">
            <CardTitle className="text-lg text-white">Membros com Acesso</CardTitle>
            <p className="text-sm text-gray-400 mt-1">Usuários com acesso ativo à área de membros</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800 max-h-[300px] overflow-y-auto">
              {memberAccess.slice(0, 20).map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{member.user_name || member.user_email}</p>
                      <p className="text-xs text-gray-500">{member.user_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={member.access_status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400'}>
                      {member.access_status === 'active' ? 'Ativo' : member.access_status}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {member.last_accessed_at 
                        ? `Último acesso: ${formatDistanceToNow(new Date(member.last_accessed_at), { addSuffix: true, locale: ptBR })}`
                        : `Liberado: ${formatDistanceToNow(new Date(member.granted_at), { addSuffix: true, locale: ptBR })}`
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EntregaveisTab;
