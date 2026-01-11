import AdminLayout from "@/components/admin/AdminLayout";
import AdminFeesPanel from "@/components/admin/AdminFeesPanel";

const AdminTaxas = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Taxas da Plataforma</h1>
          <p className="text-muted-foreground">
            Gerencie as taxas globais e visualize configurações por tenant
          </p>
        </div>
        
        <AdminFeesPanel isGlobalAdmin={true} />
      </div>
    </AdminLayout>
  );
};

export default AdminTaxas;
