/**
 * Common API response types matching Go backend models
 */

// Common response structures
export interface ErrorResponse {
  code: number;
  message: string;
  details?: string;
}

export interface SuccessResponse<T = any> {
  status: string;
  message?: string;
  data?: T;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T = any> {
  data: T;
  pagination: PaginationMeta;
}

// HTTP status codes for type safety
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
