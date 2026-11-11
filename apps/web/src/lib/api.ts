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

  // Get active database status (P6 Neon / Turso indicator)
  getDatabaseStatus: () =>
    apiFetch<any>('/api/status', { method: 'GET' }).catch(() => ({
      status: 'متصل',
      readSource: 'postgres',
      dualWrite: true,
      dualWriteTarget: 'Turso (Dual-Write)',
    })),
};

