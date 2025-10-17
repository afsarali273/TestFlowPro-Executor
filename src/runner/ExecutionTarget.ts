import { TestSuite } from "../types";

export type ExecutionTarget = {
    type: 'suite' | 'testcase' | 'testdata';
    suiteId: string;
    suiteName: string;
    testCaseId?: string;
    testCaseName?: string;
    testDataIndex?: number;
    testDataName?: string;
};


/**
 * Parse a string representing the execution target into a structured ExecutionTarget object.
 *
 * The string format supports three levels:
 * 1. Suite only: "suiteId:suiteName"
 * 2. Suite + Test Case: "suiteId:suiteName > testCaseId:testCaseName"
 * 3. Suite + Test Case + Test Data: "suiteId:suiteName > testCaseId:testCaseName > testDataIndex:testDataName"
 *
 * Levels are separated by `>` and identifiers by `:`. Spaces around `>` are trimmed automatically.
 *
 * @example
 * // Suite only
 * parseExecutionTarget("bookstore:Bookstore Application")
 * // Returns:
 * // { type: 'suite', suiteId: 'bookstore', suiteName: 'Bookstore Application' }
 *
 * @example
 * // Suite + Test Case
 * parseExecutionTarget("bookstore:Bookstore Application > login:LoginTest")
 * // Returns:
 * // { type: 'testcase', suiteId: 'bookstore', suiteName: 'Bookstore Application', testCaseId: 'login', testCaseName: 'LoginTest' }
 *
 * @example
 * // Suite + Test Case + Test Data
 * parseExecutionTarget("bookstore:Bookstore Application > login:LoginTest > 2:InvalidCredentials")
 * // Returns:
 * // {
 * //   type: 'testdata',
 * //   suiteId: 'bookstore',
 * //   suiteName: 'Bookstore Application',
 * //   testCaseId: 'login',
 * //   testCaseName: 'LoginTest',
 * //   testDataIndex: 2,
 * //   testDataName: 'InvalidCredentials'
 * // }
 *
 * @param targetStr - The target string to parse
 * @returns ExecutionTarget - structured object representing the target
 * @throws Error - if the string does not match any of the allowed formats
 */
export function parseExecutionTarget(targetStr: string): ExecutionTarget {
    const parts = targetStr.split(' > ').map(p => p.trim());

    if (parts.length === 1) {
        const [suiteId, suiteName] = parts[0].split(':');
        return { type: 'suite', suiteId, suiteName };
    } else if (parts.length === 2) {
        const [suiteId, suiteName] = parts[0].split(':');
        const [testCaseId, testCaseName] = parts[1].split(':');
        return { type: 'testcase', suiteId, suiteName, testCaseId, testCaseName };
    } else if (parts.length === 3) {
        const [suiteId, suiteName] = parts[0].split(':');
        const [testCaseId, testCaseName] = parts[1].split(':');
        const [testDataIndex, testDataName] = parts[2].split(':');
        return {
            type: 'testdata',
            suiteId,
            suiteName,
            testCaseId,
            testCaseName,
            testDataIndex: parseInt(testDataIndex),
            testDataName
        };
    }

    throw new Error(`Invalid target format: ${targetStr}. Expected formats: 
    "suiteId:suiteName" 
    "suiteId:suiteName > testCaseId:testCaseName" 
    "suiteId:suiteName > testCaseId:testCaseName > testDataIndex:testDataName"`);
}

