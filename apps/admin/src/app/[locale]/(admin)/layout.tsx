import { AdminGuard } from '@/components/admin-guard';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { AdminShell } from '@/components/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </ConfirmProvider>
  );
}
