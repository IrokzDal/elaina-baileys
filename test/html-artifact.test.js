import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AIRich, ContentValidationError } from '../lib/MessageBuilder/index.js';
import { botMediaMetadata, decodeAIRich, prepareFileArtifact, sendHtmlArtifact } from '../lib/MessageBuilder/extras.js';

const doc = {
    fileSha256: Buffer.from('aa'.repeat(32), 'hex'),
    fileEncSha256: Buffer.from('bb'.repeat(32), 'hex'),
    mediaKey: Buffer.from('cc'.repeat(32), 'hex'),
    directPath: '/v/t62.7119-24/abc',
    mediaKeyTimestamp: 1700000000,
    mimetype: 'text/html',
    fileLength: 1234
};

const meta = botMediaMetadata(doc);
assert.equal(meta.fileSha256, doc.fileSha256.toString('base64'));
assert.equal(meta.fileEncSha256, doc.fileEncSha256.toString('base64'));
assert.equal(meta.mediaKey, doc.mediaKey.toString('base64'));
assert.equal(meta.directPath, '/v/t62.7119-24/abc');
assert.equal(meta.mediaKeyTimestamp, 1700000000);
assert.equal(meta.mimetype, 'text/html');
assert.equal(typeof meta.fileSha256, 'string');

assert.equal('mediaKeyTimestamp' in botMediaMetadata({ directPath: '/x' }), false);
assert.throws(() => botMediaMetadata(null), TypeError);

const calls = [];
let uploads = 0;
const sock = {
    user: { id: '1@s.whatsapp.net' },
    waUploadToServer: async () => {
        uploads++;
        return { mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/v/t62/enc' };
    },
    relayMessage: async (jid, message) => { calls.push({ jid, message }); }
};

const html = '<!DOCTYPE html><body><h1>jendela</h1></body>';
const artifact = await prepareFileArtifact(sock, html, { fileName: 'main.html', title: 'Judul', id: 'fixed-id' });

assert.equal(artifact.mediaId, 'fixed-id');
assert.equal(artifact.section.view_model.primitive.__typename, 'GenAIFilePrimitive');
assert.equal(artifact.section.view_model.primitive.preview_image.media_id, 'fixed-id');
assert.equal(artifact.section.view_model.primitive.preview_image.mime_type, 'text/html');
assert.equal(artifact.section.view_model.primitive.file_extension, 'html');
assert.equal(artifact.section.view_model.primitive.title, 'Judul');
assert.equal(artifact.mediaDetails.id, 'fixed-id');
assert.equal(artifact.mediaDetails.previewMedia.directPath, '/v/t62/enc');
assert.equal(artifact.mediaDetails.highResMedia.directPath, '/v/t62/enc');
assert.ok(artifact.media.mediaKey);
assert.equal(artifact.section.view_model.primitive.file_length, Number(artifact.documentMessage.fileLength));

assert.equal(uploads, 1);
assert.equal(
    artifact.media.fileSha256,
    createHash('sha256').update(Buffer.from(html, 'utf-8')).digest('base64')
);

calls.length = 0;
const sent = await sendHtmlArtifact(sock, '2@s.whatsapp.net', html, { fileName: 'app.html', title: 'Mini App', label: 'buka' });

assert.ok(sent.message.key.id);
assert.ok(sent.mediaId);
assert.equal(calls.length, 1);

const botMetadata = calls[0].message.messageContextInfo.botMetadata;
assert.equal(botMetadata.messageDisclaimerText, 'Mini App');
assert.ok(botMetadata.verificationMetadata);
const list = botMetadata.unifiedResponseMutation.mediaDetailsMetadataList;
assert.equal(list.length, 1);
assert.equal(list[0].id, sent.mediaId);
assert.equal(typeof list[0].previewMedia.mediaKey, 'string');

const decoded = decodeAIRich({ message: calls[0].message });
assert.deepEqual(decoded.typenames, ['GenAIFilePrimitive']);
assert.equal(decoded.sections[0].view_model.primitive.preview_image.media_id, sent.mediaId);
assert.deepEqual(
    calls[0].message.botForwardedMessage.message.richResponseMessage.submessages,
    [{ messageType: 2, messageText: 'buka' }]
);

const rich = new AIRich(sock);
assert.throws(() => rich.setBotMetadata('bukan objek'), ContentValidationError);
assert.throws(() => rich.setBotMetadata([]), ContentValidationError);
rich.setBotMetadata({ a: 1 }).setBotMetadata({ b: 2 });
assert.deepEqual(rich._botMetadataExtra, { a: 1, b: 2 });

await assert.rejects(() => prepareFileArtifact(null, html), TypeError);
await assert.rejects(() => prepareFileArtifact(sock, 42), TypeError);
await assert.rejects(() => sendHtmlArtifact(sock, '', html), TypeError);

console.log('html artifact tests passed');
