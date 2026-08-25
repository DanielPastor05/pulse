'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import type { ReportDTO } from '@/types/dto';
import type { ReportMessageInput } from '@/features/moderation/validators';
import { useT } from '@/i18n/provider';

const reportKeys = {
  queue: (conversationId: string) => ['reports', conversationId] as const,
};

export function useReportMessage() {
  const t = useT();
  return useMutation({
    mutationFn: (input: ReportMessageInput & { messageId: string }) =>
      api(`/messages/${input.messageId}/report`, {
        method: 'POST',
        body: { reason: input.reason, note: input.note },
      }),
    onSuccess: () =>
      toast.success(t.toast.reportSent, {
        description: 'A moderator will take a look. Thanks for flagging it.',
      }),
    onError: (error) => toast.error(t.toast.reportFailed, { description: error.message }),
  });
}

/** Only fetches when the viewer can actually moderate. */
export function useReports(conversationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: reportKeys.queue(conversationId ?? 'none'),
    queryFn: () =>
      api<{ reports: ReportDTO[] }>(`/conversations/${conversationId}/reports`).then(
        (data) => data.reports,
      ),
    enabled: Boolean(conversationId) && enabled,
  });
}

export function useReviewReport(conversationId: string) {
  const t = useT();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { reportId: string; status: 'RESOLVED' | 'DISMISSED' }) =>
      api<ReportDTO>(`/reports/${input.reportId}`, {
        method: 'PATCH',
        body: { status: input.status },
      }),
    onSuccess: (_report, input) => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.queue(conversationId) });
      toast.success(input.status === 'RESOLVED' ? 'Marked as resolved' : 'Dismissed');
    },
    onError: (error) => toast.error(t.toast.reportUpdateFailed, { description: error.message }),
  });
}
