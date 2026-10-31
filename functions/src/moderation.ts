import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { CALL_OPTIONS, db, isRecord } from './config';

type AdminRequest = { auth?: { uid?: string; token?: Record<string, unknown> } };

const REPORT_STATUSES = new Set(['open', 'reviewed', 'resolved', 'dismissed', 'actioned', 'warned']);

function requireAdmin(request: AdminRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Esta sección es solo para moderación.');
  }
  return uid;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function profileName(uid: string): Promise<string> {
  if (!uid) return 'Cuenta eliminada';
  const snapshot = await db().doc(`publicProfiles/${uid}`).get();
  return text(snapshot.get('displayName'), 80) || 'Explorador sísmico';
}

export const reportContent = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const data = isRecord(request.data) ? request.data : {};
  const targetType = data.targetType === 'message' ? 'message' : data.targetType === 'group' ? 'group' : null;
  const targetId = text(data.targetId, 200);
  const chatId = text(data.chatId, 200);
  const allowed = new Set(['spam', 'abuso', 'acoso', 'contenido', 'otro']);
  const reason = typeof data.reason === 'string' && allowed.has(data.reason) ? data.reason : 'otro';
  const details = text(data.details, 500);

  if (!targetType || !targetId) {
    throw new HttpsError('invalid-argument', 'Contenido inválido.');
  }

  let reportedUid = '';
  let messagePreview = '';
  if (targetType === 'message') {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(chatId)) {
      throw new HttpsError('invalid-argument', 'Chat inválido.');
    }
    const member = await db().doc(`chats/${chatId}/members/${uid}`).get();
    if (!member.exists) throw new HttpsError('permission-denied', 'No perteneces a este chat.');
    const message = await db().doc(`chats/${chatId}/messages/${targetId}`).get();
    if (!message.exists) throw new HttpsError('not-found', 'El mensaje ya no existe.');
    reportedUid = text(message.get('senderId'), 128);
    messagePreview = text(message.get('text'), 200);
    if (!reportedUid || reportedUid === uid) {
      throw new HttpsError('invalid-argument', 'No puedes reportar tu propio mensaje.');
    }
  } else {
    const chat = await db().doc(`chats/${targetId}`).get();
    if (!chat.exists || chat.get('type') !== 'group') {
      throw new HttpsError('not-found', 'El grupo ya no existe.');
    }
    const member = await db().doc(`chats/${targetId}/members/${uid}`).get();
    if (!member.exists) throw new HttpsError('permission-denied', 'No perteneces a este grupo.');
    reportedUid = text(chat.get('createdBy'), 128);
    if (!reportedUid || reportedUid === uid) {
      throw new HttpsError('invalid-argument', 'No puedes reportar tu propio grupo.');
    }
  }

  const now = Date.now();
  const ref = db().collection('reports').doc();
  await ref.set({
    reporterUid: uid,
    reportedUid,
    targetType,
    targetId,
    chatId: targetType === 'message' ? chatId : targetId,
    messagePreview,
    reason,
    details,
    status: 'open',
    createdAt: now,
  });

  return { reportId: ref.id };
});

export const adminListReports = onCall(CALL_OPTIONS, async (request) => {
  requireAdmin(request);
  const data = isRecord(request.data) ? request.data : {};
  const status = typeof data.status === 'string' && REPORT_STATUSES.has(data.status) ? data.status : null;
  const snapshot = await db()
    .collection('reports')
    .orderBy('createdAt', 'desc')
    .limit(status ? 200 : 100)
    .get();

  const reports = await Promise.all(
    snapshot.docs
      .filter((document) => !status || document.get('status') === status)
      .map(async (document) => {
        const report = document.data();
        const [reporterName, reportedName] = await Promise.all([
          profileName(text(report.reporterUid, 128)),
          profileName(text(report.reportedUid, 128)),
        ]);
        return {
          id: document.id,
          reporterUid: text(report.reporterUid, 128),
          reportedUid: text(report.reportedUid, 128),
          reporterName,
          reportedName,
          reason: text(report.reason, 40),
          details: text(report.details, 500),
          status: text(report.status, 40) || 'open',
          targetType: text(report.targetType, 40) || 'user',
          targetId: text(report.targetId, 200) || null,
          chatId: text(report.chatId, 200) || null,
          messagePreview: text(report.messagePreview, 200) || null,
          createdAt: Number(report.createdAt ?? 0),
        };
      })
  );

  return { reports };
});

export const adminModerateReport = onCall(CALL_OPTIONS, async (request) => {
  const adminUid = requireAdmin(request);
  const data = isRecord(request.data) ? request.data : {};
  const reportId = text(data.reportId, 200);
  const action = text(data.action, 40);
  const note = text(data.note, 500);
  const allowed = new Set([
    'review',
    'dismiss',
    'resolve',
    'warn',
    'suspend',
    'unsuspend',
    'delete-message',
  ]);
  if (!reportId || !allowed.has(action)) {
    throw new HttpsError('invalid-argument', 'Acción de moderación inválida.');
  }

  const reportRef = db().doc(`reports/${reportId}`);
  const report = await reportRef.get();
  if (!report.exists) throw new HttpsError('not-found', 'El reporte no existe.');

  const reportedUid = text(report.get('reportedUid'), 128);
  const targetType = text(report.get('targetType'), 40) || 'user';
  const targetId = text(report.get('targetId'), 200);
  const chatId = text(report.get('chatId'), 200);
  const now = Date.now();
  let status = 'reviewed';

  if (action === 'dismiss') status = 'dismissed';
  if (action === 'resolve') status = 'resolved';
  if (action === 'warn') status = 'warned';
  if (action === 'suspend') {
    if (!reportedUid) throw new HttpsError('failed-precondition', 'El reporte no tiene usuario.');
    await db().doc(`users/${reportedUid}`).set(
      { suspended: true, suspendedAt: now, suspensionReason: note || 'Moderación' },
      { merge: true }
    );
    status = 'actioned';
  }
  if (action === 'unsuspend') {
    if (!reportedUid) throw new HttpsError('failed-precondition', 'El reporte no tiene usuario.');
    await db().doc(`users/${reportedUid}`).set(
      { suspended: false, updatedAt: now },
      { merge: true }
    );
    status = 'resolved';
  }
  if (action === 'delete-message') {
    if (targetType !== 'message' || !targetId || !chatId) {
      throw new HttpsError('failed-precondition', 'El reporte no apunta a un mensaje.');
    }
    await db().doc(`chats/${chatId}/messages/${targetId}`).delete();
    status = 'actioned';
  }

  await reportRef.set({ status, reviewedBy: adminUid, reviewedAt: now, note }, { merge: true });
  await db().collection('moderationActions').add({
    adminUid,
    reportId,
    action,
    reportedUid,
    targetType,
    targetId: targetId || null,
    chatId: chatId || null,
    note,
    createdAt: now,
  });

  return { status };
});
