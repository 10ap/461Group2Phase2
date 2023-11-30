import { Octokit, App } from "octokit"; // Octokit v17
import * as fs from 'fs'; // use filesystem
import { execSync } from 'child_process'; // to execute shell cmds
import * as dotenv from 'dotenv';
const { exec } = require('child_process'); // to execute shell cmds async version

import { get_metric_info } from "./metrics";
import {
    get_github_info,
    url_list,
    get_npm_package_name,
} from "./urls_parse"


const arg = process.argv[2];  // this is the url(s).txt arguement passed to the js executable
const npmPkgName: string[] = []; // setup array for package names
const gitDetails: { username: string, repo: string }[] = []; // setup array for git user/repo name 
const gitUrls: string[] = []; // setup array for git urls

dotenv.config();

// Env variables
const gitHubToken = String(process.env.GITHUB_TOKEN);
const logLevel = Number(process.env.LOG_LEVEL);
const logFilePath = String(process.env.LOG_FILE);

if(!gitHubToken || !logLevel || !logFilePath){
    console.error("Error: environment variables not set...\n", gitHubToken, logLevel, logFilePath);
    console.log("gitHubToken:", gitHubToken);
    console.log("logLevel:", logLevel);
    console.log("logFilePath:", logFilePath);
    process.exit(1);
}

function ensureDirectoryExistence(directory: string): void {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}


// if we get here, we know the token is valid

// octokit setup
const octokit = new Octokit({ 
    auth: gitHubToken, // github token
    userAgent: 'pkg-manager/v1.0.0'
});

// run es lint
function runEslint(directory: string) {
    return new Promise((resolve, reject) => {
        exec(`npx eslint ${directory} -o ${directory}/result.json`, { encoding: 'utf8' }, (error: { code: number; }, stdout: unknown, stderr: any) => {
            if (error) {
                // Check if the error is due to linting issues
                if (error.code === 1) {
                
                    resolve(stdout);  // if error is due to linting, it's not a "real" error for us
                } else {
                    reject(error);
                }
            } else {
                resolve(stdout);
            }
        });
    });
}

////////////////////////////////////////////////////////////////////////////////
// now we want to get the package.json file from the npm package name and the github repo/username
// npmPkgName and gitDetails are the arrays we will use to get the package.json files, they hold:
// the package names and github user/repo names

const readJSON = (jsonPath: string, callback: (data: Record<string, unknown> | null) => void) => {
    fs.readFile(jsonPath, 'utf-8', (err, data) => {
        if (err) {
        //console.error('Error reading file:', err);
        if (logLevel == 2) {
            fs.appendFile(logFilePath, `Error reading file: ${err}\n`, (err)=>{});
        }
        callback(null); // Pass null to the callback to indicate an error
        return;
        }
    
        try {
        const jsonData = JSON.parse(data);
        callback(jsonData); // Pass the parsed JSON data to the callback
        }catch (parseError) {
        //console.error('Error parsing JSON:', parseError);
        if(logLevel == 2){ 
            fs.appendFile(logFilePath, `Error parsing JSON: ${parseError}\n`, (err)=>{});
        }
        callback(null); // Pass null to the callback to indicate an error
        }
    });
    };
    

function check_npm_for_open_source(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
        readJSON(filePath, (jsonData) => {
        if (jsonData !== null) {
            const repository = jsonData.repository as Record<string, unknown>;
            if (repository.type == 'git') {
            let gitUrl: string = repository.url as string;
            if (gitUrl.startsWith('git+ssh://git@')) {
                // Convert SSH URL to HTTPS URL
                gitUrl = gitUrl.replace('git+ssh://git@', 'https://');
            } else if (gitUrl.startsWith('git+https://')) {
                gitUrl = gitUrl.replace('git+https://', 'https://');
            }

            if (gitUrl.endsWith('.git')) { 
                gitUrl = gitUrl.substring(0, gitUrl.length - 4);
            }
                
            //return github url
            gitUrls.push(gitUrl);
            resolve(gitUrl);
            } else {
            //console.error('No git repository found.');
            if(logLevel == 2){
                fs.appendFile(logFilePath, `No git repository found.\n`, (err)=>{});
            }
            resolve("Invalid");
            }
        } else {
            //console.error('Failed to read or parse JSON.');
            if(logLevel == 2){
                fs.appendFile(logFilePath, `Failed to read or parse JSON.\n`, (err)=>{});
            }
            resolve(null);
        }
        });

    });
    }

async function get_npm_package_json(pkgName: string []): Promise<void> { 
    for (let i = 0; i < pkgName.length; i++) {
        const pkg = pkgName[i];
        try {
            const output = execSync(`npm view ${pkg} --json --silent`, { encoding: 'utf8' }); // shell cmd to get json
            fs.writeFileSync(`./temp_npm_json/${pkg}_info.json`, output); // write json to file
            const file = `./temp_npm_json/${pkg}_info.json`; // file path
            const gitURLfromNPM = await check_npm_for_open_source(file);
            if (gitURLfromNPM) {
                const gitInfo = get_github_info(gitURLfromNPM); // get github info
                if (gitInfo) {
                    gitDetails.push(gitInfo); // push to github details array
                }
            }
        } catch (error) {
            //console.error(`Failed to get npm info for package: ${pkg}`);
            if(logLevel == 2){
                fs.appendFile(logFilePath, `Failed to get npm info for package: ${pkg}\n`, (err)=>{});
            }
        }
    }
}

//////////////////////////////////////////////////////////////////////

async function main() { 
    if (fs.existsSync(logFilePath)) { 
        fs.unlinkSync(logFilePath); // delete log file
    }

    ensureDirectoryExistence('./temp_linter_test'); // make temp directory for linter test files
    ensureDirectoryExistence('./temp_npm_json'); // make temp directory for npm json files

    // user tokens are limited to 5000 requests per hour, so we need to limit the amount of requests we make
    // we will make 1 request per second
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    await delay(1000); // wait 1 second


    if (/\.txt$/.test(arg)) {

        const filename = arg;
        const urls = url_list(filename); // grab urls from file. 
        if (urls.length === 0) {
            //console.error("No URLS found");
            if (logLevel == 2) {
                fs.appendFile(logFilePath, `No URLS found\n`, (err)=>{});
            }
            process.exit(0); 
        }
        urls.forEach(url => {
            const npmPackageName = get_npm_package_name(url); // get package name 
            const gitInfo = get_github_info(url); // get github info
            if (npmPackageName) { // since they return the package name or null, we can check for null
                npmPkgName.push(npmPackageName) // push to package name array
            } else if (gitInfo) {
                gitDetails.push(gitInfo); // push to github details array
            } else {
                //console.error(`Error, invalid url: ${url}`); // non git or npm url
                if(logLevel == 2){
                    fs.appendFile(logFilePath, `Error, invalid url: ${url}\n`, (err)=>{});
                }
            }
        }); 

        await get_npm_package_json(npmPkgName);
        try {
            execSync(`curl -f -H "Authorization: token ${gitHubToken}" https://api.github.com/user/repos 2>/dev/null`);
        } catch (error) {
            console.error(`Invalid GitHub token: ${gitHubToken}`);
            if(logLevel == 2){
                fs.appendFile(logFilePath, `Invalid GitHub token: ${gitHubToken}\n`, (err)=>{});
            }
            
        }
        await get_metric_info(gitDetails);
        fs.rmdirSync('./temp_linter_test', { recursive: true });
        fs.rmdirSync('./temp_npm_json', { recursive: true });
 
        process.exit(0);

    } 
    // else {
    //     console.log("Invalid command...\n");
    //     process.exit(0);
    // }
}

main();

// All objects exported to other files
export {
    octokit,
    logLevel,
    logFilePath,
    runEslint,
    ensureDirectoryExistence,
    check_npm_for_open_source,
    readJSON,
}

// https://github.com/Purdue-ECE-461/is-sorted
