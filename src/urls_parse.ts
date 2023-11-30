// this section will take in the urls.txt arguement from the command line and parse it for npm package names and github user/repo names

import * as fs from 'fs';
import { logFilePath, logLevel } from './main'

const npmRegex = /https:\/\/www\.npmjs\.com\/package\/([\w-]+)/i; // regex to get package name from npm url
const gitRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)/i; // regex to get user/repo name  from git url

// read urls from file
// returns array of urls
const url_list = (filename:string): string[] => {
    try { 
        return fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean); 
    } catch (error) { 
        //console.error(`File does not exist`);
        if(logLevel == 2){
            fs.appendFile(logFilePath, "URL file does not exist.\n", (err)=>{});
        }
        process.exit(1);  
    }
}

/*
 gets npm package names
 returns package name
 npm package names are found in the url after /package/
 example: https://www.npmjs.com/package/express
*/
const get_npm_package_name = (npmUrl: string): string | null  => { 
    const npm_match = npmUrl.match(npmRegex);
    if (npm_match) { // if url is found with proper regex (package identifier)
        return npm_match[1]; // return this package name
    }
    return null;  
}

/*
 gets github username and repo
 returns object with username and repo
 example: https://github.com/nullivex/nodist
*/
const get_github_info = (gitUrl: string): { username: string, repo: string} | null  => {
    const gitMatch = gitUrl.match(gitRegex);
    if (gitMatch) { 
        return {
            username: gitMatch[1],
            repo: gitMatch[2]
        };
    }
    return null; 
}

export {
    get_github_info,
    url_list,
    get_npm_package_name,
}