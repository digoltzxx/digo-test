import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { 
  getTechnicalLog, 
  getFrontendMessage,
  ErrorCode 
} from '@/lib/deliveryErrors';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface DeliveryLogResponse {
  id: string;
  created_at: string;
  email_destino: string;
  tipo_entrega: string;
  status: string;
  erro_detalhado: string | null;
  codigo_erro: string | null;
  payload_referencia: Json | null;
  metadata_adicional: Json | null;
  tempo_processamento_ms: number | null;
  tentativas: number;
  correlation_id: string | null;
  seller_user_id: string | null;
  product_id: string | null;
}

// Status mapping - matches database values (sucesso, falha, pendente)
const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  sucesso: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Sucesso' },
  falha: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Falha' },
  pendente: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Pendente' },
};

const deliveryTypeLabels: Record<string, string> = {
  email: 'Email',
  produto: 'Produto',
  webhook: 'Webhook',
  'notificação': 'Notificação',
  notificacao: 'Notificação',
  member_area: 'Área de Membros',
  member_access: 'Acesso Liberado',
  notification: 'Notificação',
  payment_only: 'Apenas Pagamento',
};

export function DeliveryLogsTable() {
  const [logs, setLogs] = useState<DeliveryLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Fetch logs directly from Supabase (delivery_logs_v2 table)
  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const currentPage = reset ? 0 : page;
      
      // Build query for delivery_logs_v2 table
      let query = supabase
        .from('delivery_logs_v2')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
      
      // Apply search filter
      if (searchTerm.trim()) {
        const sanitizedSearch = searchTerm.trim().replace(/[%_]/g, '\\$&');
        query = query.or(`email_destino.ilike.%${sanitizedSearch}%,erro_detalhado.ilike.%${sanitizedSearch}%,correlation_id.ilike.%${sanitizedSearch}%`);
      }
      
      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Apply type filter
      if (typeFilter !== 'all') {
        query = query.eq('tipo_entrega', typeFilter);
      }
      
      const { data, error: queryError, count } = await query;
      
      if (queryError) {
        console.error('Query error:', queryError);
        setError('Erro ao carregar logs de entrega. Verifique suas permissões.');
        toast.error('Erro ao carregar logs');
        return;
      }
      
      // Set logs directly from response
      const mappedData: DeliveryLogResponse[] = (data || []).map(item => ({
        id: item.id,
        created_at: item.created_at,
        email_destino: item.email_destino,
        tipo_entrega: item.tipo_entrega,
        status: item.status,
        erro_detalhado: item.erro_detalhado,
        codigo_erro: item.codigo_erro,
        payload_referencia: item.payload_referencia,
        metadata_adicional: item.metadata_adicional,
        tempo_processamento_ms: item.tempo_processamento_ms,
        tentativas: item.tentativas,
        correlation_id: item.correlation_id,
        seller_user_id: item.seller_user_id,
        product_id: item.product_id,
      }));
      
      if (reset) {
        setLogs(mappedData);
        setPage(0);
      } else {
        setLogs(mappedData);
      }
      
      setTotalCount(count || 0);
      
    } catch (err) {
      console.error('Unexpected error fetching logs:', err);
      setError('Erro inesperado ao carregar logs.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter, typeFilter]);

  // Fetch on mount and when filters change
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchLogs(true);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, statusFilter, typeFilter]);

  // Fetch when page changes
  useEffect(() => {
    if (page > 0) {
      fetchLogs();
    }
  }, [page]);

  const handleRefresh = () => {
    fetchLogs(true);
    toast.success('Logs atualizados', {
      description: 'A lista de logs foi atualizada com sucesso.'
    });
  };

  const getErrorDetails = (log: DeliveryLogResponse) => {
    if (!log.erro_detalhado && !log.codigo_erro) return null;
    
    const errorCode = log.codigo_erro || log.erro_detalhado;
    
    // Try to parse as known error code
    if (errorCode) {
      const technicalLog = getTechnicalLog(errorCode as ErrorCode);
      if (technicalLog) {
        return {
          code: technicalLog.code,
          technical: technicalLog.technicalDetails,
          action: technicalLog.suggestedAction,
          userMessage: getFrontendMessage(errorCode).description,
        };
      }
    }
    
    // Parse error code from message format "CODE: message"
    if (log.erro_detalhado) {
      const codeMatch = log.erro_detalhado.match(/^([A-Z_]+):\s*(.+)$/);
      if (codeMatch) {
        return {
          code: codeMatch[1],
          technical: codeMatch[2],
          action: 'Verificar configuração do sistema',
          userMessage: codeMatch[2],
        };
      }
    }
    
    return {
      code: log.codigo_erro || 'UNKNOWN',
      technical: log.erro_detalhado || 'Erro desconhecido',
      action: 'Verificar logs detalhados',
      userMessage: 'Ocorreu um erro inesperado',
    };
  };

  const formatMetadata = (metadata: Json | null): React.ReactNode | null => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    
    const entries = Object.entries(metadata as Record<string, unknown>);
    if (entries.length === 0) return null;
    
    return entries.slice(0, 5).map(([key, value]) => (
      <div key={key} className="text-xs">
        <span className="font-medium">{key}:</span> {String(value).slice(0, 50)}
        {String(value).length > 50 && '...'}
      </div>
    ));
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.pendente;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logs de Entrega
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, erro ou correlation ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="sucesso">Sucesso</SelectItem>
                <SelectItem value="falha">Falha</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="produto">Produto</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="notificação">Notificação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => fetchLogs(true)} className="ml-auto">
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data/Hora</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[140px]">Tipo</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="w-[80px] text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Carregando logs...</p>
                  </TableCell>
                </TableRow>
              ) : !error && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum log encontrado</p>
                    {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
                      <p className="text-xs mt-1">Tente ajustar os filtros de busca</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const status = getStatusInfo(log.status);
                  const StatusIcon = status.icon;
                  const errorDetails = getErrorDetails(log);
                  
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm font-medium">
                          {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate font-mono text-sm" title={log.email_destino}>
                          {log.email_destino}
                        </div>
                        {log.correlation_id && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Link2 className="h-3 w-3" />
                            <span className="font-mono">{log.correlation_id.slice(0, 8)}...</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {deliveryTypeLabels[log.tipo_entrega] || log.tipo_entrega}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                        {log.tentativas > 1 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {log.tentativas} tentativa{log.tentativas > 1 ? 's' : ''}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {errorDetails ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-help max-w-[200px]">
                                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                  <span className="text-xs text-red-500 font-mono truncate">
                                    {errorDetails.code}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-[300px] p-3">
                                <div className="space-y-2 text-xs">
                                  <div>
                                    <span className="font-medium">Código:</span> {errorDetails.code}
                                  </div>
                                  <div>
                                    <span className="font-medium">Detalhe:</span> {errorDetails.technical}
                                  </div>
                                  <div>
                                    <span className="font-medium">Ação:</span> {errorDetails.action}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[300px] p-3">
                              <div className="space-y-2 text-xs">
                                <div>
                                  <span className="font-medium">ID:</span> {log.id.slice(0, 8)}...
                                </div>
                                {log.tempo_processamento_ms !== null && (
                                  <div>
                                    <span className="font-medium">Tempo:</span> {log.tempo_processamento_ms}ms
                                  </div>
                                )}
                                {log.product_id && (
                                  <div>
                                    <span className="font-medium">Produto:</span> {log.product_id.slice(0, 8)}...
                                  </div>
                                )}
                                {log.correlation_id && (
                                  <div>
                                    <span className="font-medium">Correlation:</span> {log.correlation_id}
                                  </div>
                                )}
                                {log.metadata_adicional && (
                                  <div>
                                    <span className="font-medium">Metadata:</span>
                                    <div className="mt-1 pl-2 border-l border-border">
                                      {formatMetadata(log.metadata_adicional)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1 || loading}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DeliveryLogsTable;
