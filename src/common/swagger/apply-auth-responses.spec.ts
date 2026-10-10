import type { OpenAPIObject } from '@nestjs/swagger';
import { applyAuthResponses } from './apply-auth-responses';

describe('applyAuthResponses', () => {
  const build = (): OpenAPIObject => ({
    openapi: '3.0.0',
    info: { title: 't', version: '1' },
    paths: {
      '/public': { get: { security: [{}], responses: {} } },
      '/protected': { get: { responses: { '200': { description: 'ok' } } } },
      '/login': {
        post: {
          security: [{}],
          responses: { '401': { description: 'Invalid credentials.' } },
        },
      },
    },
  });

  it('skips public operations', () => {
    const doc = applyAuthResponses(build());
    expect(doc.paths['/public'].get!.responses).toEqual({});
  });

  it('adds 401 to protected operations', () => {
    const doc = applyAuthResponses(build());
    expect(doc.paths['/protected'].get!.responses['401']).toEqual({
      description: 'Missing or invalid access token.',
    });
  });

  it('does not overwrite an existing 401 on public login', () => {
    const doc = applyAuthResponses(build());
    expect(doc.paths['/login'].post!.responses['401']).toEqual({
      description: 'Invalid credentials.',
    });
  });
});
