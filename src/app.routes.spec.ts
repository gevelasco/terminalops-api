import { RequestMethod, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AppModule } from './app.module';
import { AuthGuard } from './guards/auth/auth.guard';
import { IS_PUBLIC_KEY } from './decorators/public/public.decorator';

const PUBLIC_ROUTES = [
  'GET /',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'POST /auth/sign-up',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
];

type ModuleRef =
  | Type<unknown>
  | {
      module: Type<unknown>;
      imports?: unknown[];
      controllers?: Type<unknown>[];
    };

const getMetadata = <T>(key: string, target: object): T[] =>
  (Reflect.getMetadata(key, target) as T[] | undefined) ?? [];

function collectControllers(
  ref: ModuleRef,
  seen = new Set<unknown>(),
  out = new Set<Type<unknown>>(),
) {
  if (!ref || seen.has(ref)) {
    return out;
  }
  seen.add(ref);
  const isDynamic = typeof ref === 'object' && 'module' in ref;
  const moduleClass = isDynamic ? ref.module : ref;
  const controllers = [
    ...getMetadata<Type<unknown>>(MODULE_METADATA.CONTROLLERS, moduleClass),
    ...(isDynamic ? (ref.controllers ?? []) : []),
  ];
  controllers.forEach((c) => out.add(c));
  const imports = [
    ...getMetadata<ModuleRef>(MODULE_METADATA.IMPORTS, moduleClass),
    ...(isDynamic ? ((ref.imports ?? []) as ModuleRef[]) : []),
  ];
  imports.forEach((i) => collectControllers(i, seen, out));
  return out;
}

const joinPath = (...parts: string[]) =>
  '/' +
  parts
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/');

function collectRoutes() {
  const routes: { route: string; isPublic: boolean }[] = [];
  for (const controller of collectControllers(AppModule)) {
    const basePath =
      (Reflect.getMetadata(PATH_METADATA, controller) as string) ?? '';
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') {
        continue;
      }
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (method === undefined) {
        continue;
      }
      const path =
        (Reflect.getMetadata(PATH_METADATA, handler) as string) ?? '';
      routes.push({
        route: `${RequestMethod[method]} ${joinPath(basePath, path)}`,
        isPublic:
          classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
      });
    }
  }
  return routes;
}

describe('App routes', () => {
  const routes = collectRoutes();

  it('discovers controller routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(40);
  });

  it('registers AuthGuard as a global guard', () => {
    const providers = getMetadata<unknown>(
      MODULE_METADATA.PROVIDERS,
      AppModule,
    );
    expect(providers).toContainEqual({
      provide: APP_GUARD,
      useClass: AuthGuard,
    });
  });

  it('only exposes the allowlisted public routes', () => {
    const publicRoutes = routes
      .filter((r) => r.isPublic)
      .map((r) => r.route)
      .sort();
    expect(publicRoutes).toEqual([...PUBLIC_ROUTES].sort());
  });
});
