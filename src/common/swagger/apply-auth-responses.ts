import type { OpenAPIObject } from '@nestjs/swagger';

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

const UNAUTHORIZED = { description: 'Missing or invalid access token.' };

/** Documenta 401 en operaciones protegidas; las @Public() (`security: [{}]`) se omiten. */
export function applyAuthResponses(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation || isPublicOperation(operation.security)) {
        continue;
      }
      operation.responses ??= {};
      operation.responses['401'] ??= { ...UNAUTHORIZED };
    }
  }
  return document;
}

function isPublicOperation(
  security: Record<string, string[]>[] | undefined,
): boolean {
  return (
    Array.isArray(security) &&
    security.length > 0 &&
    security.every((requirement) => Object.keys(requirement).length === 0)
  );
}
