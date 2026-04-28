import { AdminGuard } from '@/components/admin-guard';
import Link from 'next/link';
import { LayoutDashboard, Users, HelpCircle, Tags, LogOut, MessageSquareQuote, Settings } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth-actions';
 
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
            <Link href="/faqs" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <MessageSquareQuote size={20} className="text-gray-400" />
              <span>FAQs</span>
            </Link>
            <Link href="/app-settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <Settings size={20} className="text-gray-400" />
              <span>App Settings</span>
            </Link>
          </nav>
 
          {/* Logout Section */}
          <div className="p-4 border-t border-gray-800">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 p-3 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-all font-medium group"
              >
                <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
                <span>Logout</span>
              </button>
            </form>
          </div>
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
