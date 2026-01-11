import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { FileText, CheckCircle, XCircle, Clock, Eye, Search, User, Trash2, Image } from "lucide-react";

interface Document {
  id: string;
  user_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  signedUrl?: string;
}

interface UserWithDocuments {
  user_id: string;
  full_name: string | null;
  email: string | null;
  verification_status: string;
  documents: Document[];
}

const documentTypeLabels: Record<string, string> = {
  'identity_front': 'Documento - Frente',
  'identity_back': 'Documento - Verso',
  'selfie': 'Selfie com Documento',
};

const AdminDocumentos = () => {
  const [usersWithDocs, setUsersWithDocs] = useState<UserWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithDocuments | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteDocModalOpen, setDeleteDocModalOpen] = useState(false);
  const [imageViewModalOpen, setImageViewModalOpen] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const getSignedUrl = async (filePath: string) => {
    try {
      // Extract bucket and path - file_url format: user_id/filename
      const { data, error } = await supabase.storage
        .from('user-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }
      return data?.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data: docsData, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(docsData?.map(d => d.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, verification_status')
        .in('user_id', userIds);

      // Get signed URLs for all documents
      const docsWithSignedUrls = await Promise.all(
        (docsData || []).map(async (doc) => {
          const signedUrl = await getSignedUrl(doc.file_url);
          return { ...doc, signedUrl };
        })
      );

      // Group documents by user
      const userDocsMap = new Map<string, UserWithDocuments>();
      
      docsWithSignedUrls.forEach(doc => {
        const profile = profilesData?.find(p => p.user_id === doc.user_id);
        
        if (!userDocsMap.has(doc.user_id)) {
          userDocsMap.set(doc.user_id, {
            user_id: doc.user_id,
            full_name: profile?.full_name || null,
            email: profile?.email || null,
            verification_status: profile?.verification_status || 'pending',
            documents: []
          });
        }
        
        userDocsMap.get(doc.user_id)?.documents.push(doc);
      });

      setUsersWithDocs(Array.from(userDocsMap.values()));
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleApproveDoc = async (doc: Document, userDoc: UserWithDocuments) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('documents')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', doc.id);

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: userDoc.user_id,
          title: 'Documento aprovado!',
          message: `Seu ${documentTypeLabels[doc.document_type]} foi aprovado.`,
          type: 'success',
          link: '/dashboard/configuracoes?tab=documentos'
        });

      // Check if all documents are now approved
      const { data: userDocs } = await supabase
        .from('documents')
        .select('status, document_type')
        .eq('user_id', userDoc.user_id);

      const allApproved = userDocs && 
        ['identity_front', 'identity_back', 'selfie'].every(type => 
          userDocs.some(d => d.document_type === type && d.status === 'approved')
        );

      if (allApproved) {
        await supabase
          .from('profiles')
          .update({ verification_status: 'approved' })
          .eq('user_id', userDoc.user_id);

        await supabase
          .from('notifications')
          .insert({
            user_id: userDoc.user_id,
            title: '🎉 Parabéns! Conta verificada!',
            message: 'Todos os seus documentos foram aprovados com sucesso. Sua conta está totalmente liberada para utilizar todas as funcionalidades da plataforma!',
            type: 'success',
            link: '/dashboard'
          });
      }

      toast({
        title: "Documento aprovado",
        description: "O usuário foi notificado.",
      });

      fetchDocuments();
    } catch (error: any) {
      console.error('Error approving document:', error);
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveAll = async (userDoc: UserWithDocuments) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const pendingDocs = userDoc.documents.filter(d => d.status === 'pending');
      
      for (const doc of pendingDocs) {
        await supabase
          .from('documents')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', doc.id);
      }

      await supabase
        .from('profiles')
        .update({ verification_status: 'approved' })
        .eq('user_id', userDoc.user_id);

      await supabase
        .from('notifications')
        .insert({
          user_id: userDoc.user_id,
          title: '🎉 Parabéns! Conta verificada!',
          message: 'Todos os seus documentos foram aprovados com sucesso. Sua conta está totalmente liberada para utilizar todas as funcionalidades da plataforma!',
          type: 'success',
          link: '/dashboard'
        });

      toast({
        title: "Documentos aprovados",
        description: "Todos os documentos foram aprovados e a conta foi liberada.",
      });

      fetchDocuments();
      setViewModalOpen(false);
    } catch (error: any) {
      console.error('Error approving documents:', error);
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDoc = async () => {
    if (!selectedDoc || !selectedUser) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('user-documents')
        .remove([selectedDoc.file_url]);

      // Delete from database
      await supabase
        .from('documents')
        .delete()
        .eq('id', selectedDoc.id);

      // Notify user
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedUser.user_id,
          title: 'Documento removido',
          message: `Seu ${documentTypeLabels[selectedDoc.document_type]} foi removido. Por favor, envie novamente.`,
          type: 'warning',
          link: '/dashboard/configuracoes?tab=documentos'
        });

      // Update profile status back to pending
      await supabase
        .from('profiles')
        .update({ verification_status: 'pending' })
        .eq('user_id', selectedUser.user_id);

      toast({
        title: "Documento excluído",
        description: "O usuário foi notificado para enviar novamente.",
      });

      setDeleteDocModalOpen(false);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectDoc = async () => {
    if (!selectedDoc || !rejectionReason.trim() || !selectedUser) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update document status
      const { error: docError } = await supabase
        .from('documents')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedDoc.id);

      if (docError) throw docError;

      // Update profile verification status
      await supabase
        .from('profiles')
        .update({ verification_status: 'rejected' })
        .eq('user_id', selectedUser.user_id);

      // Create notification for user
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedUser.user_id,
          title: 'Documento rejeitado',
          message: `Seu ${documentTypeLabels[selectedDoc.document_type]} foi rejeitado. Motivo: ${rejectionReason}`,
          type: 'error',
          link: '/dashboard/configuracoes?tab=documentos'
        });

      toast({
        title: "Documento rejeitado",
        description: "O usuário foi notificado.",
      });

      setRejectionReason("");
      setRejectModalOpen(false);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedUser) return;

    try {
      // Delete all documents from storage
      for (const doc of selectedUser.documents) {
        const match = doc.file_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (match) {
          const [, bucket, path] = match;
          await supabase.storage.from(bucket).remove([path]);
        }
      }

      // Delete documents from database
      await supabase
        .from('documents')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Delete profile
      await supabase
        .from('profiles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Delete notifications
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', selectedUser.user_id);

      toast({
        title: "Conta excluída",
        description: "A conta do usuário foi removida do sistema.",
      });

      setDeleteModalOpen(false);
      setViewModalOpen(false);
      setSelectedUser(null);
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: "Erro ao excluir conta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Rejeitado</Badge>;
      case 'submitted':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Aguardando</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs"><CheckCircle className="w-3 h-3" /></Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs"><XCircle className="w-3 h-3" /></Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs"><Clock className="w-3 h-3" /></Badge>;
    }
  };

  const filteredUsers = usersWithDocs.filter(userDoc => {
    const matchesSearch = 
      userDoc.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userDoc.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending') {
      return matchesSearch && userDoc.documents.some(d => d.status === 'pending');
    }
    if (filterStatus === 'approved') {
      return matchesSearch && userDoc.verification_status === 'approved';
    }
    if (filterStatus === 'rejected') {
      return matchesSearch && userDoc.verification_status === 'rejected';
    }
    return matchesSearch;
  });

  const pendingCount = usersWithDocs.filter(u => u.documents.some(d => d.status === 'pending')).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
            <p className="text-muted-foreground">Gerencie a verificação de documentos dos usuários</p>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-lg px-4 py-2">
              {pendingCount} usuário{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={filterStatus === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('pending')}
                >
                  Pendentes
                </Button>
                <Button
                  variant={filterStatus === 'approved' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('approved')}
                >
                  Aprovados
                </Button>
                <Button
                  variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('rejected')}
                >
                  Rejeitados
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((userDoc) => (
                  <Card key={userDoc.user_id} className="border border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{userDoc.full_name || 'N/A'}</h3>
                            <p className="text-sm text-muted-foreground">{userDoc.email}</p>
                            <div className="mt-2">
                              {getStatusBadge(userDoc.verification_status)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(userDoc);
                              setViewModalOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Documentos
                          </Button>
                        </div>
                      </div>

                      {/* Document thumbnails with actions */}
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {['identity_front', 'identity_back', 'selfie'].map(type => {
                          const doc = userDoc.documents.find(d => d.document_type === type);
                          return (
                            <div key={type} className="relative group">
                              <div 
                                className="aspect-video bg-muted rounded-lg overflow-hidden border border-border/50 relative cursor-pointer"
                                onClick={() => {
                                  if (doc?.signedUrl) {
                                    setViewingImageUrl(doc.signedUrl);
                                    setImageViewModalOpen(true);
                                  }
                                }}
                              >
                                {doc ? (
                                  <>
                                    <img 
                                      src={doc.signedUrl || ''} 
                                      alt={documentTypeLabels[type]}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden w-full h-full flex items-center justify-center absolute inset-0">
                                      <Image className="w-8 h-8 text-muted-foreground/50" />
                                    </div>
                                    <div className="absolute top-2 right-2">
                                      {getDocStatusBadge(doc.status)}
                                    </div>
                                    {/* Action buttons overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-blue-600 hover:bg-blue-700 text-white border-none h-8 px-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (doc.signedUrl) {
                                            setViewingImageUrl(doc.signedUrl);
                                            setImageViewModalOpen(true);
                                          }
                                        }}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      {doc.status === 'pending' && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="bg-green-600 hover:bg-green-700 text-white border-none h-8 px-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleApproveDoc(doc, userDoc);
                                            }}
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="bg-red-600 hover:bg-red-700 text-white border-none h-8 px-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedUser(userDoc);
                                              setSelectedDoc(doc);
                                              setRejectModalOpen(true);
                                            }}
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </Button>
                                        </>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-gray-600 hover:bg-gray-700 text-white border-none h-8 px-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedUser(userDoc);
                                          setSelectedDoc(doc);
                                          setDeleteDocModalOpen(true);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Image className="w-8 h-8 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 text-center truncate">
                                {documentTypeLabels[type]}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View User Documents Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Documentos de {selectedUser?.full_name}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.email} - Status: {selectedUser?.verification_status}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              {/* Documents grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['identity_front', 'identity_back', 'selfie'].map(type => {
                  const doc = selectedUser.documents.find(d => d.document_type === type);
                  return (
                    <Card key={type} className="overflow-hidden">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          {documentTypeLabels[type]}
                          {doc && getDocStatusBadge(doc.status)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div 
                          className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            if (doc?.signedUrl) {
                              setViewingImageUrl(doc.signedUrl);
                              setImageViewModalOpen(true);
                            }
                          }}
                        >
                          {doc ? (
                            <img 
                              src={doc.signedUrl || ''} 
                              alt={documentTypeLabels[type]}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="text-center">
                                <Image className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                <p className="text-xs text-muted-foreground mt-2">Não enviado</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {doc && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 text-xs"
                            onClick={() => {
                              if (doc.signedUrl) {
                                setViewingImageUrl(doc.signedUrl);
                                setImageViewModalOpen(true);
                              }
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Visualizar
                          </Button>
                        )}
                        {doc && doc.status === 'pending' && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveDoc(doc, selectedUser)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => {
                                setSelectedDoc(doc);
                                setRejectModalOpen(true);
                              }}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        )}
                        {doc && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedDoc(doc);
                              setDeleteDocModalOpen(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
                        )}
                        {doc && doc.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-500">
                            <strong>Rejeitado:</strong> {doc.rejection_reason}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                {selectedUser.documents.some(d => d.status === 'pending') && (
                  <Button
                    onClick={() => handleApproveAll(selectedUser)}
                    className="bg-green-600 hover:bg-green-700 flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar Todos e Liberar Conta
                  </Button>
                )}
                
                <Button
                  variant="destructive"
                  onClick={() => setDeleteModalOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Conta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Documento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O usuário será notificado.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Motivo da rejeição..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectDoc}
              disabled={!rejectionReason.trim()}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation */}
      <AlertDialog open={deleteDocModalOpen} onOpenChange={setDeleteDocModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? O usuário será notificado para enviar novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta de <strong>{selectedUser?.full_name}</strong>? 
              Esta ação não pode ser desfeita. Todos os documentos e dados do usuário serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image View Modal */}
      <Dialog open={imageViewModalOpen} onOpenChange={setImageViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Visualizar Documento</DialogTitle>
          </DialogHeader>
          <div className="p-4 flex items-center justify-center bg-black/20">
            {viewingImageUrl && (
              <img 
                src={viewingImageUrl}
                alt="Documento"
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDocumentos;
