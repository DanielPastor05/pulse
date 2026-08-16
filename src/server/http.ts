import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';

import { publicEnv } from '@/lib/env';
import { AppError, errors } from '@/server/errors';
import { describeError, log } from '@/server/logger';

export type ApiErrorBody = { error: string; code: string; details?: unknown };

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/**
 * CSRF defence for state-changing route handlers.
 *
 * Supabase auth cookies are SameSite=Lax, so a cross-site POST cannot carry
 * them — this closes the remaining gap for same-site subdomains and proxies.
 */
export function assertSameOrigin(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD') return;

  const origin = request.headers.get('origin');
  if (!origin) return; // Same-origin fetches from the app always send one.

  const allowed = new Set([new URL(request.url).origin]);
  if (publicEnv.appUrl) allowed.add(publicEnv.appUrl);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);

  if (!allowed.has(origin)) throw errors.forbidden('Cross-origin request rejected.');
}

export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<TypeOf<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw errors.badRequest('Expected a JSON body.');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw errors.badRequest('Validation failed.', result.error.flatten());
  return result.data;
}

export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): TypeOf<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) throw errors.badRequest('Invalid query parameters.', result.error.flatten());
  return result.data;
}

function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed.', code: 'bad_request', details: error.flatten() },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'That already exists.', code: 'conflict' },
        { status: 409 },
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found.', code: 'not_found' }, { status: 404 });
    }
  }

  // Se reporta aquí y no se deja subir.
  //
  // `route()` captura todo para que cada endpoint devuelva la misma forma de
  // error, y ese acierto tenía un efecto que no se veía: al no relanzar, Next
  // nunca llama a `onRequestError`, así que **ningún fallo de las rutas de API
  // llegaba a Sentry** — justo la categoría donde vive casi todo. Lo demás
  // seguía reportándose, con lo que el panel parecía funcionar.
  //
  // Sólo esta rama. Un 400 de validación o un 409 por índice único son
  // respuestas previstas, no incidencias, y mandarlas ahogaría lo que sí
  // importa entre ruido.
  Sentry.captureException(error);
  log.error('api.unhandled_error', describeError(error));
  return NextResponse.json(
    { error: 'Something went wrong on our side.', code: 'internal' },
    { status: 500 },
  );
}

type Handler<Context> = (request: Request, context: Context) => Promise<Response> | Response;

/**
 * Wraps a route handler with origin checking and error normalisation so every
 * endpoint returns the same error shape.
 */
export function route<Context>(handler: Handler<Context>): Handler<Context> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
