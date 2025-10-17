import dotenv from 'dotenv';
import path from 'path';


export function loadEnvironment() {
    dotenv.config({
        path: path.normalize(path.resolve(__dirname, '../../.env'))
    });

    const envName = process.env.ENV || 'qa';
    dotenv.config({ path: path.normalize(path.resolve(__dirname, `../../.env.${envName}`)) });

    return { ...process.env } as Record<string, string>;
}
