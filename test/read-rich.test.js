import assert from 'node:assert/strict';
import { AIRich } from '../lib/MessageBuilder/index.js';
import {
    a2uiColumn,
    a2uiText,
    htmlSection,
    readRichMessage,
    sendA2UI,
    sendBloksWidget,
    sendHtmlApp
} from '../lib/MessageBuilder/extras.js';

const calls = [];
const sock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (jid, message) => { calls.push(message); } };
const last = () => calls[calls.length - 1];

assert.equal(readRichMessage(null), null);
assert.equal(readRichMessage({ message: { conversation: 'halo' } }), null);
assert.equal(readRichMessage({ message: { imageMessage: { url: 'x' } } }), null);

calls.length = 0;
await sendA2UI(sock, '2@s.whatsapp.net', [
    a2uiColumn('root', ['t', 'd']),
    a2uiText('t', 'Welcome!', { variant: 'h1' }),
    a2uiText('d', 'Halo dunia')
], { uuid: 'u-1', buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Join', url: 'https://x' }) }] });

const a2ui = readRichMessage(last());
assert.equal(a2ui.kind, 'a2ui');
assert.equal(a2ui.text, 'Welcome!\nHalo dunia');
assert.equal(a2ui.a2ui.surfaceId, 'card-u-1');
assert.equal(a2ui.a2ui.version, 'v0.9');
assert.equal(a2ui.a2ui.components.length, 3);
assert.equal(a2ui.bloks.type, 'im_a2ui');
assert.deepEqual(a2ui.buttons, [{ name: 'cta_url', params: { display_text: 'Join', url: 'https://x' } }]);

calls.length = 0;
await sendHtmlApp(sock, '2@s.whatsapp.net', '<b>halo</b>', { title: 'MINI APP', label: 'buka' });
const html = readRichMessage(last());
assert.equal(html.kind, 'airich');
assert.equal(html.title, 'MINI APP');
assert.deepEqual(html.html, ['<b>halo</b>']);
assert.deepEqual(html.typenames, ['GenAIaeacdsnwHtmlPrimitive']);
assert.deepEqual(html.submessages, [{ messageType: 2, messageText: 'buka' }]);
assert.ok(html.responseId);

calls.length = 0;
const rich = new AIRich(sock);
rich.setTitle('JUDUL');
rich.addText('baris pertama');
rich.addText('baris kedua');
rich.addSection(htmlSection('<i>x</i>'));
await rich.send('2@s.whatsapp.net');
assert.ok(calls.length >= 1);
const teks = readRichMessage(calls[0]);
assert.equal(teks.kind, 'airich');
assert.ok(teks.text.includes('baris pertama'));
assert.ok(teks.text.includes('baris kedua'));
assert.deepEqual(teks.html, ['<i>x</i>']);

calls.length = 0;
await sendBloksWidget(sock, '2@s.whatsapp.net', { type: 'im_lain', data: { a: 1 }, fallback: 'tidak didukung' });
const bloks = readRichMessage(last());
assert.equal(bloks.kind, 'bloks');
assert.equal(bloks.bloks.type, 'im_lain');
assert.deepEqual(bloks.bloks.params, { a: 1 });
assert.equal(bloks.a2ui, undefined);
assert.equal(bloks.text, 'tidak didukung');

const dibungkus = { message: { viewOnceMessageV2: { message: last().interactiveMessage ? { interactiveMessage: last().interactiveMessage } : {} } } };
assert.equal(readRichMessage(dibungkus).kind, 'bloks');

const polos = readRichMessage({
    message: { interactiveMessage: { body: { text: 'badan' }, footer: { text: 'kaki' }, nativeFlowMessage: { buttons: [{ name: 'x', buttonParamsJson: 'bukan json' }] } } }
});
assert.equal(polos.kind, 'interactive');
assert.equal(polos.text, 'badan\nkaki');
assert.deepEqual(polos.buttons, [{ name: 'x', params: null }]);

const kedua = calls.map(readRichMessage).filter(Boolean);
assert.equal(kedua.length, 1);

console.log('read rich tests passed');
