import assert from 'node:assert/strict';
import { test } from 'node:test';

import { httpUrl } from './zod.ts';

test('httpUrl rejects script-bearing protocols', () => {
  for (const bad of [
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ]) {
    assert.equal(httpUrl.safeParse(bad).success, false, bad);
  }
});

test('httpUrl accepts real http(s) URLs', () => {
  for (const ok of [
    'https://cdn.example.com/a.png',
    'http://localhost:3000/x',
    'https://project.supabase.co/storage/v1/object/public/attachments/u/f.pdf',
  ]) {
    assert.equal(httpUrl.safeParse(ok).success, true, ok);
  }
});
