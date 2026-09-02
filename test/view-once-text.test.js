import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { extractMessageContent, generateWAMessageContent } from '../lib/Utils/messages.js';

const upload = async () => ({});

assert.ok('viewOnce' in proto.Message.ExtendedTextMessage.prototype);
assert.ok('viewOnceMessageV2Extension' in proto.Message.prototype);
assert.equal(proto.Message.Conversation, undefined);

const content = await generateWAMessageContent({ text: 'rahasia', viewOnceV2Extension: true }, { upload });
const inner = content.viewOnceMessageV2Extension.message;
assert.equal(inner.extendedTextMessage.text, 'rahasia');
assert.equal(inner.extendedTextMessage.viewOnce, true);
assert.equal(inner.conversation ?? null, null);
assert.ok(content.messageContextInfo.messageSecret);

const encoded = proto.Message.encode(content).finish();
const decoded = proto.Message.decode(encoded);
assert.equal(decoded.viewOnceMessageV2Extension.message.extendedTextMessage.text, 'rahasia');
assert.equal(decoded.viewOnceMessageV2Extension.message.extendedTextMessage.viewOnce, true);

const unwrapped = extractMessageContent(content);
assert.equal(unwrapped.extendedTextMessage.text, 'rahasia');
assert.equal(unwrapped.extendedTextMessage.viewOnce, true);

const v2 = await generateWAMessageContent({ text: 'halo', viewOnceV2: true }, { upload });
assert.equal(v2.viewOnceMessageV2.message.extendedTextMessage.viewOnce, true);

const v1 = await generateWAMessageContent({ text: 'halo', viewOnce: true }, { upload });
assert.equal(v1.viewOnceMessage.message.extendedTextMessage.viewOnce, true);

const polos = await generateWAMessageContent({ text: 'biasa' }, { upload });
assert.equal(polos.viewOnceMessageV2Extension ?? null, null);
assert.equal(polos.extendedTextMessage.viewOnce ?? null, null);

console.log('view once text tests passed');
