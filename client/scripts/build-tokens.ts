/**
 * Génère src/brand/tokens.css depuis src/brand/tokens.json (source de vérité de la charte).
 * Lancé avant `dev` et `build` : modifier tokens.json suffit.
 * Exécuté directement par Node (suppression des types native).
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Themed = { light: string; dark: string };
type TypeStyle = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
  usage: string;
};
type Tokens = {
  color: { tokens: { name: string; value: Themed }[] };
  type: {
    fonts: { family: string; file: string; weight: string; style: string }[];
    families: Record<string, string>;
    groups: { family: string; styles: TypeStyle[] }[];
  };
  spacing: { tokens: { name: string; value: string }[] };
  radius: { tokens: { name: string; value: string }[] };
  shadow: { tokens: { name: string; value: Themed }[] };
  breakpoint: { tokens: { name: string; value: string }[] };
};

const brandDir = new URL('../src/brand/', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('tokens.json', brandDir), 'utf8')) as Tokens;

const decl = (name: string, value: string) => `  --${name}: ${value};`;
const themeVars = (mode: keyof Themed) => [
  ...tokens.color.tokens.map((t) => decl(t.name, t.value[mode])),
  ...tokens.shadow.tokens.map((t) => decl(t.name, t.value[mode])),
  `  color-scheme: ${mode};`,
];

const fontFaces = tokens.type.fonts.map(
  (f) => `@font-face {
  font-family: '${f.family}';
  src: url('./${f.file}') format('woff2');
  font-weight: ${f.weight};
  font-style: ${f.style};
  font-display: swap;
}`,
);

// Les tailles mobiles figurent dans l'usage (« 36px / 40px sous 640px »).
const mobileSize = /(\d+px)\s*\/\s*(\d+px)\s+sous\s+(\d+px)/;
const textUtilities = tokens.type.groups.flatMap((group) =>
  group.styles.map((style) => {
    const lines = [
      `  font-family: var(--font-${group.family});`,
      `  font-weight: ${style.fontWeight};`,
      ...(style.letterSpacing ? [`  letter-spacing: ${style.letterSpacing};`] : []),
    ];
    const mobile = mobileSize.exec(style.usage);
    if (mobile) {
      lines.push(
        `  font-size: ${mobile[1]};`,
        `  line-height: ${mobile[2]};`,
        `  @media (width >= ${mobile[3]}) {`,
        `    font-size: ${style.fontSize};`,
        `    line-height: ${style.lineHeight};`,
        `  }`,
      );
    } else {
      lines.push(`  font-size: ${style.fontSize};`, `  line-height: ${style.lineHeight};`);
    }
    if (style.name === 'overline') lines.push('  text-transform: uppercase;');
    return `@utility text-${style.name} {\n${lines.join('\n')}\n}`;
  }),
);

const css = `/* Généré par scripts/build-tokens.ts depuis tokens.json : ne pas modifier à la main. */

${fontFaces.join('\n\n')}

:root,
[data-theme='light'] {
${themeVars('light').join('\n')}
${tokens.spacing.tokens.map((t) => decl(t.name, t.value)).join('\n')}
}

[data-theme='dark'] {
${themeVars('dark').join('\n')}
}

/* Sans JavaScript (ou avant l'application du thème) : préférence du système. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${themeVars('dark')
  .map((line) => `  ${line}`)
  .join('\n')}
  }
}

@theme inline {
${tokens.color.tokens.map((t) => decl(`color-${t.name}`, `var(--${t.name})`)).join('\n')}
}

@theme {
${Object.entries(tokens.type.families)
  .map(([name, value]) => decl(`font-${name}`, value))
  .join('\n')}
${tokens.radius.tokens.map((t) => decl(t.name, t.value)).join('\n')}
${tokens.shadow.tokens.map((t) => decl(t.name, t.value.light)).join('\n')}
${tokens.breakpoint.tokens.map((t) => decl(t.name.replace('bp-', 'breakpoint-'), t.value)).join('\n')}
  --breakpoint-2xl: initial;
}

${textUtilities.join('\n\n')}
`;

writeFileSync(new URL('tokens.css', brandDir), css);
console.log('tokens.css généré depuis tokens.json');
