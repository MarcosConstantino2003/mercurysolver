import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// A woff2 or ttf font URL for Plus Jakarta Sans 800.
// Better to use Google Fonts API to resolve to a true woff2, but since we are running in Node,
// we'll fetch Google Fonts user-agent mapped to typical browser to get the woff2 URL.
async function fetchOutfit() {
    const cssUrl = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&display=swap'
    const res = await fetch(cssUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    })
    const cssText = await res.text()

    const match = cssText.match(/url\((https:\/\/[^)]+)\) format\('woff2'\)/)
    if (!match) {
        throw new Error('WOFF2 URL not found in CSS')
    }
    const fontUrl = match[1]
    const fontRes = await fetch(fontUrl)
    const fontBuffer = await fontRes.arrayBuffer()
    const base64 = Buffer.from(fontBuffer).toString('base64')

    const fontFaceString = `
            @font-face {
                font-family: 'Plus Jakarta Sans';
                font-style: normal;
                font-weight: 800;
                src: url(data:font/woff2;base64,${base64}) format('woff2');
            }
`

    for (const svgFile of ['logo-light.svg', 'logo-dark.svg']) {
        const p = path.join(ROOT, 'public', svgFile)
        let content = fs.readFileSync(p, 'utf8')
        content = content.replace(/@font-face\s*{\s*font-family:\s*'Outfit';[\s\S]*?}\n/, '')
        content = content.replace(/@font-face\s*{\s*font-family:\s*'Plus Jakarta Sans';[\s\S]*?}\n/, '')
        content = content.replace(/<style>/, `<style>\n${fontFaceString}`)
        content = content.replace(/font-family="'Outfit',\s*system-ui/g, `font-family="'Plus Jakarta Sans', system-ui`)
        fs.writeFileSync(p, content, 'utf8')
        console.log('Updated ' + svgFile)
    }
}

fetchOutfit().catch(console.error)
