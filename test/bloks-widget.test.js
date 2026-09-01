import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import {
    AI_RICH_PRIMITIVES,
    BLOKS_A2UI_REPLY_ACTION,
    BLOKS_A2UI_SUPPORTED_ELEMENTS,
    BLOKS_A2UI_TYPE,
    bloksSection,
    bloksWidget,
    decodeAIRich,
    decodeBloksWidget,
    sendBloksWidget
} from '../lib/MessageBuilder/extras.js';

assert.equal(BLOKS_A2UI_TYPE, 'im_a2ui');
assert.equal(BLOKS_A2UI_REPLY_ACTION, 'a2ui_reply_action');
assert.deepEqual(BLOKS_A2UI_SUPPORTED_ELEMENTS, ['info_card', 'list_card']);
assert.equal(AI_RICH_PRIMITIVES.includes('FOABloksPrimitive'), true);

const section = bloksSection(BLOKS_A2UI_TYPE, { title: 'halo' }, { uuid: 'u-1', versioningId: '123' });
assert.equal(section.view_model.__typename, 'GenAISingleLayoutViewModel');
assert.equal(section.view_model.primitive.__typename, 'FOABloksPrimitive');
assert.equal(section.view_model.primitive.type, BLOKS_A2UI_TYPE);
assert.equal(section.view_model.primitive.data, '{"title":"halo"}');
assert.equal(section.view_model.primitive.uuid, 'u-1');
assert.equal(section.view_model.primitive.initial_response, '');
assert.equal(section.view_model.primitive.versioning_id, '123');

assert.equal(bloksSection('t', '{"a":1}').view_model.primitive.data, '{"a":1}');
assert.equal(bloksSection('t').view_model.primitive.data, '');
assert.match(bloksSection('t').view_model.primitive.uuid, /^[0-9a-f-]{36}$/);

assert.throws(() => bloksSection(''), TypeError);
assert.throws(() => bloksSection(123), TypeError);
assert.throws(() => bloksSection('t', [1, 2]), TypeError);

const widget = bloksWidget({ type: BLOKS_A2UI_TYPE, data: { a2ui: 'info_card' }, uuid: 'u-2', fallback: 'buka di aplikasi terbaru' });
assert.deepEqual(widget, {
    type: BLOKS_A2UI_TYPE,
    data: '{"a2ui":"info_card"}',
    uuid: 'u-2',
    fallback: 'buka di aplikasi terbaru'
});
assert.throws(() => bloksWidget({}), TypeError);

const encoded = proto.Message.encode({ interactiveMessage: { bloksWidget: widget } }).finish();
const roundTrip = proto.Message.decode(encoded).interactiveMessage.bloksWidget;
assert.equal(roundTrip.type, widget.type);
assert.equal(roundTrip.data, widget.data);
assert.equal(roundTrip.uuid, widget.uuid);
assert.equal(roundTrip.fallback, widget.fallback);

const calls = [];
const sock = {
    user: { id: '1@s.whatsapp.net' },
    relayMessage: async (jid, message, opts) => { calls.push({ jid, message, opts }); }
};

const sent = await sendBloksWidget(sock, '2@s.whatsapp.net', {
    type: BLOKS_A2UI_TYPE,
    data: { a2ui_supported_elements: BLOKS_A2UI_SUPPORTED_ELEMENTS.join(', ') },
    fallback: 'Kartu tidak didukung di sini'
});

assert.ok(sent.key.id);
assert.equal(calls.length, 1);
assert.equal(calls[0].jid, '2@s.whatsapp.net');

const interactive = calls[0].message.interactiveMessage;
assert.equal(interactive.bloksWidget.type, BLOKS_A2UI_TYPE);
assert.equal(interactive.bloksWidget.data, '{"a2ui_supported_elements":"info_card, list_card"}');
assert.equal(interactive.body.text, 'Kartu tidak didukung di sini');
assert.equal(interactive.header, undefined);
assert.equal(interactive.footer, undefined);

const nodes = calls[0].opts.additionalNodes;
assert.equal(nodes[0].tag, 'biz');
assert.equal(nodes[0].content[0].content[0].attrs.name, 'mixed');

const decoded = decodeBloksWidget(calls[0].message);
assert.equal(decoded.type, BLOKS_A2UI_TYPE);
assert.equal(decoded.fallback, 'Kartu tidak didukung di sini');
assert.deepEqual(decoded.params, { a2ui_supported_elements: 'info_card, list_card' });

assert.equal(decodeBloksWidget({ message: { conversation: 'halo' } }), null);
assert.deepEqual(
    decodeBloksWidget({ message: { viewOnceMessage: { message: { interactiveMessage: { bloksWidget: widget } } } } }).params,
    { a2ui: 'info_card' }
);
assert.equal(decodeBloksWidget({ message: { interactiveMessage: { bloksWidget: { type: 't', data: 'bukan json' } } } }).params, null);

calls.length = 0;
await sendBloksWidget(sock, '2@s.whatsapp.net', { type: 't', body: '' });
assert.equal(calls[0].message.interactiveMessage.body, undefined);

calls.length = 0;
await sendBloksWidget(sock, '2@s.whatsapp.net', { type: 't', fallback: 'f', body: 'beda' });
assert.equal(calls[0].message.interactiveMessage.body.text, 'beda');

await assert.rejects(() => sendBloksWidget(null, '2@s.whatsapp.net', { type: 't' }), TypeError);
await assert.rejects(() => sendBloksWidget(sock, '', { type: 't' }), TypeError);
await assert.rejects(() => sendBloksWidget(sock, '2@s.whatsapp.net', {}), TypeError);

const richCalls = [];
const richSock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (jid, message) => { richCalls.push({ jid, message }); } };
const { AIRich } = await import('../lib/MessageBuilder/index.js');
const rich = new AIRich(richSock);
rich._addContent(bloksSection(BLOKS_A2UI_TYPE, { title: 'kartu' }));
await rich.send('2@s.whatsapp.net');
assert.deepEqual(decodeAIRich({ message: richCalls[0].message }).typenames, ['FOABloksPrimitive']);

console.log('bloks widget tests passed');
