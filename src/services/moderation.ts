import { httpsCallable } from 'firebase/functions';

import { getFirebaseFunctions } from '@/lib/firebase';

export type AdminReport = {
  id: string;
  reporterUid: string;
  reportedUid: string;
  reporterName: string;
  reportedName: string;
  reason: string;
  details: string;
  status: string;
  targetType: string;
  targetId: string | null;
  chatId: string | null;
  messagePreview: string | null;
  createdAt: number;
};

export type ModerationAction =
  | 'review'
  | 'dismiss'
  | 'resolve'
  | 'warn'
  | 'suspend'
  | 'unsuspend'
  | 'delete-message';

export async function fetchAdminReports(status?: string) {
  const callable = httpsCallable<{ status?: string }, { reports: AdminReport[] }>(
    getFirebaseFunctions(),
    'adminListReports'
  );
  const result = await callable(status ? { status } : {});
  return result.data.reports;
}

export async function reportContent(input: {
  targetType: 'message' | 'group';
  targetId: string;
  chatId?: string;
  reason: string;
  details?: string;
}) {
  const callable = httpsCallable<typeof input, { reportId: string }>(
    getFirebaseFunctions(),
    'reportContent'
  );
  const result = await callable(input);
  return result.data;
}

export async function moderateReport(input: {
  reportId: string;
  action: ModerationAction;
  note?: string;
}) {
  const callable = httpsCallable<typeof input, { status: string }>(
    getFirebaseFunctions(),
    'adminModerateReport'
  );
  const result = await callable(input);
  return result.data;
}
