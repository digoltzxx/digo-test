import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, ChevronDown, ChevronUp, History } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface WebhookLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  response_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  processed_at: string | null;
}

const WebhookLogsTable = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data as WebhookLog[]) || []);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("webhook-logs-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "webhook_logs" },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Processado</Badge>;
      case "received":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Recebido</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEventBadge = (eventType: string) => {
    const eventColors: Record<string, string> = {
      "payment.approved": "bg-green-500/10 text-green-500",
      "payment.created": "bg-blue-500/10 text-blue-500",
      "payment.pending": "bg-yellow-500/10 text-yellow-500",
      "payment.refused": "bg-red-500/10 text-red-500",
      "payment.refunded": "bg-orange-500/10 text-orange-500",
      "payment.chargeback": "bg-purple-500/10 text-purple-500",
    };

    return (
      <Badge className={eventColors[eventType] || "bg-muted text-muted-foreground"}>
        {eventType}
      </Badge>
    );
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <CardTitle>Histórico de Webhooks</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum webhook recebido ainda
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <Collapsible
                key={log.id}
                open={expandedLog === log.id}
                onOpenChange={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="border border-border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-4">
                        {getEventBadge(log.event_type)}
                        {getStatusBadge(log.status)}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.ip_address && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.ip_address}
                          </span>
                        )}
                        {expandedLog === log.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 border-t border-border bg-muted/30 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Payload Recebido</p>
                        <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                      {log.response_data && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Resposta</p>
                          <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto">
                            {JSON.stringify(log.response_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.processed_at && (
                        <p className="text-xs text-muted-foreground">
                          Processado em: {format(new Date(log.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebhookLogsTable;
