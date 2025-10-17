import { generateHtmlReport } from './htmlReporter';
import fs from 'fs';
import path from 'path';

const folderPath = './reports/';
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));

const suites = files.map(file => {
    const raw = fs.readFileSync(path.normalize(path.join(folderPath, file)), 'utf-8');
    return JSON.parse(raw);
});

const html = generateHtmlReport(suites);
fs.writeFileSync('./reports/summary.html', html);
