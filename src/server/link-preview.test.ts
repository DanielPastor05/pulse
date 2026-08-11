import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstUrl, isPrivateAddress, parseLinkPreviewHtml } from './link-preview.ts';

test('isPrivateAddress rejects everything that points back inside', () => {
  for (const address of [
    '127.0.0.1',
    '127.9.9.9',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '0.0.0.0',
    '169.254.169.254', // cloud metadata — the usual target
    '100.64.0.1', // carrier-grade NAT
    '198.18.0.1', // benchmarking
    '224.0.0.1', // multicast
    '::1',
    '::',
    'fc00::1', // unique local
    'fd12:3456::1', // unique local
    'fe80::1', // link local
    '::ffff:127.0.0.1', // IPv4 loopback wearing an IPv6 costume
    '::ffff:169.254.169.254',
    'not-an-ip',
    '',
  ]) {
    assert.equal(isPrivateAddress(address), true, `should be blocked: ${address}`);
  }
});

test('isPrivateAddress allows ordinary public addresses', () => {
  for (const address of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700::1111']) {
    assert.equal(isPrivateAddress(address), false, `should be allowed: ${address}`);
  }
});

test('172.16/12 boundaries are not off by one', () => {
  assert.equal(isPrivateAddress('172.15.255.255'), false);
  assert.equal(isPrivateAddress('172.16.0.0'), true);
  assert.equal(isPrivateAddress('172.31.255.255'), true);
  assert.equal(isPrivateAddress('172.32.0.0'), false);
});

test('firstUrl finds the first link and trims sentence punctuation', () => {
  assert.equal(firstUrl('mira esto https://example.com/a'), 'https://example.com/a');
  assert.equal(firstUrl('¿has visto https://example.com/a?'), 'https://example.com/a');
  assert.equal(firstUrl('https://a.test y https://b.test'), 'https://a.test');
  assert.equal(firstUrl('sin enlaces aqui'), null);
});

test('firstUrl ignores links inside code', () => {
  assert.equal(firstUrl('`https://example.com`'), null);
  assert.equal(firstUrl('```\nhttps://example.com\n```'), null);
  assert.equal(
    firstUrl('```\nhttps://oculto.test\n```\nhttps://visible.test'),
    'https://visible.test',
  );
});

test('firstUrl skips absurdly long URLs rather than truncating them', () => {
  assert.equal(firstUrl(`https://example.com/${'a'.repeat(600)}`), null);
});

test('firstUrl no devuelve restos inparseables', () => {
  // El corchete queda fuera de la clase de caracteres para no tragarse los
  // enlaces de markdown, lo que parte una IPv6 literal por la mitad.
  assert.equal(firstUrl('mira http://[::1]:8080/'), null);
  assert.equal(firstUrl('ver [esto](https://ejemplo.test/x)'), 'https://ejemplo.test/x');
});

test('parseLinkPreviewHtml prefers Open Graph tags', () => {
  const card = parseLinkPreviewHtml(
    `<html><head>
       <title>Ignorado</title>
       <meta property="og:title" content="El titulo bueno">
       <meta property="og:description" content="La descripcion">
       <meta property="og:site_name" content="Sitio">
       <meta property="og:image" content="/imagen.png">
     </head></html>`,
    'https://ejemplo.test/articulo',
  );
  assert.equal(card?.title, 'El titulo bueno');
  assert.equal(card?.description, 'La descripcion');
  assert.equal(card?.siteName, 'Sitio');
  assert.equal(card?.imageUrl, 'https://ejemplo.test/imagen.png'); // relativa resuelta
});

test('parseLinkPreviewHtml cae al <title> cuando no hay Open Graph', () => {
  const card = parseLinkPreviewHtml('<html><head><title>Solo titulo</title></head></html>', 'https://a.test');
  assert.equal(card?.title, 'Solo titulo');
});

test('parseLinkPreviewHtml descarta imagenes que no sean http(s)', () => {
  const card = parseLinkPreviewHtml(
    `<html><head><title>t</title><meta property="og:image" content="javascript:alert(1)"></head></html>`,
    'https://a.test',
  );
  assert.equal(card?.imageUrl, null);
});

test('parseLinkPreviewHtml desescapa entidades y no devuelve tarjeta vacia', () => {
  const card = parseLinkPreviewHtml(
    `<html><head><meta property="og:title" content="Ben &amp; Jerry&#39;s"></head></html>`,
    'https://a.test',
  );
  assert.equal(card?.title, "Ben & Jerry's");
  assert.equal(parseLinkPreviewHtml('<html><body>nada</body></html>', 'https://a.test'), null);
});
