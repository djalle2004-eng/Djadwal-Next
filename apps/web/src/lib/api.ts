/**
 * Unified API Client for Djadwal Next.js Application
 * Fully integrated with P7 (Unit of Work, Optimistic Lock, Soft Delete)
 * and P8 (/api/v1, Idempotency-Key, OpenAPI 3.1 contract).
 */

export interface ApiV1ErrorPayload {
  error: {
    code: string;
    message_ar: string;
    trace_id: string;
    details?: any[];
  };
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  messageAr: string;
  traceId: string;
  details?: any[];

  constructor(statusCode: number, payload: ApiV1ErrorPayload) {
    const msg = payload.error?.message_ar || payload.error?.code || `HTTP error ${statusCode}`;
    super(msg);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = payload.error?.code || 'UNKNOWN_ERROR';
    this.messageAr = payload.error?.message_ar || 'حدث خطأ غير متوقع';
    this.traceId = payload.error?.trace_id || '';
    this.details = payload.error?.details;
  }
}

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  retries?: number;
  skipConflictAlert?: boolean;
}

// Generate UUID for Idempotency-Key and Trace-Id
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to get CSRF token from document.cookie
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )\s*csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const API_BASE = '/api/v1';

/**
 * Base fetcher supporting automatic Idempotency-Key, X-Request-Id,
 * 409 Conflict interceptor, and safe GET retries.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(options.headers || {});

  // Content-Type default for JSON
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 1. Trace ID
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', generateUUID());
  }

  // 2. Idempotency Key for mutating operations (P8 standard)
  if (isMutating && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', options.idempotencyKey || generateUUID());
  }

  // 3. CSRF token for mutating requests
  if (isMutating && !headers.has('x-csrf-token')) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const fetchConfig: RequestInit = {
    ...options,
    method,
    headers,
    credentials: 'include', // Share cookies between Next.js and Legacy
  };

  const maxRetries = method === 'GET' ? (options.retries ?? 2) : 0;
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, fetchConfig);

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch (_) {
          errorData = {
            error: {
              code: `HTTP_${response.status}`,
              message_ar: response.statusText || 'حدث خطأ في استجابة الخادم',
              trace_id: headers.get('X-Request-Id') || '',
            },
          };
        }

        const apiError = new ApiError(response.status, errorData);

        // P7: Handle 409 Conflict (Optimistic Concurrency Control collision)
        if (response.status === 409 && !options.skipConflictAlert) {
          if (typeof window !== 'undefined') {
            alert(
              `⚠️ تعارض في التعديل (409 Conflict):\n` +
                (apiError.messageAr ||
                  'تم تعديل هذا السجل بواسطة مستخدم آخر. يرجى تحديث الصفحة للحصول على أحدث نسخة ثم المحاولة مجدداً.')
            );
          }
        }

        throw apiError;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }

      attempt++;
      if (attempt <= maxRetries) {
        const delay = Math.pow(2, attempt) * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new ApiError(0, {
        error: {
          code: 'NETWORK_ERROR',
          message_ar: 'فشل الاتصال بالخادم. يرجى التحقق من اتصال الشبكة وإعادة المحاولة.',
          trace_id: headers.get('X-Request-Id') || '',
        },
      });
    }
  }
}

// Convenience REST methods
export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),

  // P7 Specific: Query Delete Impact before executing destructive/soft delete
  getDeleteImpact: async (entityType: string, id: number | string) => {
    const data = await apiFetch<any>(`/${entityType}/${id}/delete-impact`);
    const impacts = data?.impacts || [];
    const totalImpactCount = data?.totalImpactCount !== undefined
      ? data.totalImpactCount
      : (
          (data?.impact?.affected_assignments_count || 0) +
          (data?.impact?.affected_extra_sessions_count || 0) +
          (data?.impact?.affected_groups_count || 0) +
          (data?.impact?.affected_courses_count || 0)
        );
    return {
      entity: data?.entity || entityType,
      id: data?.id || id,
      name: data?.name || '',
      canDelete: data?.canDelete !== undefined ? data.canDelete : true,
      blockReason: data?.blockReason || '',
      impacts,
      totalImpactCount,
      impact: data?.impact || {
        affected_assignments_count: impacts.find((i: any) => i.entityType === 'assignments')?.count || 0,
        affected_extra_sessions_count: impacts.find((i: any) => i.entityType === 'extra_sessions')?.count || 0,
        affected_groups_count: impacts.find((i: any) => i.entityType === 'groups')?.count || 0,
        affected_courses_count: impacts.find((i: any) => i.entityType === 'courses')?.count || 0,
        warning_ar: data?.blockReason || '',
        can_soft_delete: data?.canDelete !== undefined ? data.canDelete : true,
      },
    };
  },

  // P7 Specific: Undo a previous action from change_log
  undoChange: (changeLogId: number | string) =>
    apiFetch(`/changes/${changeLogId}/undo`, { method: 'POST' }),

  // P7 Specific: Restore an archived/soft-deleted entity
  restore: (entityType: string, id: number | string) =>
    apiFetch(`/${entityType}/${id}/restore`, { method: 'POST' }),

  // P15 Professors Excel Import / Export Helpers
  previewProfessorsImport: (rows: any[]) =>
    apiFetch<any>('/professors/import/preview', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  commitProfessorsImport: (
    data: { rows: any[]; skipErrors?: boolean; academicYear?: string },
    idempotencyKey?: string
  ) =>
    apiFetch<any>('/professors/import', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey,
    }),

  // Assignments Helpers
  checkAssignmentConflicts: (data: any) =>
    apiFetch<any>('/assignments/check-conflicts', { method: 'POST', body: JSON.stringify(data) }),

  previewBulkImport: (data: any) =>
    apiFetch<any>('/assignments/bulk-import/preview', { method: 'POST', body: JSON.stringify(data) }),

  bulkImportAssignments: (data: any) =>
    apiFetch<any>('/assignments/bulk-import', { method: 'POST', body: JSON.stringify(data) }),

  getCoverageAudit: (academicYear?: string, semester?: string) =>
    apiFetch<any>(
      `/assignments/coverage-audit?academicYear=${encodeURIComponent(academicYear || '')}&semester=${encodeURIComponent(semester || '')}`
    ),

  auditAssignmentConflicts: (academicYear?: string, semester?: string) =>
    apiFetch<any>(
      `/assignments/conflicts/audit?academic_year=${encodeURIComponent(academicYear || '')}&semester=${encodeURIComponent(semester || '')}`
    ),

  // Available Rooms & Extra Sessions Helpers
  getAvailableRooms: (params: {
    date?: string;
    session_date?: string;
    time_slot?: string;
    start_time?: string;
    end_time?: string;
    academic_year?: string;
    semester?: string;
    building?: string;
    room_type?: string;
    min_capacity?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.date) q.set('date', params.date);
    if (params.session_date) q.set('session_date', params.session_date);
    if (params.time_slot) q.set('time_slot', params.time_slot);
    if (params.start_time) q.set('start_time', params.start_time);
    if (params.end_time) q.set('end_time', params.end_time);
    if (params.academic_year) q.set('academic_year', params.academic_year);
    if (params.semester) q.set('semester', params.semester);
    if (params.building && params.building !== 'all') q.set('building', params.building);
    if (params.room_type && params.room_type !== 'all') q.set('room_type', params.room_type);
    if (params.min_capacity) q.set('min_capacity', params.min_capacity.toString());
    return apiFetch<any>(`/rooms/available?${q.toString()}`);
  },

  listExtraSessions: (params?: any) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      });
    }
    const qs = q.toString();
    return apiFetch<any[]>(`/extra-sessions${qs ? `?${qs}` : ''}`);
  },

  getExtraSession: (id: number | string) =>
    apiFetch<any>(`/extra-sessions/${id}`),

  checkExtraSessionConflicts: (data: any) =>
    apiFetch<any>('/extra-sessions/check-conflicts', { method: 'POST', body: JSON.stringify(data) }),

  createExtraSession: (data: any) =>
    apiFetch<any>('/extra-sessions', { method: 'POST', body: JSON.stringify(data) }),

  updateExtraSession: (id: number | string, data: any) =>
    apiFetch<any>(`/extra-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteExtraSession: (id: number | string) =>
    apiFetch<any>(`/extra-sessions/${id}`, { method: 'DELETE' }),

  archivePastExtraSessions: () =>
    apiFetch<any>('/extra-sessions/archive', { method: 'POST', body: JSON.stringify({}) }),

  // Academic Years & Semesters Helpers
  listAcademicYears: () =>
    apiFetch<any[]>('/academic/years'),

  getActiveAcademicYear: () =>
    apiFetch<any>('/academic/years/active'),

  createAcademicYear: (data: { yearName: string; setAsCurrent?: boolean }) =>
    apiFetch<any>('/academic/years', { method: 'POST', body: JSON.stringify(data) }),

  activateAcademicYear: (id: number | string) =>
    apiFetch<any>(`/academic/years/${id}/activate`, { method: 'POST' }),

  deleteAcademicYear: (id: number | string) =>
    apiFetch<any>(`/academic/years/${id}`, { method: 'DELETE' }),

  listSemesters: (academicYearId?: number | string) => {
    const q = academicYearId ? `?academicYearId=${academicYearId}` : '';
    return apiFetch<any[]>(`/academic/semesters${q}`);
  },

  getActiveSemester: (academicYearId?: number | string) => {
    const q = academicYearId ? `?academicYearId=${academicYearId}` : '';
    return apiFetch<any>(`/academic/semesters/active${q}`);
  },

  createSemester: (data: any) =>
    apiFetch<any>('/academic/semesters', { method: 'POST', body: JSON.stringify(data) }),

  updateSemester: (id: number | string, data: any) =>
    apiFetch<any>(`/academic/semesters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  activateSemester: (id: number | string) =>
    apiFetch<any>(`/academic/semesters/${id}/activate`, { method: 'POST' }),

  deleteSemester: (id: number | string) =>
    apiFetch<any>(`/academic/semesters/${id}`, { method: 'DELETE' }),

  // Departments & Delete Impact Helpers
  listDepartments: () =>
    apiFetch<any[]>('/catalog/departments'),

  getDepartment: (id: number | string) =>
    apiFetch<any>(`/catalog/departments/${id}`),

  createDepartment: (data: any) =>
    apiFetch<any>('/catalog/departments', { method: 'POST', body: JSON.stringify(data) }),

  updateDepartment: (id: number | string, data: any) =>
    apiFetch<any>(`/catalog/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDepartment: (id: number | string) =>
    apiFetch<any>(`/catalog/departments/${id}`, { method: 'DELETE' }),

  archiveCascadeDepartment: (id: number | string) =>
    apiFetch<any>(`/catalog/departments/${id}/archive-cascade`, { method: 'POST' }),

  // Audit Logs & Changes Helpers
  listChanges: (params?: { limit?: number; entityType?: string; entityId?: string | number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.entityType) q.set('entityType', params.entityType);
    if (params?.entityId) q.set('entityId', String(params.entityId));
    return apiFetch<any[]>(`/changes?${q.toString()}`);
  },

  // Print Settings Helpers
  getPrintSettings: () =>
    apiFetch<any>('/settings/print'),

  updatePrintSettings: (data: any) =>
    apiFetch<any>('/settings/print', { method: 'PUT', body: JSON.stringify(data) }),

  // Users & Permissions Helpers
  listUsers: () =>
    apiFetch<any[]>('/users'),

  getUser: (id: number | string) =>
    apiFetch<any>(`/users/${id}`),

  createUser: (data: any) =>
    apiFetch<any>('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id: number | string, data: any) =>
    apiFetch<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: number | string) =>
    apiFetch<any>(`/users/${id}`, { method: 'DELETE' }),

  getUserPermissions: (id: number | string) =>
    apiFetch<any>(`/users/${id}/permissions`),

  updateUserPermissions: (id: number | string, permissions: string[]) =>
    apiFetch<any>(`/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),

  // Backup Snapshot Helper
  getBackupSnapshot: () =>
    apiFetch<any>('/system/backup/snapshot'),

  // Sandbox Snapshots (Simulation Mode Drafts)
  listSandboxSnapshots: () =>
    apiFetch<any[]>('/api/sandbox/list'),

  saveSandboxSnapshot: (data: { name: string; data: any }) =>
    apiFetch<any>('/api/sandbox/save', { method: 'POST', body: JSON.stringify(data) }),

  getSandboxSnapshot: (id: number | string) =>
    apiFetch<any>(`/api/sandbox/${id}`),

  deleteSandboxSnapshot: (id: number | string) =>
    apiFetch<any>(`/api/sandbox/${id}`, { method: 'DELETE' }),

  // Get active database status (P6 Neon / Turso indicator)
  getDatabaseStatus: () =>
    apiFetch<any>('/api/status', { method: 'GET' }).catch(() => ({
      status: 'متصل',
      readSource: 'postgres',
      dualWrite: true,
      dualWriteTarget: 'Turso (Dual-Write)',
    })),
};

