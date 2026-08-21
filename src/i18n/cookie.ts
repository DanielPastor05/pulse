/**
 * El nombre de la cookie del idioma, en un módulo sin directiva.
 *
 * Vivía en `provider.tsx`, que lleva `'use client'`. Un módulo de cliente no
 * exporta valores al servidor: exporta *referencias* que el cliente resolverá
 * después. Así que `cookies().get(LOCALE_COOKIE)` en el servidor no buscaba
 * «pulse-locale», buscaba un objeto, encontraba nada, y el idioma elegido a
 * mano se ignoraba en silencio — que es justo el mecanismo del selector.
 *
 * Compila igual en los dos sitios, así que sólo lo delató ejecutarlo.
 */
export const LOCALE_COOKIE = 'pulse-locale';
