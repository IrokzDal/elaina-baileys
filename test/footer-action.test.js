import assert from 'node:assert/strict';
import { AIRich, ContentValidationError } from '../lib/MessageBuilder/index.js';
import { FooterActionType, decodeAIRich, footerActionSection, htmlSection } from '../lib/MessageBuilder/extras.js';

const section = footerActionSection(FooterActionType.OPEN_FULL_VIEW, { buttonText: 'Buka penuh', actionId: 'a-1' });
assert.equal(section.view_model.__typename, 'GenAISingleLayoutViewModel');
assert.equal(section.view_model.primitive.__typename, 'GenAIFooterActionPrimitive');
assert.equal(section.view_model.primitive.action_type, 'OPEN_FULL_VIEW');
assert.equal(section.view_model.primitive.action_id, 'a-1');
assert.equal(section.view_model.primitive.button_text, 'Buka penuh');

assert.match(footerActionSection(FooterActionType.DOWNLOAD_MEDIA).view_model.primitive.action_id, /^[0-9a-f-]{36}$/);
assert.equal(footerActionSection(FooterActionType.DOWNLOAD_MEDIA).view_model.primitive.button_text, '');

assert.throws(() => footerActionSection('OPEN_WINDOW'), TypeError);
assert.throws(() => footerActionSection(), TypeError);

const calls = [];
const sock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (jid, message) => { calls.push({ jid, message }); } };

const rich = new AIRich(sock);
rich.addSection(htmlSection('<b>isi</b>'));
rich.addFooterSection(footerActionSection(FooterActionType.OPEN_FULL_VIEW, { buttonText: 'Buka' }));
await rich.send('2@s.whatsapp.net');

const decoded = decodeAIRich({ message: calls[0].message });
assert.deepEqual(decoded.typenames, ['GenAIaeacdsnwHtmlPrimitive']);
assert.deepEqual(decoded.footerTypenames, ['GenAIFooterActionPrimitive']);
assert.equal(decoded.footerSections.length, 1);
assert.equal(decoded.unified.footer_sections[0].view_model.primitive.action_type, 'OPEN_FULL_VIEW');

calls.length = 0;
const polos = new AIRich(sock);
polos.addSection(htmlSection('<b>isi</b>'));
await polos.send('2@s.whatsapp.net');
const tanpaFooter = decodeAIRich({ message: calls[0].message });
assert.equal('footer_sections' in tanpaFooter.unified, false);
assert.deepEqual(tanpaFooter.footerSections, []);
assert.deepEqual(tanpaFooter.footerTypenames, []);

assert.throws(() => rich.addFooterSection('bukan objek'), ContentValidationError);
assert.throws(() => rich.addFooterSection([]), ContentValidationError);
assert.equal(rich.clearFooterSections()._footerSections.length, 0);

console.log('footer action tests passed');
