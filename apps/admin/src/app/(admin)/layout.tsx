import { AdminGuard } from '@/components/AdminGuard';
import Link from 'next/link';
import { LayoutDashboard, Users, HelpCircle, Tags } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
          <div className="p-6 text-2xl font-bold border-b border-gray-800 tracking-tight">
            TrivioQ <span className="text-blue-500">Admin</span>
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Link href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <LayoutDashboard size={20} className="text-gray-400" />
              <span>Dashboard</span>
            </Link>
            <Link href="/users" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <Users size={20} className="text-gray-400" />
              <span>Users</span>
            </Link>
            <Link href="/questions" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <HelpCircle size={20} className="text-gray-400" />
              <span>Questions</span>
            </Link>
            <Link href="/categories" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <Tags size={20} className="text-gray-400" />
              <span>Categories</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-100/50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
