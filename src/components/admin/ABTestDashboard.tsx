import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useABTestResults } from '@/hooks/useABTestTracking';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, MousePointer, Clock, LogOut, ExternalLink, RefreshCw } from 'lucide-react';

interface ABTestResult {
  variant: string;
  total_views: number;
  cta_clicks: number;
  cta_click_rate: number;
  abandonments: number;
  abandonment_rate: number;
  avg_time_to_action_seconds: number;
  product_accesses: number;
  product_access_rate: number;
}

const VARIANT_LABELS: Record<string, string> = {
  'A': 'Variante A - Direta e objetiva',
  'B': 'Variante B - Humana e acolhedora',
  'C': 'Variante C - Educativa'
};

const VARIANT_COLORS: Record<string, string> = {
  'A': 'hsl(var(--chart-1))',
  'B': 'hsl(var(--chart-2))',
  'C': 'hsl(var(--chart-3))'
};

export function ABTestDashboard() {
  const [results, setResults] = useState<ABTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const { getResults } = useABTestResults();

  const fetchResults = async () => {
    setLoading(true);
    const days = parseInt(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const data = await getResults(startDate, new Date());
    if (data) {
      setResults(data as ABTestResult[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchResults();
  }, [period]);

  const getBestVariant = (metric: keyof ABTestResult, higherIsBetter = true) => {
    if (results.length === 0) return null;
    
    const sorted = [...results].sort((a, b) => {
      const aVal = Number(a[metric]) || 0;
      const bVal = Number(b[metric]) || 0;
      return higherIsBetter ? bVal - aVal : aVal - bVal;
    });
    
    return sorted[0]?.variant;
  };

  const chartData = results.map(r => ({
    variant: `Variante ${r.variant}`,
    'Taxa de Clique (%)': r.cta_click_rate,
    'Taxa de Abandono (%)': r.abandonment_rate,
    'Taxa de Acesso (%)': r.product_access_rate
  }));

  const bestCTARate = getBestVariant('cta_click_rate', true);
  const bestAbandonRate = getBestVariant('abandonment_rate', false);
  const bestAccessRate = getBestVariant('product_access_rate', true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Métricas de Teste A/B</h2>
          <p className="text-muted-foreground">
            Análise de performance das variações da tela de sucesso
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchResults} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Taxa de Clique no CTA"
          description="Usuários que clicaram no botão principal"
          icon={<MousePointer className="h-5 w-5" />}
          results={results}
          metric="cta_click_rate"
          suffix="%"
          bestVariant={bestCTARate}
          higherIsBetter
        />
        <MetricCard
          title="Taxa de Abandono"
          description="Saíram sem interagir"
          icon={<LogOut className="h-5 w-5" />}
          results={results}
          metric="abandonment_rate"
          suffix="%"
          bestVariant={bestAbandonRate}
          higherIsBetter={false}
        />
        <MetricCard
          title="Tempo até Ação"
          description="Média em segundos"
          icon={<Clock className="h-5 w-5" />}
          results={results}
          metric="avg_time_to_action_seconds"
          suffix="s"
          bestVariant={getBestVariant('avg_time_to_action_seconds', false)}
          higherIsBetter={false}
        />
        <MetricCard
          title="Taxa de Acesso ao Produto"
          description="Acessaram o produto"
          icon={<ExternalLink className="h-5 w-5" />}
          results={results}
          metric="product_access_rate"
          suffix="%"
          bestVariant={bestAccessRate}
          higherIsBetter
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Variantes</CardTitle>
          <CardDescription>
            Visualização das métricas principais por variante
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="variant" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Bar dataKey="Taxa de Clique (%)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Taxa de Abandono (%)" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Taxa de Acesso (%)" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {loading ? 'Carregando dados...' : 'Nenhum dado disponível para o período selecionado'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados Detalhados</CardTitle>
          <CardDescription>
            Métricas completas para cada variante do teste
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {results.map((result) => (
              <VariantCard 
                key={result.variant} 
                result={result}
                isBestCTA={result.variant === bestCTARate}
                isBestAbandon={result.variant === bestAbandonRate}
                isBestAccess={result.variant === bestAccessRate}
              />
            ))}
            {results.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                Ainda não há dados de teste A/B. Os dados serão coletados conforme os usuários acessam a tela de sucesso.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recomendação</CardTitle>
            <CardDescription>
              Análise automática baseada nas métricas coletadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecommendationSection results={results} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  results: ABTestResult[];
  metric: keyof ABTestResult;
  suffix: string;
  bestVariant: string | null;
  higherIsBetter: boolean;
}

function MetricCard({ title, description, icon, results, metric, suffix, bestVariant, higherIsBetter }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            {icon}
          </div>
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="space-y-2">
          {results.map(r => (
            <div key={r.variant} className="flex items-center justify-between">
              <span className="text-sm">Variante {r.variant}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">
                  {Number(r[metric]).toFixed(1)}{suffix}
                </span>
                {r.variant === bestVariant && (
                  <Badge variant="default" className="text-xs">
                    {higherIsBetter ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    Melhor
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface VariantCardProps {
  result: ABTestResult;
  isBestCTA: boolean;
  isBestAbandon: boolean;
  isBestAccess: boolean;
}

function VariantCard({ result, isBestCTA, isBestAbandon, isBestAccess }: VariantCardProps) {
  const totalBadges = [isBestCTA, isBestAbandon, isBestAccess].filter(Boolean).length;
  
  return (
    <Card className={totalBadges >= 2 ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Variante {result.variant}</CardTitle>
          {totalBadges >= 2 && (
            <Badge variant="default">Líder</Badge>
          )}
        </div>
        <CardDescription>{VARIANT_LABELS[result.variant]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Visualizações</p>
            <p className="font-mono font-bold text-lg">{result.total_views}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cliques CTA</p>
            <p className="font-mono font-bold text-lg">{result.cta_clicks}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              Taxa Clique
              {isBestCTA && <TrendingUp className="h-3 w-3 text-green-500" />}
            </p>
            <p className="font-mono font-bold text-lg">{result.cta_click_rate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              Abandono
              {isBestAbandon && <TrendingDown className="h-3 w-3 text-green-500" />}
            </p>
            <p className="font-mono font-bold text-lg">{result.abandonment_rate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tempo Ação</p>
            <p className="font-mono font-bold text-lg">{result.avg_time_to_action_seconds}s</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              Acesso Produto
              {isBestAccess && <TrendingUp className="h-3 w-3 text-green-500" />}
            </p>
            <p className="font-mono font-bold text-lg">{result.product_access_rate}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecommendationSectionProps {
  results: ABTestResult[];
}

function RecommendationSection({ results }: RecommendationSectionProps) {
  if (results.length === 0) return null;

  // Calculate winner based on weighted score
  const scores = results.map(r => {
    const ctaScore = r.cta_click_rate * 3; // Weight: 3x
    const abandonScore = (100 - r.abandonment_rate) * 2; // Weight: 2x (inverted)
    const accessScore = r.product_access_rate * 2; // Weight: 2x
    const timeScore = r.avg_time_to_action_seconds > 0 ? (60 / r.avg_time_to_action_seconds) : 0; // Weight: 1x (inverted)
    
    return {
      variant: r.variant,
      totalScore: ctaScore + abandonScore + accessScore + timeScore,
      result: r
    };
  });

  const winner = scores.sort((a, b) => b.totalScore - a.totalScore)[0];
  const totalViews = results.reduce((sum, r) => sum + r.total_views, 0);
  const hasEnoughData = totalViews >= 100;

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${hasEnoughData ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
        {hasEnoughData ? (
          <>
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">
              Variante {winner.variant} é a líder atual
            </h4>
            <p className="text-sm text-muted-foreground">
              Com base nas métricas primárias (taxa de clique no CTA) e secundárias (abandono, tempo de ação, acesso ao produto), 
              a <strong>Variante {winner.variant}</strong> ({VARIANT_LABELS[winner.variant]}) apresenta o melhor desempenho geral.
            </p>
          </>
        ) : (
          <>
            <h4 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
              Dados insuficientes para conclusão
            </h4>
            <p className="text-sm text-muted-foreground">
              O teste precisa de mais visualizações para uma conclusão estatisticamente significativa. 
              Atualmente há {totalViews} visualizações totais. Recomenda-se pelo menos 100 visualizações.
            </p>
          </>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        <h5 className="font-medium mb-2">Critérios de avaliação:</h5>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Taxa de clique no CTA</strong> — Métrica primária (peso 3x)</li>
          <li><strong>Taxa de abandono</strong> — Menor é melhor (peso 2x)</li>
          <li><strong>Taxa de acesso ao produto</strong> — Confirma ação final (peso 2x)</li>
          <li><strong>Tempo até ação</strong> — Menor é melhor (peso 1x)</li>
        </ul>
      </div>
    </div>
  );
}
