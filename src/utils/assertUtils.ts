import { JSONPath } from 'jsonpath-plus';
import { Assertion } from '../types';
import { DOMParser } from 'xmldom';
import * as xpath from 'xpath';
import {injectVariables} from "./variableStore";

export function assertJson(response: any, statusCode: number, assertions: Assertion[]) {
    for (const a of assertions) {
        const { type, jsonPath } = a;
        let {expected} = a;
        if( typeof expected === 'string' ){
            expected = injectVariables(expected);
        }
        let result;
        if (jsonPath && type !== 'arrayObjectMatch') {
            result = JSONPath({ path: jsonPath, json: response })[0];
        }

        switch (type) {
            case 'equals':
                if (result !== expected)
                    throw new Error(`Assertion failed: ${jsonPath} expected ${expected}, got ${result}`);
                break;

            case 'notEquals':
                if (result === expected)
                    throw new Error(`Assertion failed: ${jsonPath} should not equal ${expected}`);
                break;

            case 'contains':
                if (typeof result === 'string') {
                    if (!result.includes(expected))
                        throw new Error(`Assertion failed: ${jsonPath} does not contain ${expected}`);
                } else if (Array.isArray(result)) {
                    if (!result.includes(expected))
                        throw new Error(`Assertion failed: ${jsonPath} array does not contain ${expected}`);
                } else {
                    throw new Error(`'contains' only supports string or array`);
                }
                break;

            case 'startsWith':
                if (!String(result).startsWith(expected))
                    throw new Error(`Assertion failed: ${jsonPath} does not start with '${expected}'`);
                break;

            case 'endsWith':
                if (!String(result).endsWith(expected))
                    throw new Error(`Assertion failed: ${jsonPath} does not end with '${expected}'`);
                break;

            case 'greaterThan':
                if (!(Number(result) > Number(expected)))
                    throw new Error(`Assertion failed: ${jsonPath} expected > ${expected}, got ${result}`);
                break;

            case 'lessThan':
                if (!(Number(result) < Number(expected)))
                    throw new Error(`Assertion failed: ${jsonPath} expected < ${expected}, got ${result}`);
                break;

            case 'in':
                if (!Array.isArray(expected) || !expected.includes(result))
                    throw new Error(`Assertion failed: ${jsonPath} value '${result}' not in expected list`);
                break;

            case 'notIn':
                if (Array.isArray(expected) && expected.includes(result))
                    throw new Error(`Assertion failed: ${jsonPath} value '${result}' should not be in list`);
                break;

            case 'includesAll':
                if (!Array.isArray(result))
                    throw new Error(`Assertion failed: ${jsonPath} result is not an array`);
                const missing = expected.filter((e: any) => !result.includes(e));
                if (missing.length > 0)
                    throw new Error(`Assertion failed: ${jsonPath} missing values ${missing.join(', ')}`);
                break;

            case 'length':
                if ((typeof result === 'string' || Array.isArray(result)) && result.length !== expected) {
                    throw new Error(`Assertion failed: ${jsonPath} length expected ${expected}, got ${result.length}`);
                }
                break;

            case 'size':
                const size = Array.isArray(result) ? result.length : Object.keys(result || {}).length;
                if (size !== expected)
                    throw new Error(`Assertion failed: ${jsonPath} size expected ${expected}, got ${size}`);
                break;

            case 'statusCode':
                if (statusCode !== expected)
                    throw new Error(`Assertion failed: statusCode expected ${expected}, got ${statusCode}`);
                break;

            case 'type':
                if (typeof result !== expected)
                    throw new Error(`Assertion failed: ${jsonPath} type expected ${expected}, got ${typeof result}`);
                break;

            case 'exists':
                if (typeof result === 'undefined')
                    throw new Error(`Assertion failed: ${jsonPath} does not exist`);
                break;

            case 'regex':
                if (!new RegExp(expected).test(result))
                    throw new Error(`Assertion failed: ${jsonPath} does not match regex ${expected}`);
                break;

            case 'arrayObjectMatch': {
                const array = JSONPath({ path: jsonPath!, json: response })[0];
                if (!Array.isArray(array)) {
                    throw new Error(`Assertion failed: ${jsonPath} did not return an array`);
                }

                const { matchField, matchValue, assertField } = a as any;
                const match = array.find((item: any) => item[matchField] === matchValue);

                if (!match) {
                    throw new Error(`Assertion failed: No item in ${jsonPath} with ${matchField}='${matchValue}'`);
                }

                if (match[assertField] !== expected) {
                    throw new Error(
                        `Assertion failed: In ${jsonPath}, expected ${assertField} for ${matchField}='${matchValue}' to be '${expected}', but got '${match[assertField]}'`
                    );
                }
                break;
            }

            default:
                throw new Error(`Unsupported assertion type: ${type}`);
        }
    }
}

export function assertXPath(xmlString: string, assertion: Assertion): void {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const nodes = xpath.select(<string>assertion.xpathExpression, doc) as any[];

    if (!nodes || nodes.length === 0) {
        throw new Error(`XPath '${assertion.xpathExpression}' did not match any nodes`);
    }

    let actualValue = nodes[0]?.textContent || nodes[0]?.data || nodes[0]?.toString();
    const expectedValue = assertion.expected;

    switch (assertion.type) {
        case 'equals':
            if (actualValue !== expectedValue) {
                throw new Error(`Expected '${expectedValue}', got '${actualValue}'`);
            }
            break;
        case 'contains':
            if (!actualValue.includes(expectedValue)) {
                throw new Error(`Expected '${actualValue}' to contain '${expectedValue}'`);
            }
            break;
        default:
            throw new Error(`Unsupported assertion type '${assertion.type}' for SOAP`);
    }
}
