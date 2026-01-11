import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  BookOpen,
  Users,
  Settings,
  LayoutDashboard,
  Video,
  UserCheck,
} from "lucide-react";
import { useCourseManagement } from "@/hooks/useCourseManagement";
import { ensureCourseExists } from "@/lib/enrollmentService";

// Member Area Components
import MemberAreaDashboard from "./memberarea/MemberAreaDashboard";
import StudentsManagement from "./memberarea/StudentsManagement";
import CoursesManagement from "./memberarea/CoursesManagement";
import TurmasManagement from "./memberarea/TurmasManagement";
import MemberAreaContent from "./MemberAreaContent";
import EnrollmentsManagement from "./memberarea/EnrollmentsManagement";
import MemberAreaSettingsTab from "./memberarea/MemberAreaSettingsTab";

interface MemberAreaManagerProps {
  productId: string;
  productName: string;
  sellerId: string;
  deliveryMethod: string;
}

type TabType = "dashboard" | "students" | "courses" | "turmas" | "content" | "enrollments" | "settings";

const tabs = [
  { id: "dashboard" as TabType, label: "Dashboard", icon: LayoutDashboard },
  { id: "students" as TabType, label: "Alunos", icon: Users },
  { id: "courses" as TabType, label: "Cursos", icon: BookOpen },
  { id: "turmas" as TabType, label: "Turmas", icon: UserCheck },
  { id: "content" as TabType, label: "Aulas", icon: Video },
  { id: "enrollments" as TabType, label: "Matrículas", icon: GraduationCap },
  { id: "settings" as TabType, label: "Configurações", icon: Settings },
];

export default function MemberAreaManager({
  productId,
  productName,
  sellerId,
  deliveryMethod,
}: MemberAreaManagerProps) {
  const { 
    course, 
    modules, 
    loading, 
    saving, 
    updateCourse,
    addModule, 
    updateModule, 
    deleteModule 
  } = useCourseManagement(productId);
  
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  // Automatically create course when delivery method is member_area
  useEffect(() => {
    const setupCourse = async () => {
      if (deliveryMethod === "member_area" && !course && !loading) {
        await ensureCourseExists(productId, productName, sellerId);
      }
    };
    setupCourse();
  }, [deliveryMethod, course, loading, productId, productName, sellerId]);

  if (deliveryMethod !== "member_area") {
    return (
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="py-12 text-center">
          <GraduationCap className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">Área de Membros Desativada</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Para configurar a área de membros, selecione "Área de Membros" como método de entrega na aba Produto.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-[#161b22] border-gray-800">
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-gray-800" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full bg-gray-800" />
          <Skeleton className="h-20 w-full bg-gray-800" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#161b22] border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-600/20">
                <GraduationCap className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">Área de Membros</CardTitle>
                <p className="text-gray-500 text-sm mt-0.5">
                  Gerencie alunos, cursos, turmas e conteúdos
                </p>
              </div>
            </div>
            {course && (
              <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                Ativo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 p-1 bg-[#0d1117] rounded-lg overflow-x-auto mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "dashboard" && (
            <MemberAreaDashboard productId={productId} />
          )}

          {activeTab === "students" && (
            <StudentsManagement productId={productId} sellerId={sellerId} />
          )}

          {activeTab === "courses" && (
            <CoursesManagement productId={productId} sellerId={sellerId} />
          )}

          {activeTab === "turmas" && (
            <TurmasManagement productId={productId} />
          )}

          {activeTab === "content" && (
            <MemberAreaContent
              course={course}
              modules={modules}
              saving={saving}
              addModule={addModule}
              updateModule={updateModule}
              deleteModule={deleteModule}
            />
          )}

          {activeTab === "enrollments" && (
            <EnrollmentsManagement productId={productId} />
          )}

          {activeTab === "settings" && (
            <MemberAreaSettingsTab productId={productId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
