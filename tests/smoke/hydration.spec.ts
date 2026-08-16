import { expect, test } from '@playwright/test';

/**
 * Does the application actually come alive in a browser?
 *
 * Everything here is reachable without a session, and none of it asserts
 * business behaviour — the integration and end-to-end suites do that. What
 * these check is the layer underneath all of them: that the page renders, that
 * the JavaScript loads and runs, and that nothing in the response headers stops
 * it. That failure mode has happened, it was invisible to every other kind of
 * test, and it took the whole site down.
 */

test('la pantalla de acceso se pinta con su formulario', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/sign in/i);
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
});

test('React hidrata: un control puramente de cliente responde', async ({ page }) => {
  await page.goto('/login');

  const password = page.locator('input[type="password"]');
  await expect(password).toBeVisible();

  // Mostrar la contraseña no habla con el servidor: sólo cambia el tipo del
  // campo desde el cliente. Si React no ha hidratado, el botón no hace nada —
  // que es exactamente lo que ocurría con la CSP rota, sin un solo error en
  // consola ni en el servidor.
  await page.getByRole('button', { name: /show password/i }).click();
  await expect(page.locator('input[type="text"][autocomplete="current-password"]')).toBeVisible();
});

test('la validación de cliente rechaza un correo mal formado sin ir al servidor', async ({ page }) => {
  await page.goto('/login');

  await page.locator('input[type="email"]').fill('esto-no-es-un-correo');
  await page.locator('input[type="password"]').fill('loquesea');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Zod corre en el navegador antes de enviar nada. Ver el mensaje prueba a la
  // vez que el formulario está cableado y que la validación viaja en el bundle.
  await expect(page.getByText(/valid email/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('no hay errores de consola al cargar', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errores.push(message.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  expect(errores).toEqual([]);
});

test('las cabeceras de seguridad viajan en la respuesta', async ({ page }) => {
  const response = await page.goto('/login');
  const headers = response?.headers() ?? {};

  // La CSP es la que rompió la aplicación entera una vez, así que además de
  // existir se comprueba que declara script-src: sin él, default-src cubre los
  // scripts con la semántica más restrictiva y nada se ejecuta.
  expect(headers['content-security-policy']).toContain('script-src');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBeTruthy();
});

test('el chequeo de salud responde sin sesión', async ({ request }) => {
  const response = await request.get('/api/health');

  // Sin base de datos accesible responde 503, que también es una respuesta
  // válida: lo que se comprueba aquí es que la ruta existe y no exige sesión.
  expect([200, 503]).toContain(response.status());
  expect(await response.json()).toHaveProperty('database');
});
