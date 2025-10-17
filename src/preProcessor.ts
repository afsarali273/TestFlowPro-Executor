import { faker } from '@faker-js/faker';
import {injectVariables, setVariable} from './utils/variableStore';
import crypto from 'crypto';
import {runQuery} from "./db/dbClient";

interface PreProcessStep {
    var?: string; // Optional, only for single output
    function: string;
    args?: any[];
    db?: string;
    mapTo?: Record<string, string>; // key = variable name, value = key in returned object
}

export async function runPreProcessors(steps: PreProcessStep[]) {
    for (const step of steps) {
        let value: any;

        const injectedArgs = (step.args || []).map(arg =>
            typeof arg === 'string' ? injectVariables(arg) : arg
        );

        switch (step.function) {

            case 'getRandomData':
                value = getRandomFakeData(step.args || []);
                break;

            case 'date.now':
                value = Date.now().toString();
                break;

            case 'encrypt':
                const [text] = injectedArgs;
                const cipher = crypto.createCipheriv(
                    'aes-256-ctr',
                    'My32charPassword1234567890abcdef',
                    '1234567890123456'
                );
                value = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
                break;

            case 'generateUser':
                value = {
                    username: faker.internet.userName(),
                    email: faker.internet.email()
                };
                break;

            case 'dbQuery':
                const [query] = injectedArgs;
                const dbName = step.db;
                if (!dbName) throw new Error(`Missing 'db' field for dbQuery preProcess`);

                const rows = await runQuery(query, dbName);

                if (rows.length === 0) {
                    console.warn(`⚠️ No result from DB query on ${dbName}: ${query}`);
                    value = '';
                    break;
                }

                value = rows[0];
                break;

            default:
                console.warn(`⚠️ Unknown preProcess function: ${step.function}`);
                value = '';
        }

        if (step.mapTo && typeof value === 'object') {
            for (const [targetVar, keyInValue] of Object.entries(step.mapTo)) {
                if (value.hasOwnProperty(keyInValue)) {
                    setVariable(targetVar, value[keyInValue]);
                    console.log(`🔧 PreProcess (mapTo): ${targetVar} = ${value[keyInValue]}`);
                } else {
                    console.warn(`⚠️ mapTo key "${keyInValue}" not found in function output`);
                }
            }
        } else if (value && typeof value === 'object' && !Array.isArray(value) && !step.var) {
            for (const [k, v] of Object.entries(value)) {
                setVariable(k, v);
                console.log(`🔧 PreProcess (multi): ${k} = ${v}`);
            }
        } else {
            setVariable(step.var || step.function, value);
            console.log(`🔧 PreProcess: ${step.var || step.function} = ${value}`);
        }
    }
}


export function getRandomFakeData(args: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key of args) {
        switch (key.toLowerCase()) {
            case 'name':
                result[key] = faker.person.fullName();
                break;
            case 'email':
                result[key] = faker.internet.email().toLowerCase();
                break;
            case 'username':
                result[key] = faker.internet.userName();
                break;
            case 'phone':
                result[key] = faker.phone.number();
                break;
            case 'address':
                result[key] = faker.location.streetAddress();
                break;
            case 'city':
                result[key] = faker.location.city();
                break;
            case 'uuid':
                result[key] = faker.string.uuid();
                break;
            case 'password':
                result[key] = faker.internet.password();
                break;
            case 'company':
                result[key] = faker.company.name();
                break;
            default:
                result[key] = faker.word.sample(); // fallback
        }
    }
    return result;
}


