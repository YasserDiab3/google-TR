/* eslint-disable no-console */
/**
 * يتحقق من:
 * 1) تطابق مفاتيح ar و en في i18n-core.js
 * 2) وجود كل مفتاح data-i18n / data-i18n-title في كلا اللغتين
 * 3) بعض استدعاءات i18n.translate('key') الشائعة في الوحدات (عينة من المشروع)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const i18nPath = path.join(root, 'js', 'modules', 'i18n-core.js');
const indexPath = path.join(root, 'index.html');

function extractBlockKeys(content, startMarker, endMarker) {
    const start = content.indexOf(startMarker);
    if (start === -1) return { keys: [], error: `Missing ${startMarker}` };
    const from = start + startMarker.length;
    const end = content.indexOf(endMarker, from);
    if (end === -1) return { keys: [], error: `Missing end after ${startMarker}` };
    const slice = content.slice(from, end);
    const keys = [];
    const re = /'((?:\\'|[^'])+)':\s*/g;
    let m;
    while ((m = re.exec(slice)) !== null) {
        const k = m[1].replace(/\\'/g, "'");
        keys.push(k);
    }
    return { keys, error: null };
}

function walkJs(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walkJs(full, out);
        else if (name.endsWith('.js')) out.push(full);
    }
    return out;
}

function main() {
    const content = fs.readFileSync(i18nPath, 'utf8');

    const ar = extractBlockKeys(content, 'ar: {', '},\n        en: {');
    const en = extractBlockKeys(content, 'en: {', '\n    };\n\n    const literalArToEn');

    if (ar.error) {
        console.error(ar.error);
        process.exit(1);
    }
    if (en.error) {
        console.error(en.error);
        process.exit(1);
    }

    const setAr = new Set(ar.keys);
    const setEn = new Set(en.keys);
    const onlyAr = [...setAr].filter((k) => !setEn.has(k));
    const onlyEn = [...setEn].filter((k) => !setAr.has(k));

    console.log(`i18n-core: ar keys=${setAr.size}, en keys=${setEn.size}`);
    if (onlyAr.length) {
        console.error('\nمفاتيح في ar فقط (ناقصة في en):');
        onlyAr.sort().forEach((k) => console.error('  ', k));
    }
    if (onlyEn.length) {
        console.error('\nمفاتيح في en فقط (ناقصة في ar):');
        onlyEn.sort().forEach((k) => console.error('  ', k));
    }

    const html = fs.readFileSync(indexPath, 'utf8');
    const used = new Set();
    [
        /data-i18n="([^"]+)"/g,
        /data-i18n-title="([^"]+)"/g,
        /data-i18n-placeholder="([^"]+)"/g,
        /data-i18n-aria-label="([^"]+)"/g
    ].forEach((re) => {
        let m;
        while ((m = re.exec(html)) !== null) used.add(m[1]);
    });

    const missingAr = [...used].filter((k) => !setAr.has(k));
    const missingEn = [...used].filter((k) => !setEn.has(k));

    if (missingAr.length) {
        console.error('\ndata-i18n في index.html بدون مفتاح ar:');
        missingAr.sort().forEach((k) => console.error('  ', k));
    }
    if (missingEn.length) {
        console.error('\ndata-i18n في index.html بدون مفتاح en:');
        missingEn.sort().forEach((k) => console.error('  ', k));
    }

    // عينة: i18n.translate('x.y') في مجلد الوحدات
    const modulesDir = path.join(root, 'js', 'modules');
    const translateKeys = new Set();
    const files = [
        ...walkJs(path.join(modulesDir, 'modules')),
        path.join(modulesDir, 'app-ui.js'),
        path.join(modulesDir, 'dashboard.js')
    ].filter((f) => fs.existsSync(f));

    const trRe = /i18n\.translate\(\s*['"]([^'"]+)['"]\s*\)/g;
    files.forEach((file) => {
        const t = fs.readFileSync(file, 'utf8');
        let m;
        while ((m = trRe.exec(t)) !== null) translateKeys.add(m[1]);
    });

    const missTrAr = [...translateKeys].filter((k) => !setAr.has(k));
    const missTrEn = [...translateKeys].filter((k) => !setEn.has(k));
    if (missTrAr.length) {
        console.error('\ni18n.translate(...) بدون مفتاح ar:');
        missTrAr.sort().forEach((k) => console.error('  ', k));
    }
    if (missTrEn.length) {
        console.error('\ni18n.translate(...) بدون مفتاح en:');
        missTrEn.sort().forEach((k) => console.error('  ', k));
    }

    const exit = onlyAr.length + onlyEn.length + missingAr.length + missingEn.length + missTrAr.length + missTrEn.length;
    if (exit === 0) {
        console.log('\n✓ لا اختلافات في مفاتيح ar/en، وكل مفاتيح data-i18n في index.html معرّفة.');
    } else {
        console.error(`\nإجمالي المشكلات: ${exit}`);
        process.exitCode = 1;
    }
}

main();
