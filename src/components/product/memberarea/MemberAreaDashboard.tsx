import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, BookOpen, FileText, UserCheck, UserX } from "lucide-react";
import { useMemberAreaStats } from "@/hooks/useMemberAreaStats";

interface MemberAreaDashboardProps {
  productId: string;
}

export default function MemberAreaDashboard({ productId }: MemberAreaDashboardProps) {
  const { stats, loading } = useMemberAreaStats(productId);

  const statCards = [
    {
      title: "Total de Alunos",
      value: stats?.total_students || 0,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-600/20",
    },
    {
      title: "Alunos Ativos",
      value: stats?.active_students || 0,
      icon: UserCheck,
      color: "text-green-400",
      bgColor: "bg-green-600/20",
    },
    {
      title: "Alunos Bloqueados",
      value: stats?.blocked_students || 0,
      icon: UserX,
      color: "text-red-400",
      bgColor: "bg-red-600/20",
    },
    {
      title: "Matrículas Ativas",
      value: stats?.active_enrollments || 0,
      icon: GraduationCap,
      color: "text-purple-400",
      bgColor: "bg-purple-600/20",
    },
    {
      title: "Módulos",
      value: stats?.total_modules || 0,
      icon: BookOpen,
      color: "text-orange-400",
      bgColor: "bg-orange-600/20",
    },
    {
      title: "Aulas",
      value: stats?.total_lessons || 0,
      icon: FileText,
      color: "text-cyan-400",
      bgColor: "bg-cyan-600/20",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="bg-[#0d1117] border-gray-800">
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg bg-gray-800 mb-3" />
              <Skeleton className="h-8 w-16 bg-gray-800 mb-2" />
              <Skeleton className="h-4 w-24 bg-gray-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-[#0d1117] border-gray-800 hover:border-gray-700 transition-colors">
            <CardContent className="p-4">
              <div className={`p-2.5 rounded-lg ${stat.bgColor} w-fit mb-3`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-gray-500 text-xs">{stat.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="bg-[#0d1117] border-gray-800">
        <CardContent className="p-6">
          <h3 className="text-white font-medium mb-4">Resumo da Área de Membros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-600/20">
                  <UserCheck className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-white font-medium">Taxa de Alunos Ativos</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {stats?.total_students ? Math.round((stats.active_students / stats.total_students) * 100) : 0}%
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {stats?.active_students} de {stats?.total_students} alunos estão ativos
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-600/20">
                  <GraduationCap className="h-4 w-4 text-purple-400" />
                </div>
                <span className="text-white font-medium">Matrículas</span>
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {stats?.active_enrollments}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {stats?.total_enrollments} matrículas no total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
