'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getAuditLogs } from '@/app/actions/audit-logs-actions';

interface AuditLogsClientProps {
  targetUserId?: string;
}

export function AuditLogsClient({ targetUserId }: AuditLogsClientProps) {
  const t = useTranslations('auditLogs');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pageSize = 20;

  const fetchLogs = async (p: number) => {
    setLoading(true);
    const result = await getAuditLogs(p, pageSize, targetUserId);
    if (result.success && result.data) {
      setLogs(result.data.logs);
      setTotalPages(result.data.totalPages);
      setTotalCount(result.data.total);
      setPage(p);
    } else {
      toast.error(t('fetchError'));
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{targetUserId ? t('userTab.title') : t('title')}</CardTitle>
        <CardDescription>{targetUserId ? t('userTab.description') : t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.date')}</TableHead>
                <TableHead>{t('columns.admin')}</TableHead>
                <TableHead>{t('columns.action')}</TableHead>
                {!targetUserId && <TableHead>{t('columns.targetUser')}</TableHead>}
                <TableHead>{t('columns.reason')}</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={targetUserId ? 5 : 6} className="text-center h-24">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={targetUserId ? 5 : 6} className="text-center text-muted-foreground h-24">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{log.adminEmail || t('unknown')}</span>
                        <span className="text-xs text-muted-foreground">{log.adminId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.actionType}</Badge>
                    </TableCell>
                    {!targetUserId && (
                      <TableCell className="font-mono text-xs">{log.targetUserId}</TableCell>
                    )}
                    <TableCell className="max-w-[200px] truncate" title={log.reason || ''}>
                      {log.reason || <span className="text-muted-foreground italic">{t('noneProvided')}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(log)}>
                        {t('viewDetails')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {t('showing', { 
                from: totalCount === 0 ? 0 : (page - 1) * pageSize + 1, 
                to: Math.min(page * pageSize, totalCount),
                totalCount: totalCount 
              })}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(page - 1)}
                disabled={page === 1 || loading}
              >
                {t('previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(page + 1)}
                disabled={page === totalPages || loading || totalPages === 0}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        )}

        {/* Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('modal.title')}</DialogTitle>
              <DialogDescription>
                {t('modal.description')}
              </DialogDescription>
            </DialogHeader>
            
            {selectedLog && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.date')}</span>
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.admin')}</span>
                    {selectedLog.adminEmail} <br/>
                    <span className="text-xs text-muted-foreground">{selectedLog.adminId}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.targetUser')}</span>
                    <span className="font-mono text-xs">{selectedLog.targetUserId}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.actionType')}</span>
                    <Badge>{selectedLog.actionType}</Badge>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.resourceType')}</span>
                    {selectedLog.resourceType}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.reason')}</span>
                    {selectedLog.reason || <span className="italic">{t('notApplicable')}</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.ipAddress')}</span>
                    {selectedLog.ipAddress || <span className="italic">{t('notApplicable')}</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('modal.userAgent')}</span>
                    {selectedLog.userAgent || <span className="italic">{t('notApplicable')}</span>}
                  </div>
                </div>

                {selectedLog.previousState && (
                  <div className="mt-4">
                    <span className="font-semibold text-muted-foreground block mb-2">{t('modal.previousState')}</span>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                      {JSON.stringify(selectedLog.previousState, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.newState && (
                  <div className="mt-4">
                    <span className="font-semibold text-muted-foreground block mb-2">{t('modal.newState')}</span>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                      {JSON.stringify(selectedLog.newState, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
