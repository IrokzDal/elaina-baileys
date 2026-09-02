import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { proto } from '../WAProto/index.js'

/**
 * WAProto is generated from the WhatsApp Web bundle, so anything the Android
 * client knows and Web does not is simply absent from it. Point this at a
 * directory of extracted classesN.dex and it reports what is missing.
 *
 *   node script/auditapk.js <dir-with-classes.dex> [out.txt]
 */

const dir = process.argv[2]
const out = process.argv[3]

if (!dir) {
    console.error('pakai: node script/auditapk.js <folder-berisi-classes.dex> [keluaran.txt]')
    process.exit(1)
}

const uleb = (buffer, offset) => {
    let result = 0
    let shift = 0
    let byte
    do {
        byte = buffer[offset++]
        result |= (byte & 0x7f) << shift
        shift += 7
    } while (byte & 0x80)
    return [result >>> 0, offset]
}

const readValue = (buffer, offset) => {
    const header = buffer[offset++]
    const kind = header & 0x1f
    const size = header >> 5
    if (kind <= 0x06) {
        let value = 0
        for (let i = 0; i <= size; i++) value |= buffer[offset + i] << (8 * i)
        return [value, offset + size + 1]
    }
    if (kind === 0x1e) return [false, offset]
    if (kind === 0x1f) return [true, offset]
    return [null, offset + size + 1]
}

const camel = name => name.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

const readDex = path => {
    const buffer = readFileSync(path)
    const stringCount = buffer.readUInt32LE(0x38)
    const stringOffset = buffer.readUInt32LE(0x3c)
    const typeOffset = buffer.readUInt32LE(0x44)
    const fieldOffset = buffer.readUInt32LE(0x54)
    const classCount = buffer.readUInt32LE(0x60)
    const classOffset = buffer.readUInt32LE(0x64)

    const strings = new Array(stringCount)
    for (let i = 0; i < stringCount; i++) {
        const at = buffer.readUInt32LE(stringOffset + i * 4)
        const [length, start] = uleb(buffer, at)
        let end = start
        let units = 0
        while (units < length) {
            const byte = buffer[end]
            end += byte < 0x80 ? 1 : (byte & 0xe0) === 0xc0 ? 2 : 3
            units++
        }
        strings[i] = buffer.toString('utf8', start, end)
    }

    const typeName = index => strings[buffer.readUInt32LE(typeOffset + index * 4)]
    const fieldName = index => strings[buffer.readUInt32LE(fieldOffset + index * 8 + 4)]

    const classes = []
    for (let i = 0; i < classCount; i++) {
        const at = classOffset + i * 32
        const dataOffset = buffer.readUInt32LE(at + 24)
        if (!dataOffset) continue

        let cursor = dataOffset
        const counts = []
        for (let k = 0; k < 4; k++) {
            const [value, next] = uleb(buffer, cursor)
            counts.push(value)
            cursor = next
        }

        const staticOffset = buffer.readUInt32LE(at + 28)
        const values = []
        if (staticOffset) {
            let q = staticOffset
            const [count, next] = uleb(buffer, q)
            q = next
            for (let k = 0; k < count; k++) {
                const [value, after] = readValue(buffer, q)
                values.push(value)
                q = after
            }
        }

        const fields = []
        const numbers = {}
        let index = 0
        for (let k = 0; k < counts[0]; k++) {
            const [delta, afterIndex] = uleb(buffer, cursor)
            index += delta
            const [, afterAccess] = uleb(buffer, afterIndex)
            cursor = afterAccess
            const name = fieldName(index)
            if (!name.endsWith('_FIELD_NUMBER')) continue
            const field = camel(name.slice(0, -13))
            fields.push(field)
            numbers[field] = values[k]
        }

        if (fields.length >= 2) {
            classes.push({ cls: typeName(buffer.readUInt32LE(at)), fields: fields.sort(), numbers })
        }
    }
    return classes
}

const collectOurs = () => {
    const found = []
    const walk = (namespace, path) => {
        for (const key of Object.keys(namespace)) {
            const value = namespace[key]
            if (typeof value !== 'function' || !value.prototype) continue
            const fields = Object.keys(value.prototype).filter(k => typeof value.prototype[k] !== 'function' && !k.startsWith('$'))
            if (fields.length) found.push({ name: path + key, fields: fields.map(f => f.toLowerCase()) })
            walk(value, path + key + '.')
        }
    }
    walk(proto, '')
    return found
}

const dexFiles = readdirSync(dir).filter(name => /^classes\d*\.dex$/.test(name)).sort()
if (!dexFiles.length) {
    console.error('tidak ada classes*.dex di ' + dir)
    process.exit(1)
}

const apk = dexFiles.flatMap(name => readDex(join(dir, name)))
const ours = collectOurs()

const overlap = (fields, other) => {
    const set = new Set(other)
    return fields.filter(field => set.has(field.toLowerCase())).length
}

const missingTypes = []
const missingFields = []

for (const entry of apk) {
    if (entry.cls.startsWith('Lcom/google/protobuf/')) continue

    let best = null
    let bestScore = 0
    for (const candidate of ours) {
        const score = overlap(entry.fields, candidate.fields)
        if (score > bestScore) {
            bestScore = score
            best = candidate
        }
    }

    if (!best || bestScore < Math.max(2, entry.fields.length * 0.5)) {
        missingTypes.push(entry.cls + '  ' + entry.fields.map(f => f + '=' + entry.numbers[f]).join(' '))
        continue
    }

    const have = new Set(best.fields)
    const gap = entry.fields.filter(field => !have.has(field.toLowerCase()))
    if (gap.length) {
        missingFields.push(best.name + '  <- ' + entry.cls + '  ' + gap.map(f => f + '=' + entry.numbers[f]).join(' '))
    }
}

const report = [
    'kelas protobuf di apk : ' + apk.length,
    'tipe di WAProto kita  : ' + ours.length,
    '',
    '## field yang hilang (' + missingFields.length + ')',
    ...missingFields.sort(),
    '',
    '## tipe tanpa padanan (' + missingTypes.length + ')',
    ...missingTypes.sort()
].join('\n')

if (out) {
    writeFileSync(out, report + '\n')
    console.log('laporan ditulis ke ' + out)
} else {
    console.log(report)
}
