/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
import { randomUUID } from 'crypto'
import { AIRich } from './index.js'
import { generateWAMessageFromContent } from '../Utils/messages.js'

export const AI_RICH_LAYOUTS = Object.freeze([
    'Single',
    'HScroll',
    'ActionRow',
    'VStack',
    'Grid',
    'FlexibleCountGrid',
    'RichListItem',
    'AddonAction'
])

export const AI_RICH_PRIMITIVES = Object.freeze([
    'GenAIMarkdownTextUXPrimitive',
    'GenAICodeUXPrimitive',
    'GenATableUXPrimitive',
    'GenAIMetadataTextPrimitive',
    'GenAISearchResultPrimitive',
    'GenAIReelPrimitive',
    'GenAIPostPrimitive',
    'GenAIProductItemCardPrimitive',
    'GenAIImaginePrimitive',
    'GenAIFollowUpSuggestionPillPrimitive',
    'FOATextPrimitive',
    'FOABloksPrimitive',
    'GenAIImagePrimitive',
    'GenAIDividerPrimitive',
    'GenAISpacerPrimitive',
    'GenAITaskPrimitive',
    'GenAILatexUXPrimitive',
    'GenAIBotThinkingStatusPrimitive',
    'GenAIBotProgressStatusPrimitive',
    'GenAIMetaSubsQuotaUpsellPrimitive'
])

export const AI_RICH_HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive'
export const AI_RICH_HTML_PRIMITIVE_ANDROID_CLASS = 'FOAHtmlPrimitive'

export const AI_RICH_PRIMITIVES_ANDROID_ONLY = Object.freeze([
    AI_RICH_HTML_PRIMITIVE
])

export const DividerType = Object.freeze({ DOT: 'DOT', HORIZONTAL_LINE: 'HORIZONTAL_LINE' })
export const ImagineType = Object.freeze({ IMAGINE: 'IMAGINE', ANIMATE: 'ANIMATE', MEMU: 'MEMU' })
export const ImagineStatus = Object.freeze({ GENERATING: 'GENERATING', READY: 'READY', FAILED: 'FAILED' })
export const ThinkingIcon = Object.freeze({ THINKING: 'THINKING', WEB_SEARCH: 'WEB_SEARCH', META_SEARCH: 'META_SEARCH' })
export const TaskStatus = Object.freeze({ PENDING: 'PENDING', RUNNING: 'RUNNING', DONE: 'DONE' })
export const FooterActionType = Object.freeze({
    OPEN_FULL_VIEW: 'OPEN_FULL_VIEW',
    DOWNLOAD_MEDIA: 'DOWNLOAD_MEDIA',
    GENERATE_IMAGE: 'GENERATE_IMAGE',
    CANCEL_REASONING: 'CANCEL_REASONING',
    UPGRADE_TO_SUBS: 'UPGRADE_TO_SUBS'
})
export const AddonActionType = Object.freeze({
    COPY_TO_CLIPBOARD: 'COPY_TO_CLIPBOARD',
    SEND_TO_CHAT: 'SEND_TO_CHAT',
    FOLLOW_UP_PROMPT: 'FOLLOW_UP_PROMPT'
})

export const dividerSection = ({ dividerType = DividerType.HORIZONTAL_LINE } = {}) =>
    AIRich.newLayout('Single', {
        divider_type: dividerType,
        __typename: 'GenAIDividerPrimitive'
    })

export const spacerSection = ({ spacing = 1 } = {}) =>
    AIRich.newLayout('Single', {
        spacing,
        __typename: 'GenAISpacerPrimitive'
    })

export const imageSection = (url, { fallbackUrl, previewUrl, previewFallbackUrl } = {}) =>
    AIRich.newLayout('Single', {
        full_image: { url, url_fallback: fallbackUrl ?? '' },
        preview_image: { url: previewUrl ?? url, url_fallback: previewFallbackUrl ?? fallbackUrl ?? '' },
        __typename: 'GenAIImagePrimitive'
    })

export const taskSection = ({ taskId, title = '', subtitle = '', status = TaskStatus.PENDING }) => {
    if (!taskId) {
        throw new TypeError('taskSection requires taskId, an empty id makes WhatsApp drop the item')
    }
    return AIRich.newLayout('Single', {
        task_id: String(taskId),
        title,
        subtitle,
        status,
        __typename: 'GenAITaskPrimitive'
    })
}

export const latexSection = (expression, { image, width = 100, height = 100, fontHeight = 83.333333333333, padding = 15 } = {}) =>
    AIRich.newLayout('Single', {
        latex_expression: expression,
        ...(image
            ? {
                latex_image: { url: image, width, height },
                font_height: fontHeight,
                padding
            }
            : {}),
        __typename: 'GenAILatexUXPrimitive'
    })

const statusSection = (typename) => (title, { icon = ThinkingIcon.THINKING, inProgress = true, metaSearchApps = [], targetScreenId, targetScreenTabId } = {}) =>
    AIRich.newLayout('Single', {
        title,
        icon,
        is_in_progress: inProgress,
        meta_search_apps: metaSearchApps,
        target_secondary_screen_id: targetScreenId,
        target_secondary_screen_tab_id: targetScreenTabId,
        __typename: typename
    })

export const thinkingSection = statusSection('GenAIBotThinkingStatusPrimitive')
export const progressSection = statusSection('GenAIBotProgressStatusPrimitive')

export const lockHeight = (height) => {
    const px = Number(height)
    if (!Number.isFinite(px) || px <= 0) {
        throw new TypeError('height must be a positive number of pixels')
    }
    return '<style>html,body{margin:0;padding:0;height:' + px + 'px;max-height:' + px + 'px;overflow:hidden}'
        + '#__wrap{height:' + px + 'px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}</style>'
        + '<script>document.addEventListener("DOMContentLoaded",function(){'
        + 'var w=document.createElement("div");w.id="__wrap";'
        + 'while(document.body.firstChild)w.appendChild(document.body.firstChild);'
        + 'document.body.appendChild(w)});<' + '/script>'
}

export const htmlSection = (html, { trustedSources = [], height, typename = AI_RICH_HTML_PRIMITIVE } = {}) => {
    if (typeof html !== 'string' || html.trim() === '') {
        throw new TypeError('htmlSection requires a non-empty HTML string')
    }
    if (!Array.isArray(trustedSources)) {
        throw new TypeError('htmlSection trustedSources must be an array of strings')
    }
    if (typeof typename !== 'string' || typename.trim() === '') {
        throw new TypeError('htmlSection typename must be a non-empty string')
    }
    return AIRich.newLayout('Single', {
        payload: height === undefined ? html : lockHeight(height) + html,
        trusted_sources: trustedSources.map(String),
        __typename: typename
    })
}

export const sendHtmlApp = async (sock, jid, html, { title = '', label, trustedSources, height, typename, id, bypassDownload = false, ...options } = {}) => {
    if (!sock) {
        throw new TypeError('sendHtmlApp requires a socket as the first argument')
    }
    if (!jid) {
        throw new TypeError('sendHtmlApp requires a target jid')
    }

    const rich = new AIRich(sock)

    if (title) {
        rich.setTitle(title)
    }

    rich._addContent(
        htmlSection(html, { trustedSources, height, ...(typename ? { typename } : {}) }),
        label ? { messageType: 2, messageText: String(label) } : undefined,
        id ? { id } : {}
    )

    return rich.send(jid, { bypassDownload, ...options })
}

export const HTML_MIME_TYPE = 'text/html'

const fileArtifact = (typename) => (url, { mimeType = HTML_MIME_TYPE, fileName = 'index.html', size = 0, title = '', thumbnailUrl, uuid } = {}) => {
    if (typeof url !== 'string' || url.trim() === '') {
        throw new TypeError('a file section requires a non-empty url')
    }
    return AIRich.newLayout('Single', {
        url,
        mime_type: String(mimeType),
        file_name: String(fileName),
        size: Number(size) || 0,
        uuid: uuid ?? randomUUID(),
        title: String(title || fileName),
        ...(thumbnailUrl ? { thumbnail_url: String(thumbnailUrl) } : {}),
        __typename: typename
    })
}

export const fileSection = fileArtifact('GenAIFilePrimitive')
export const fileLinkSection = fileArtifact('GenAIFileLinkPrimitive')

export const footerActionSection = (actionType, { buttonText = '', actionId } = {}) => {
    if (!Object.values(FooterActionType).includes(actionType)) {
        throw new TypeError('footerActionSection actionType must be one of ' + Object.values(FooterActionType).join(', '))
    }
    return AIRich.newLayout('Single', {
        action_type: actionType,
        action_id: actionId ?? randomUUID(),
        button_text: String(buttonText),
        __typename: 'GenAIFooterActionPrimitive'
    })
}

export const BLOKS_A2UI_TYPE = 'im_a2ui'
export const BLOKS_A2UI_REPLY_ACTION = 'a2ui_reply_action'
export const BLOKS_A2UI_SUPPORTED_ELEMENTS = Object.freeze(['info_card', 'list_card'])

const bloksPayloadData = (data) => {
    if (data === undefined || data === null) {
        return ''
    }
    if (typeof data === 'string') {
        return data
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
        throw new TypeError('bloks data must be a JSON string or a plain object')
    }
    return JSON.stringify(data)
}

const bloksType = (type, caller) => {
    if (typeof type !== 'string' || type.trim() === '') {
        throw new TypeError(caller + ' requires a non-empty bloks type')
    }
    return type
}

export const bloksSection = (type, data, { uuid, initialResponse = '', versioningId = '' } = {}) =>
    AIRich.newLayout('Single', {
        type: bloksType(type, 'bloksSection'),
        data: bloksPayloadData(data),
        uuid: uuid ?? randomUUID(),
        initial_response: String(initialResponse),
        versioning_id: String(versioningId),
        __typename: 'FOABloksPrimitive'
    })

export const bloksWidget = ({ type, data, uuid, fallback = '' } = {}) => ({
    type: bloksType(type, 'bloksWidget'),
    data: bloksPayloadData(data),
    uuid: uuid ?? randomUUID(),
    fallback: String(fallback)
})

export const sendBloksWidget = async (sock, jid, { type, data, uuid, fallback = '', body, contextInfo, messageId, additionalNodes = [], ...options } = {}) => {
    if (!sock) {
        throw new TypeError('sendBloksWidget requires a socket as the first argument')
    }
    if (!jid) {
        throw new TypeError('sendBloksWidget requires a target jid')
    }

    const widget = bloksWidget({ type, data, uuid, fallback })
    const text = body === undefined ? widget.fallback : String(body)

    const msg = generateWAMessageFromContent(
        jid,
        {
            interactiveMessage: {
                bloksWidget: widget,
                ...(text ? { body: { text } } : {}),
                ...(contextInfo ? { contextInfo } : {})
            }
        },
        { messageId, ...options }
    )

    await sock.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: [
            {
                tag: 'biz',
                attrs: {},
                content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }]
            },
            ...additionalNodes
        ],
        ...options
    })

    return msg
}

export const decodeBloksWidget = (msg) => {
    const message = msg?.message ?? msg
    const interactive =
        message?.interactiveMessage ??
        message?.viewOnceMessage?.message?.interactiveMessage ??
        message?.viewOnceMessageV2?.message?.interactiveMessage

    const widget = interactive?.bloksWidget
    if (!widget) {
        return null
    }

    let params = null
    try {
        params = widget.data ? JSON.parse(widget.data) : null
    }
    catch {
        params = null
    }

    return {
        type: widget.type ?? '',
        uuid: widget.uuid ?? '',
        fallback: widget.fallback ?? '',
        data: widget.data ?? '',
        params
    }
}

export const decodeAIRich = (msg) => {
    const message = msg?.message ?? msg
    const rich =
        message?.botForwardedMessage?.message?.richResponseMessage ??
        message?.botForwardedMessage?.richResponseMessage ??
        message?.richResponseMessage

    if (!rich) {
        return null
    }

    let unified = null
    const data = rich.unifiedResponse?.data
    if (data) {
        try {
            unified = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'))
        }
        catch {
            unified = null
        }
    }

    const sections = Array.isArray(unified?.sections) ? unified.sections : []
    const footerSections = Array.isArray(unified?.footer_sections) ? unified.footer_sections : []

    const readPrimitives = (section) => {
        const view = section?.view_model
        if (Array.isArray(view?.primitives)) return view.primitives
        if (view?.primitive) return [view.primitive]
        return []
    }

    return {
        responseId: unified?.response_id,
        layouts: sections.map(section => String(section?.view_model?.__typename ?? '').replace(/^GenAI(.*)LayoutViewModel$/, '$1')),
        typenames: [...new Set(sections.flatMap(section => readPrimitives(section).map(primitive => primitive?.__typename).filter(Boolean)))],
        footerTypenames: [...new Set(footerSections.flatMap(section => readPrimitives(section).map(primitive => primitive?.__typename).filter(Boolean)))],
        sections,
        footerSections,
        submessages: rich.submessages ?? [],
        unified
    }
}
