import { expect, test } from '@playwright/test';

/**
 * ¿Sale la aplicación en el idioma que toca?
 *
 * Esto vive en las pruebas de humo y no en las unitarias por un motivo
 * concreto: el fallo que motivó el fichero **compilaba perfectamente**. El
 * nombre de la cookie estaba exportado desde un módulo con `'use client'`, y un
 * módulo de cliente no le da valores al servidor, le da referencias. El
 * servidor buscaba una cookie llamada «[object]», no la encontraba nunca, y se
 * caía silenciosamente a `Accept-Language`. Es decir: el selector de idioma no
 * hacía nada, y todo —tipos, lint, compilación— decía que sí.
 *
 * Sólo se ve ejecutándolo, así que se comprueba ejecutándolo.
 *
 * Se mira el atributo `lang` del documento y no un texto concreto: es lo que
 * fija el idioma para los lectores de pantalla, y no se rompe cada vez que
 * alguien reescriba una frase.
 */

const ENTRADA = '/login';

test('la elección explícita gana al idioma del navegador', async ({ browser }) => {
  // El navegador pide español; la cookie dice inglés. Manda la cookie: es lo
  // que esta persona eligió a mano.
  const context = await browser.newContext({ locale: 'es-ES' });
  const page = await context.newPage();

  // Se navega antes de poner la cookie para tomar el origen de la propia
  // página: la dirección base cambia entre local y CI, y fijarla aquí a mano
  // haría que la cookie no llegase justo donde importa comprobarlo.
  await page.goto(ENTRADA);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await context.addCookies([{ name: 'pulse-locale', value: 'EN', url: page.url() }]);
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();

  await context.close();
});

test('sin cookie se respeta el idioma que pide el navegador', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-ES' });
  const page = await context.newPage();
  await page.goto(ENTRADA);

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('button', { name: /^entrar$/i })).toBeVisible();

  await context.close();
});

test('un idioma que no existe cae al inglés en vez de romperse', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(ENTRADA);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await context.close();
});

test('el título de la pestaña también viaja traducido', async ({ browser }) => {
  // Los metadatos se resuelven por separado del cuerpo de la página, así que
  // pueden quedarse atrás sin que se note mirando la pantalla.
  const context = await browser.newContext({ locale: 'es-ES' });
  const page = await context.newPage();
  await page.goto(ENTRADA);

  await expect(page).toHaveTitle(/entrar/i);

  await context.close();
});
