'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Copy, Mail, Bell, Smartphone } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface Template {
  id: string;
  name: string;
  type: string;
  title: string;
  body: string;
  channels: string[];
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

const typeColors: Record<string, string> = {
  TRIVIA_DROP: 'bg-blue-100 text-blue-800',
  SYSTEM_ANNOUNCEMENT: 'bg-purple-100 text-purple-800',
  SUBSCRIPTION_REMINDER: 'bg-amber-100 text-amber-800',
  OFFER_PROMOTION: 'bg-pink-100 text-pink-800',
  CREDIT_ALERT: 'bg-green-100 text-green-800',
  ADMIN_MESSAGE: 'bg-gray-100 text-gray-800',
};

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/admin/notifications/templates');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    const confirmed = await confirm({
      title: currentStatus ? 'Deactivate Template' : 'Activate Template',
      message: currentStatus
        ? 'Are you sure you want to deactivate this template?'
        : 'Are you sure you want to activate this template?'
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/notifications/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!response.ok) throw new Error('Failed to update');
      await fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: 'Delete Template',
      message: 'Are you sure you want to delete this template? This cannot be undone.'
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/notifications/templates/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading templates...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No templates yet</h3>
        <p className="text-gray-500 mt-1">
          Create your first template to get started
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Variables</TableHead>
            <TableHead>Channels</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.name}</TableCell>
              <TableCell>
                <Badge className={typeColors[template.type] || 'bg-gray-100'}>
                  {template.type.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm text-gray-600">
                {template.title}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {template.variables.map((v) => (
                    <Badge key={v} variant="outline" className="text-xs font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {template.channels.includes('PUSH_MOBILE') && (
                    <span title="Mobile Push"><Smartphone className="h-4 w-4 text-gray-500" /></span>
                  )}
                  {template.channels.includes('PUSH_WEB') && (
                    <span title="Web Push"><Bell className="h-4 w-4 text-gray-500" /></span>
                  )}
                  {template.channels.includes('EMAIL') && (
                    <span title="Email"><Mail className="h-4 w-4 text-gray-500" /></span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {format(new Date(template.createdAt), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Template
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(template.id, template.isActive)}>
                      {template.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Sparkles({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}