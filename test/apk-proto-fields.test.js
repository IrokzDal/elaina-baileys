import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { generateWAMessageContent } from '../lib/Utils/messages.js';

const round = (T, value) => T.toObject(T.decode(T.encode(value).finish()));

const album = round(proto.Message.AlbumMessage, { caption: 'kapsi', expectedImageCount: 2, expectedVideoCount: 1 });
assert.equal(album.caption, 'kapsi');
assert.equal(album.expectedImageCount, 2);
assert.equal(album.expectedVideoCount, 1);

const button = round(proto.HydratedTemplateButton.HydratedURLButton, {
    displayText: 'buka',
    url: 'https://example.com',
    consentedUsersUrl: 'https://example.com/c',
    webviewPresentation: 1,
    webviewInteraction: true
});
assert.equal(button.webviewInteraction, true);
assert.equal(button.webviewPresentation, 1);
assert.equal(button.consentedUsersUrl, 'https://example.com/c');

const plugin = round(proto.BotPluginMetadata, { pluginVersion: 8, searchQuery: 'q' });
assert.equal(plugin.pluginVersion, 8);
assert.equal(plugin.searchQuery, 'q');

const invite = round(proto.Message, {
    newsletterFollowerInviteMessage: { newsletterJid: '1@newsletter', newsletterName: 'N', caption: 'c' }
});
assert.equal(invite.newsletterFollowerInviteMessage.newsletterJid, '1@newsletter');
assert.equal(invite.newsletterFollowerInviteMessage.caption, 'c');

const both = round(proto.Message, {
    newsletterFollowerInviteMessage: { newsletterJid: 'a@newsletter' },
    newsletterFollowerInviteMessageV2: { newsletterJid: 'b@newsletter' }
});
assert.equal(both.newsletterFollowerInviteMessage.newsletterJid, 'a@newsletter');
assert.equal(both.newsletterFollowerInviteMessageV2.newsletterJid, 'b@newsletter');

const upload = async () => ({});
const withCaption = await generateWAMessageContent(
    { album: [{ image: { url: 'a' } }, { image: { url: 'b' } }], caption: 'judul album' },
    { upload }
);
assert.equal(withCaption.albumMessage.caption, 'judul album');
assert.equal(withCaption.albumMessage.expectedImageCount, 2);

const withoutCaption = await generateWAMessageContent(
    { album: [{ image: { url: 'a' } }, { video: { url: 'b' } }] },
    { upload }
);
assert.equal(withoutCaption.albumMessage.caption ?? null, null);
assert.equal(withoutCaption.albumMessage.expectedVideoCount, 1);

console.log('apk proto field tests passed');
