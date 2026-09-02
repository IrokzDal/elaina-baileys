import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import {
    A2UI_BASIC_CATALOG,
    A2UI_VERSION,
    BLOKS_A2UI_TYPE,
    a2uiColumn,
    a2uiImage,
    a2uiRow,
    a2uiSurface,
    a2uiText,
    a2uiWidget,
    decodeBloksWidget,
    sendA2UI
} from '../lib/MessageBuilder/extras.js';

assert.equal(A2UI_VERSION, 'v0.9');
assert.equal(A2UI_BASIC_CATALOG, 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json');

assert.deepEqual(a2uiText('t', 'Halo'), { id: 't', component: 'Text', text: 'Halo', variant: 'body' });
assert.deepEqual(a2uiText('t', 'Judul', { variant: 'h1' }).variant, 'h1');
assert.deepEqual(a2uiImage('i', 'https://x/y.jpg'), {
    id: 'i', component: 'Image', url: 'https://x/y.jpg', variant: 'header', fit: 'cover'
});
assert.deepEqual(a2uiColumn('root', ['a', 'b']), { id: 'root', component: 'Column', children: ['a', 'b'] });
assert.equal(a2uiRow('r', []).component, 'Row');

assert.throws(() => a2uiText('', 'x'), TypeError);
assert.throws(() => a2uiImage('i', ''), TypeError);
assert.throws(() => a2uiColumn('root', 'bukan array'), TypeError);

const components = [
    a2uiColumn('root', ['card_image', 'card_title', 'card_description']),
    a2uiImage('card_image', 'https://pps.whatsapp.net/x.jpg'),
    a2uiText('card_title', 'Welcome!', { variant: 'h1' }),
    a2uiText('card_description', 'Halo!')
];

const surface = a2uiSurface(components, { surfaceId: 'card-1' });
assert.equal(surface.version, 'v0.9');
assert.equal(surface.createSurface.surfaceId, 'card-1');
assert.equal(surface.createSurface.catalogId, A2UI_BASIC_CATALOG);
assert.equal(surface.createSurface.sendDataModel, false);
assert.equal(surface.createSurface.components.length, 4);

assert.throws(() => a2uiSurface([]), TypeError);
assert.throws(() => a2uiSurface('x'), TypeError);
assert.throws(() => a2uiSurface([a2uiText('bukan_root', 'x')]), TypeError);

const widget = a2uiWidget(components, { uuid: 'u-1' });
assert.equal(widget.type, BLOKS_A2UI_TYPE);
assert.equal(widget.uuid, 'u-1');
assert.equal(widget.fallback, '');
assert.equal(typeof widget.data, 'string');
assert.equal(JSON.parse(widget.data).createSurface.surfaceId, 'card-u-1');

const encoded = proto.Message.encode({ interactiveMessage: { bloksWidget: widget } }).finish();
const back = proto.Message.decode(encoded).interactiveMessage.bloksWidget;
assert.equal(back.type, BLOKS_A2UI_TYPE);
assert.deepEqual(JSON.parse(back.data), JSON.parse(widget.data));

const calls = [];
const sock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (jid, message, opts) => { calls.push({ jid, message, opts }); } };

const button = { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Join', url: 'https://example.com' }) };
const sent = await sendA2UI(sock, '2@s.whatsapp.net', components, {
    uuid: 'u-2',
    buttons: [button],
    contextInfo: { isForwarded: true, forwardingScore: 1 }
});

assert.ok(sent.key.id);
assert.equal(calls.length, 1);
const interactive = calls[0].message.interactiveMessage;
assert.equal(interactive.bloksWidget.type, BLOKS_A2UI_TYPE);
assert.equal(interactive.bloksWidget.uuid, 'u-2');
assert.deepEqual(interactive.nativeFlowMessage.buttons, [button]);
assert.equal(interactive.nativeFlowMessage.messageParamsJson, '{}');
assert.equal(interactive.nativeFlowMessage.messageVersion, 1);
assert.equal(interactive.contextInfo.isForwarded, true);
assert.equal(calls[0].opts.additionalNodes[0].tag, 'biz');

const decoded = decodeBloksWidget(calls[0].message);
assert.equal(decoded.type, BLOKS_A2UI_TYPE);
assert.equal(decoded.params.createSurface.components[2].text, 'Welcome!');

calls.length = 0;
await sendA2UI(sock, '2@s.whatsapp.net', components);
assert.deepEqual(calls[0].message.interactiveMessage.nativeFlowMessage.buttons, []);
assert.equal(calls[0].message.interactiveMessage.contextInfo, undefined);

await assert.rejects(() => sendA2UI(null, '2@s.whatsapp.net', components), TypeError);
await assert.rejects(() => sendA2UI(sock, '', components), TypeError);
await assert.rejects(() => sendA2UI(sock, '2@s.whatsapp.net', components, { buttons: 'x' }), TypeError);

console.log('a2ui tests passed');
