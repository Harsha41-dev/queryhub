// same shape for all API responses: { ok: true, data } or { ok: false, error }

export type ActionError = {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string[]> };
};

export type ActionSuccess<T> = { ok: true; data: T };
export type ActionResult<T> = ActionSuccess<T> | ActionError;

export function actionError(
  code: string,
  message: string,
  fields?: Record<string, string[]>,
): ActionError {
  return { ok: false, error: { code, message, fields } };
}

export function actionSuccess<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}
