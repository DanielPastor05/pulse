import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isEmojiOnly, linkifyMentions } from './markdown.ts';

test('mentions become profile links', () => {
  assert.equal(linkifyMentions('hi @ada'), 'hi [@ada](/u/ada)');
  assert.equal(linkifyMentions('@ada ping @grace'), '[@ada](/u/ada) ping [@grace](/u/grace)');
});

test('code is never rewritten', () => {
  assert.equal(linkifyMentions('`@ada`'), '`@ada`');
  assert.equal(linkifyMentions('```\n@ada\n```'), '```\n@ada\n```');
});

test('email addresses are left alone', () => {
  assert.equal(linkifyMentions('mail me@example.com'), 'mail me@example.com');
});

test('handles that are too short are ignored', () => {
  assert.equal(linkifyMentions('@ab'), '@ab');
});

test('emoji-only messages are detected', () => {
  assert.equal(isEmojiOnly('🎉'), true);
  assert.equal(isEmojiOnly('🎉 🎉'), true);
  assert.equal(isEmojiOnly('nice 🎉'), false);
  assert.equal(isEmojiOnly(''), false);
});
