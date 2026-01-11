import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

const documentTypes = [
  { id: 'identity', label: 'Documento de Identidade (RG/CNH)', description: 'Frente e verso do documento' },
  { id: 'proof_of_address', label: 'Comprovante de Endereço', description: 'Conta de luz, água ou telefone (últimos 3 meses)' },
  { id: 'selfie', label: 'Selfie com Documento', description: 'Foto segurando o documento próximo ao rosto' },
];

const Documentos = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('verification_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setVerificationStatus(data.verification_status);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    setUploading(type);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-documents')
        .getPublicUrl(fileName);

      // Save document record
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          document_type: type,
          file_name: file.name,
          file_url: urlData.publicUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;

      // Buscar documentos atualizados
      const { data: updatedDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Verificar se todos os 3 tipos de documentos foram enviados
      const uploadedTypes = new Set(
        (updatedDocs || [])
          .filter(doc => doc.status !== 'rejected')
          .map(doc => doc.document_type)
      );
      
      const allTypesUploaded = documentTypes.every(dt => uploadedTypes.has(dt.id));

      // Se todos os documentos foram enviados, atualizar status para 'submitted'
      if (allTypesUploaded) {
        await supabase
          .from('profiles')
          .update({ verification_status: 'submitted' })
          .eq('user_id', user.id);
        
        setVerificationStatus('submitted');
        
        toast({
          title: "Todos os documentos enviados!",
          description: "Seus documentos estão em análise. Você será notificado quando a verificação for concluída.",
        });
      } else {
        toast({
          title: "Documento enviado",
          description: "Seu documento foi enviado e está aguardando análise.",
        });
      }

      setDocuments(updatedDocs || []);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: "Erro ao enviar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const getDocumentForType = (type: string) => {
    return documents.find(doc => doc.document_type === type);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Rejeitado</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getVerificationAlert = () => {
    switch (verificationStatus) {
      case 'approved':
        return (
          <Alert className="bg-green-500/10 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500">
              Sua conta está verificada! Você tem acesso completo a todas as funcionalidades.
            </AlertDescription>
          </Alert>
        );
      case 'rejected':
        return (
          <Alert className="bg-red-500/10 border-red-500/30">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-500">
              Sua verificação foi rejeitada. Por favor, envie novos documentos corrigindo os problemas apontados.
            </AlertDescription>
          </Alert>
        );
      default:
        return (
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-500">
              Sua conta está pendente de verificação. Envie os documentos abaixo para liberar todas as funcionalidades.
            </AlertDescription>
          </Alert>
        );
    }
  };

  // Verifica se todos os 3 documentos foram enviados (e não foram rejeitados)
  const allDocumentsSubmitted = documentTypes.every(docType => {
    const doc = getDocumentForType(docType.id);
    return doc && doc.status !== 'rejected';
  });

  // Verifica se há algum documento rejeitado
  const hasRejectedDocs = documents.some(doc => doc.status === 'rejected');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Verificação de Documentos</h1>
          <p className="text-muted-foreground">Envie seus documentos para verificar sua conta</p>
        </div>

        {getVerificationAlert()}

        {/* Tela de "Documentos Enviados" quando todos foram enviados e nenhum foi rejeitado */}
        {allDocumentsSubmitted && !hasRejectedDocs ? (
          <Card className="border-accent/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-accent mb-3">Documentos Enviados!</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Seus documentos já foram enviados e estão em análise.
                <br />
                Você será notificado assim que a verificação for concluída.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {documentTypes.map((docType) => {
                const existingDoc = getDocumentForType(docType.id);
                const isUploading = uploading === docType.id;

                return (
                  <Card key={docType.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5" />
                        {docType.label}
                      </CardTitle>
                      <CardDescription>{docType.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {existingDoc ? (
                        <div className="space-y-3">
                          {/* Preview da imagem enviada */}
                          {existingDoc.file_url && (
                            <div className="relative w-full h-32 bg-muted/30 rounded-lg overflow-hidden">
                              <img 
                                src={existingDoc.file_url} 
                                alt={existingDoc.file_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                              {existingDoc.file_name}
                            </span>
                            {getStatusBadge(existingDoc.status)}
                          </div>
                          
                          {existingDoc.status === 'rejected' && existingDoc.rejection_reason && (
                            <div className="p-3 bg-red-500/10 rounded-lg">
                              <p className="text-sm text-red-500">
                                <strong>Motivo:</strong> {existingDoc.rejection_reason}
                              </p>
                            </div>
                          )}

                          {existingDoc.status === 'rejected' && (
                            <div>
                              <Label htmlFor={`reupload-${docType.id}`} className="cursor-pointer">
                                <div className="flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                                  <Upload className="w-4 h-4" />
                                  <span className="text-sm">Enviar novamente</span>
                                </div>
                              </Label>
                              <Input
                                id={`reupload-${docType.id}`}
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(docType.id, file);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor={`upload-${docType.id}`} className="cursor-pointer">
                            <div className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                              {isUploading ? (
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  <Upload className="w-8 h-8 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Clique para enviar</span>
                                </>
                              )}
                            </div>
                          </Label>
                          <Input
                            id={`upload-${docType.id}`}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(docType.id, file);
                            }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {documents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Envios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {documentTypes.find(t => t.id === doc.document_type)?.label} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(doc.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Documentos;