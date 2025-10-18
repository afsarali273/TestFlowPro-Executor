import path from 'path';
import minimist from 'minimist';
import * as dotenv from 'dotenv';
import fs from 'fs';
import {
    findSuiteFile,
    generateRunName,
    runAllSuitesParallel,
    runSuiteFromFile,
    runTarget
} from "./runner/RunController";
import {parseExecutionTarget} from "./runner/ExecutionTarget";

// Function to find the project root by looking for package.json
function findProjectRoot(): string {
    let currentDir = __dirname;
    
    while (currentDir !== path.dirname(currentDir)) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    
    // Fallback to the directory containing runner.ts
    return path.resolve(__dirname, '..');
}

const projectRoot = findProjectRoot();

dotenv.config({
    path: path.resolve(projectRoot, '.env')
});

const suitesDir = path.join(projectRoot, 'testSuites');

async function main() {
    const argv = minimist(process.argv.slice(2));
    const { file, target, _, ...filters } = argv;
    const runId = generateRunName();

    if (target) {
        const executionTarget = parseExecutionTarget(target);
        let fullPath = file ? path.normalize(path.isAbsolute(file) ? file : path.join(suitesDir, file)) : null;

        if (!fullPath) {
            console.log(`🔍 Searching for suite file...`);
            fullPath = await findSuiteFile(executionTarget.suiteId, executionTarget.suiteName, suitesDir);
        }
        if (!fullPath) return;

        console.log(`✅ Suite found: ${fullPath}`);
        console.log(`🎯 Execution target:`, JSON.stringify(executionTarget, null, 2));
        await runTarget(fullPath, executionTarget, filters, runId);
    } else if (file) {
        await runSuiteFromFile(path.normalize(path.isAbsolute(file) ? file : path.join(suitesDir, file)), filters, runId);
    } else {
        await runAllSuitesParallel(filters, suitesDir);
    }

    console.log(`\n📊 Execution completed. Run ID: ${runId}`);
}

main().catch((e) => {
    console.error('❌ Error running suites:', e);
    process.exit(1);
});

