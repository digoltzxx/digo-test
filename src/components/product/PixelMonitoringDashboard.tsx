import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  RefreshCw, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PixelEventLog {
  id: string;
  created_at: string;
  event_type: string;
  pixel_type: string;
  event_source: string;
  status: string;
  event_id: string | null;
  transaction_id: string | null;
  value: number | null;
  currency: string | null;
  error_message: string | null;
  metadata: any;
}

interface PixelMonitoringDashboardProps {
  productId: string;
}

export const PixelMonitoringDashboard = ({ productId }: PixelMonitoringDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PixelEventLog[]>([]);
  const [filter, setFilter] = useState({
    eventType: 'all',
    pixelType: 'all',
    status: 'all',
    search: '',
  });
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    successRate: 0,
    purchaseEvents: 0,
    totalValue: 0,
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pixel_event_logs')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter.eventType !== 'all') {
        query = query.eq('event_type', filter.eventType);
      }
      if (filter.pixelType !== 'all') {
        query = query.eq('pixel_type', filter.pixelType);
      }
      if (filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredData = filteredData.filter(e => 
          e.event_id?.toLowerCase().includes(searchLower) ||
          e.transaction_id?.toLowerCase().includes(searchLower)
        );
      }

      setEvents(filteredData);

      // Calculate stats
      const total = filteredData.length;
      const sent = filteredData.filter(e => e.status === 'sent').length;
      const failed = filteredData.filter(e => e.status === 'failed' || e.status === 'error').length;
      const pending = filteredData.filter(e => e.status === 'pending' || e.status === 'logged').length;
      const purchaseEvents = filteredData.filter(e => e.event_type === 'purchase' && e.status === 'sent').length;
      const totalValue = filteredData
        .filter(e => e.event_type === 'purchase' && e.status === 'sent')
        .reduce((sum, e) => sum + (e.value || 0), 0);

      setStats({
        total,
        sent,
        failed,
        pending,
        successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
        purchaseEvents,
        totalValue,
      });

    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [productId, filter.eventType, filter.pixelType, filter.status]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'failed':
      case 'error':
        return <Badge className="bg-red-500/10 text-red-600"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'logged':
        return <Badge variant="outline"><Activity className="w-3 h-3 mr-1" />Registrado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPixelIcon = (pixelType: string) => {
    const icons: Record<string, string> = {
      'facebook': '🔵',
      'google_analytics_4': '📊',
      'google_analytics': '📊',
      'google_ads': '🎯',
      'tiktok': '🎵',
      'kwai': '🟠',
      'google_tag_manager': '📦',
    };
    return icons[pixelType] || '📍';
  };

  const getEventTypeBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      'page_view': 'bg-gray-500/10 text-gray-600',
      'view_content': 'bg-blue-500/10 text-blue-600',
      'initiate_checkout': 'bg-purple-500/10 text-purple-600',
      'add_payment_info': 'bg-orange-500/10 text-orange-600',
      'purchase': 'bg-green-500/10 text-green-600',
      'refund': 'bg-red-500/10 text-red-600',
    };
    return <Badge className={colors[eventType] || 'bg-muted'}>{eventType}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-[#0d1117] border-gray-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-gray-400">Total de Eventos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.sent}</p>
                <p className="text-xs text-gray-400">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                <p className="text-xs text-gray-400">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0d1117] border-gray-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {stats.successRate >= 90 ? (
                <TrendingUp className="h-5 w-5 text-green-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-yellow-400" />
              )}
              <div>
                <p className="text-2xl font-bold text-white">{stats.successRate}%</p>
                <p className="text-xs text-gray-400">Taxa de Sucesso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-purple-400">{stats.purchaseEvents}</p>
                <p className="text-xs text-gray-400">Purchases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-2xl font-bold text-blue-400">
                  R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400">Valor Rastreado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white">Logs de Eventos</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchEvents}
              disabled={loading}
              className="bg-[#0d1117] border-gray-700"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por event_id ou transaction_id..."
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                className="bg-[#0d1117] border-gray-700 text-white pl-10"
              />
            </div>
            <Select 
              value={filter.eventType} 
              onValueChange={(v) => setFilter(prev => ({ ...prev, eventType: v }))}
            >
              <SelectTrigger className="w-40 bg-[#0d1117] border-gray-700 text-white">
                <SelectValue placeholder="Tipo de Evento" />
              </SelectTrigger>
              <SelectContent className="bg-[#161b22] border-gray-700">
                <SelectItem value="all">Todos Eventos</SelectItem>
                <SelectItem value="page_view">Page View</SelectItem>
                <SelectItem value="view_content">View Content</SelectItem>
                <SelectItem value="initiate_checkout">Initiate Checkout</SelectItem>
                <SelectItem value="add_payment_info">Add Payment Info</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={filter.pixelType} 
              onValueChange={(v) => setFilter(prev => ({ ...prev, pixelType: v }))}
            >
              <SelectTrigger className="w-40 bg-[#0d1117] border-gray-700 text-white">
                <SelectValue placeholder="Pixel" />
              </SelectTrigger>
              <SelectContent className="bg-[#161b22] border-gray-700">
                <SelectItem value="all">Todos Pixels</SelectItem>
                <SelectItem value="facebook">Meta (Facebook)</SelectItem>
                <SelectItem value="google_analytics_4">GA4</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="kwai">Kwai</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={filter.status} 
              onValueChange={(v) => setFilter(prev => ({ ...prev, status: v }))}
            >
              <SelectTrigger className="w-32 bg-[#0d1117] border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#161b22] border-gray-700">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum evento encontrado</p>
              <p className="text-sm mt-1">Os eventos aparecerão aqui após disparos de pixel</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Data/Hora</TableHead>
                    <TableHead className="text-gray-400">Pixel</TableHead>
                    <TableHead className="text-gray-400">Evento</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Valor</TableHead>
                    <TableHead className="text-gray-400">Event ID</TableHead>
                    <TableHead className="text-gray-400">Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id} className="border-gray-700/50">
                      <TableCell className="text-gray-300 text-sm">
                        {format(new Date(event.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <span className="text-lg mr-2">{getPixelIcon(event.pixel_type)}</span>
                        <span className="text-gray-400 text-sm capitalize">
                          {event.pixel_type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getEventTypeBadge(event.event_type)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(event.status)}
                        {event.error_message && (
                          <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={event.error_message}>
                            {event.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {event.value ? `R$ ${event.value.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs font-mono">
                        {event.event_id ? event.event_id.substring(0, 20) + '...' : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {event.event_source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
