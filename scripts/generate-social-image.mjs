import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f7f8f5"/>
<path d="M0 580H1200" stroke="#d7e2dc"/>
<text x="68" y="88" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#19332f">SchemaMind<tspan fill="#00756e">.</tspan></text>
<text x="68" y="238" font-family="Arial,sans-serif" font-size="70" font-weight="700" letter-spacing="-3" fill="#19332f">Your schema,</text>
<text x="68" y="319" font-family="Arial,sans-serif" font-size="70" font-weight="700" letter-spacing="-3" fill="#006e65">visualized.</text>
<text x="72" y="380" font-family="Arial,sans-serif" font-size="25" fill="#566c66">SQL · Prisma · Drizzle · JSON Schema</text>
<text x="72" y="423" font-family="Arial,sans-serif" font-size="22" fill="#566c66">Explore relationships. Understand every field.</text>
<g font-family="Arial,sans-serif">
<path d="M830 270V338H945V375" fill="none" stroke="#199484" stroke-width="4"/><circle cx="830" cy="270" r="6" fill="#199484"/><circle cx="945" cy="375" r="6" fill="#199484"/>
<rect x="722" y="125" width="330" height="155" rx="18" fill="white" stroke="#a5d4c6" stroke-width="2"/><path d="M723 186H1051" stroke="#a5d4c6"/>
<text x="748" y="166" font-size="27" font-weight="700" fill="#19332f">authors</text>
<text x="748" y="220" font-size="21" fill="#006e65">PK</text><text x="795" y="220" font-size="23" fill="#19332f">id</text><text x="978" y="220" font-size="20" fill="#6b7d77">int</text>
<text x="795" y="255" font-size="23" fill="#19332f">name</text><text x="975" y="255" font-size="20" fill="#6b7d77">text</text>
<rect x="798" y="375" width="330" height="170" rx="18" fill="white" stroke="#a5d4c6" stroke-width="2"/><path d="M799 436H1127" stroke="#a5d4c6"/>
<text x="824" y="416" font-size="27" font-weight="700" fill="#19332f">books</text>
<text x="824" y="475" font-size="21" fill="#006e65">PK</text><text x="873" y="475" font-size="23" fill="#19332f">id</text><text x="1062" y="475" font-size="20" fill="#6b7d77">int</text>
<text x="824" y="517" font-size="21" fill="#006e65">FK</text><text x="873" y="517" font-size="23" fill="#19332f">author_id</text><text x="1062" y="517" font-size="20" fill="#6b7d77">int</text>
</g>
<text x="72" y="612" font-family="Arial,sans-serif" font-size="19" fill="#566c66">schema.blackielabs.com</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile("public/og-image.png");
