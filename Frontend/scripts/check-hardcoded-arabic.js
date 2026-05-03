/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targets = [
    path.join(root, 'js', 'modules', 'dashboard.js'),
    path.join(root, 'js', 'modules', 'app-ui.js'),
    path.join(root, 'js', 'modules', 'modules')
];

const arabicRegex = /[\u0600-\u06FF]{2,}/;
const stringRegex = /(['"`])((?:\\.|(?!\1).)*)\1/g;

function walk(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, files);
        } else if (entry.isFile() && full.endsWith('.js')) {
            files.push(full);
        }
    });
    return files;
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const findings = [];

    lines.forEach((line, idx) => {
        if (line.includes('data-i18n') || line.includes('I18n.t(') || line.includes('this.t(')) {
            return;
        }
        let match;
        while ((match = stringRegex.exec(line)) !== null) {
            const text = match[2].trim();
            if (text && arabicRegex.test(text)) {
                findings.push({ line: idx + 1, text });
            }
        }
    });

    return findings;
}

function run() {
    const files = [];
    targets.forEach((target) => {
        if (!fs.existsSync(target)) return;
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
            walk(target, files);
        } else if (stat.isFile()) {
            files.push(target);
        }
    });

    let total = 0;
    files.forEach((file) => {
        const findings = scanFile(file);
        if (!findings.length) return;
        console.log(`\n${path.relative(root, file)}`);
        findings.slice(0, 20).forEach((f) => {
            console.log(`  L${f.line}: ${f.text}`);
        });
        if (findings.length > 20) {
            console.log(`  ... and ${findings.length - 20} more`);
        }
        total += findings.length;
    });

    if (total > 0) {
        console.error(`\nFound ${total} potential hardcoded Arabic strings.`);
        process.exitCode = 1;
    } else {
        console.log('No potential hardcoded Arabic strings found.');
    }
}

run();
