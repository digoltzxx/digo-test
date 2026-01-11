import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Copy,
  X,
  Activity,
} from 'lucide-react';
import { CheckoutEvent } from '@/hooks/useCheckoutDebug';

interface CheckoutDebugPanelProps {
  enabled: boolean;
  sessionId: string;
  events: CheckoutEvent[];
  onExport: () => void;
  onClose: () => void;
}

const CheckoutDebugPanel = ({
  enabled,
  sessionId,
  events,
  onExport,
  onClose,
}: CheckoutDebugPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CheckoutEvent | null>(null);

  if (!enabled) return null;

  const errorCount = events.filter(e => e.status === 'error').length;
  const warningCount = events.filter(e => e.status === 'warning').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      default:
        return <Info className="w-3 h-3 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const copyToClipboard = () => {
    const data = {
      sessionId,
      events,
      exportedAt: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed View */}
      {!isExpanded && (
        <Button
          onClick={() => setIsExpanded(true)}
          className="rounded-full w-12 h-12 bg-accent hover:bg-accent/80 shadow-lg"
        >
          <Bug className="w-5 h-5" />
          {(errorCount > 0 || warningCount > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
              {errorCount + warningCount}
            </span>
          )}
        </Button>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <Card className="w-96 max-h-[70vh] bg-card/95 backdrop-blur border-border shadow-2xl">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-accent" />
              <CardTitle className="text-sm">Checkout Debug</CardTitle>
              <Badge variant="outline" className="text-xs font-mono">
                {events.length} events
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyToClipboard}>
                <Copy className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsExpanded(false)}>
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span className="font-mono truncate">{sessionId}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {errorCount > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  {errorCount} errors
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  {warningCount} warnings
                </Badge>
              )}
              {errorCount === 0 && warningCount === 0 && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  All clear
                </Badge>
              )}
            </div>
          </div>

          <Separator className="bg-border/50" />

          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No events recorded yet
                  </div>
                ) : (
                  [...events].reverse().map((event) => (
                    <div
                      key={event.id}
                      className={`p-2 rounded-lg border cursor-pointer transition-all hover:bg-secondary/50 ${
                        selectedEvent?.id === event.id ? 'ring-1 ring-accent' : ''
                      } ${getStatusColor(event.status)}`}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(event.status)}
                          <span className="text-xs font-medium">{event.type}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Step {event.step}
                        </span>
                      </div>

                      {selectedEvent?.id === event.id && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <pre className="text-xs overflow-auto max-h-32 p-2 rounded bg-background/50">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                          {event.previousValue !== undefined && (
                            <div className="mt-1 text-xs">
                              <span className="text-muted-foreground">Previous: </span>
                              <span className="text-yellow-400">{JSON.stringify(event.previousValue)}</span>
                            </div>
                          )}
                          {event.newValue !== undefined && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">New: </span>
                              <span className="text-green-400">{JSON.stringify(event.newValue)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <Separator className="bg-border/50" />

          <div className="p-2 flex justify-between">
            <Button size="sm" variant="outline" onClick={onExport}>
              Export All
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => {
                localStorage.removeItem('checkout_debug');
                onClose();
              }}
            >
              Disable Debug
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CheckoutDebugPanel;
