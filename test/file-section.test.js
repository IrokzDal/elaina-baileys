import assert from 'node:assert/strict';
import { AIRich } from '../lib/MessageBuilder/index.js';
import { HTML_MIME_TYPE, decodeAIRich, fileLinkSection, fileSection, sendHtmlDocument } from '../lib/MessageBuilder/extras.js';

assert.equal(HTML_MIME_TYPE, 'text/html');

const section = fileSection('https://example.com/app.html', {
    fileName: 'app.html',
    title: 'Mini App',
    size: 4096,
    uuid: 'u-1',
    thumbnailUrl: 'https://example.com/t.jpg'
});
const primitive = section.view_model.primitive;
assert.equal(section.view_model.__typename, 'GenAISingleLayoutViewModel');
assert.equal(primitive.__typename, 'GenAIFilePrimitive');
assert.equal(primitive.url, 'https://example.com/app.html');
assert.equal(primitive.mime_type, 'text/html');
assert.equal(primitive.file_name, 'app.html');
assert.equal(primitive.size, 4096);
assert.equal(primitive.uuid, 'u-1');
assert.equal(primitive.title, 'Mini App');
assert.equal(primitive.thumbnail_url, 'https://example.com/t.jpg');

const bare = fileSection('https://example.com/x').view_model.primitive;
assert.equal(bare.mime_type, 'text/html');
assert.equal(bare.file_name, 'index.html');
assert.equal(bare.size, 0);
assert.equal(bare.title, 'index.html');
assert.equal('thumbnail_url' in bare, false);
assert.match(bare.uuid, /^[0-9a-f-]{36}$/);

assert.equal(fileSection('https://x/y', { size: 'besar' }).view_model.primitive.size, 0);
assert.equal(
    fileSection('https://x/y.pdf', { mimeType: 'application/pdf', fileName: 'y.pdf' }).view_model.primitive.mime_type,
    'application/pdf'
);

assert.equal(fileLinkSection('https://x/y').view_model.primitive.__typename, 'GenAIFileLinkPrimitive');

assert.throws(() => fileSection(''), TypeError);
assert.throws(() => fileSection('   '), TypeError);
assert.throws(() => fileSection(), TypeError);
assert.throws(() => fileLinkSection(42), TypeError);

const calls = [];
const sock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (jid, message) => { calls.push({ jid, message }); } };

const rich = new AIRich(sock);
rich.addSection(fileSection('https://example.com/app.html'));
rich.addSection(fileLinkSection('https://example.com/doc.pdf', { mimeType: 'application/pdf' }));
await rich.send('2@s.whatsapp.net');

const decoded = decodeAIRich({ message: calls[0].message });
assert.deepEqual(decoded.typenames, ['GenAIFilePrimitive', 'GenAIFileLinkPrimitive']);
assert.equal(decoded.sections[0].view_model.primitive.url, 'https://example.com/app.html');
assert.equal(decoded.sections[1].view_model.primitive.mime_type, 'application/pdf');

console.log('file section tests passed');

const dokumen = [];
const docSock = { sendMessage: async (jid, content) => { dokumen.push({ jid, content }); return { key: { id: 'X' } }; } };

const hasil = await sendHtmlDocument(docSock, '2@s.whatsapp.net', '<h1>halo</h1>', { fileName: 'main.html', caption: 'buka ini' });
assert.equal(hasil.key.id, 'X');
assert.equal(dokumen[0].jid, '2@s.whatsapp.net');
assert.equal(dokumen[0].content.mimetype, 'text/html');
assert.equal(dokumen[0].content.fileName, 'main.html');
assert.equal(dokumen[0].content.caption, 'buka ini');
assert.equal(dokumen[0].content.document.toString('utf-8'), '<h1>halo</h1>');

dokumen.length = 0;
await sendHtmlDocument(docSock, '2@s.whatsapp.net', '<b>x</b>');
assert.equal(dokumen[0].content.fileName, 'app.html');
assert.equal('caption' in dokumen[0].content, false);

await sendHtmlDocument(docSock, '2@s.whatsapp.net', '<b>x</b>', { fileName: 'a.HTM' });
assert.equal(dokumen[1].content.fileName, 'a.HTM');

await assert.rejects(() => sendHtmlDocument(docSock, '2@s.whatsapp.net', '<b>x</b>', { fileName: 'a.pdf' }), TypeError);
await assert.rejects(() => sendHtmlDocument(docSock, '2@s.whatsapp.net', ''), TypeError);
await assert.rejects(() => sendHtmlDocument(docSock, '', '<b>x</b>'), TypeError);
await assert.rejects(() => sendHtmlDocument(null, '2@s.whatsapp.net', '<b>x</b>'), TypeError);

console.log('html document tests passed');
