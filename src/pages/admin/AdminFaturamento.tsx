import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { BillingStatement } from '@/components/admin/BillingStatement';

export default function AdminFaturamento() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Faturamento</h1>
          <p className="text-muted-foreground">
            Demonstrativo financeiro completo com todas as taxas e receitas
          </p>
        </div>
        
        <BillingStatement />
      </div>
    </AdminLayout>
  );
}
