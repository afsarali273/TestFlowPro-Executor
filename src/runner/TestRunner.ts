import { TestSuite } from "../types";
import { Reporter } from "../reporter";
import { executeSuite } from "../executor";
import { UIRunner } from "../ui-test";
import { ExecutionTarget } from "./ExecutionTarget";

export class TestRunner {
    constructor(private reporter: Reporter) {}

    async executeSuite(suite: TestSuite) {
        console.log(`\n▶️ Suite: ${suite.suiteName} (${suite.id})`);
        await executeSuite(suite, this.reporter);
    }

    async executeTestCase(suite: TestSuite, target: ExecutionTarget) {
        const testCase = suite.testCases.find(tc =>
            tc.name === target.testCaseName || tc.id === target.testCaseId
        );

        if (!testCase) throw new Error(`TestCase not found: ${target.testCaseId}:${target.testCaseName}`);

        console.log(`\n▶️ TestCase: ${testCase.name} (${suite.suiteName})`);

        if (suite.type === "UI") {
            const uiRunner = new UIRunner(this.reporter);
            await uiRunner.init({ headless: false });
            await uiRunner.runTestCase(testCase);
            await uiRunner.close();
        } else {
            await executeSuite({ ...suite, testCases: [testCase] }, this.reporter);
        }
    }

    async executeTestData(suite: TestSuite, target: ExecutionTarget) {
        if (suite.type !== "API") throw new Error("TestData execution only supported for API suites");

        const testCase = suite.testCases.find(tc =>
            tc.name === target.testCaseName || tc.id === target.testCaseId
        );

        if (!testCase || !["REST", "SOAP"].includes(testCase.type)) {
            throw new Error(`API TestCase not found: ${target.testCaseId}:${target.testCaseName}`);
        }

        const testData = testCase.testData[target.testDataIndex!];
        if (!testData) throw new Error(`TestData not found at index ${target.testDataIndex}`);

        console.log(`\n▶️ TestData: ${testData.name} (${testCase.name})`);

        await executeSuite(
            { ...suite, testCases: [{ ...testCase, testData: [testData] }] },
            this.reporter
        );
    }
}
