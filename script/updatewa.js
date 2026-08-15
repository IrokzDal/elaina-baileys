import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const fetchVersion = async () => {
    const response = await fetch('https://web.whatsapp.com/sw.js', {
        headers: {
            'sec-fetch-site': 'none',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
    })
    if (!response.ok) throw new Error(`Failed to fetch sw.js: ${response.status} ${response.statusText}`)
    const match = (await response.text()).match(/\\?"client_revision\\?":\s*(\d+)/)
    if (!match?.[1]) throw new Error('Could not find client revision in sw.js')
    return [2, 3000, Number.parseInt(match[1], 10)]
}

const update = (file, pattern, replacement) => {
    const target = join(root, file)
    if (!existsSync(target)) throw new Error(`File not found: ${file}`)
    const source = readFileSync(target, 'utf8')
    if (!pattern.test(source)) throw new Error(`Version declaration not found: ${file}`)
    pattern.lastIndex = 0
    const next = source.replace(pattern, replacement)
    if (next !== source) writeFileSync(target, next)
    return next !== source
}

const version = await fetchVersion()
const value = `[${version.join(', ')}]`
const defaultsChanged = update('lib/Defaults/index.js', /const\s+version\s*=\s*\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]\s*;/, `const version = ${value};`)
const genericsChanged = update('lib/Utils/generics.js', /const\s+baileysVersion\s*=\s*\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]\s*;/, `const baileysVersion = ${value};`)
console.log(`WhatsApp Web version: ${value}`)
console.log(`Defaults: ${defaultsChanged ? 'updated' : 'unchanged'}`)
console.log(`Generics: ${genericsChanged ? 'updated' : 'unchanged'}`)
