import path from 'path';
import minimist from 'minimist';
import * as dotenv from 'dotenv';
import {
    findSuiteFile,
    generateRunName,
    runAllSuitesParallel,
    runSuiteFromFile,
    runTarget
} from "./runner/RunController";
import {parseExecutionTarget} from "./runner/ExecutionTarget";

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

 const suitesDir = path.join(__dirname, '../testSuites');

async function main() {
    const argv = minimist(process.argv.slice(2));
    const { file, target, _, ...filters } = argv;
    const runId = generateRunName();

    if (target) {
        const executionTarget = parseExecutionTarget(target);
        let fullPath = file ? path.normalize(path.isAbsolute(file) ? file : path.join(suitesDir, file)) : null;

        if (!fullPath) fullPath = await findSuiteFile(executionTarget.suiteId, executionTarget.suiteName);
        if (!fullPath) return console.error(`❌ Suite not found: ${executionTarget.suiteName}`);

        await runTarget(fullPath, executionTarget, filters, runId);
    } else if (file) {
        await runSuiteFromFile(path.normalize(path.isAbsolute(file) ? file : path.join(suitesDir, file)), filters, runId);
    } else {
        await runAllSuitesParallel(filters);
    }

    console.log(`\n📊 Execution completed. Run ID: ${runId}`);
}

main().catch((e) => {
    console.error('❌ Error running suites:', e);
    process.exit(1);
});

