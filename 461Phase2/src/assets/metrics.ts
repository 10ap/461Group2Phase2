import { Octokit, App } from "octokit"; // Octokit v17
const { exec } = require('child_process'); // to execute shell cmds async version
import { execSync } from 'child_process'; // to execute shell cmds
import * as fs from 'fs';
import { logger, time } from '../../logger';
import * as path from 'path';
import { promisify } from 'util';

const BlueBirdPromise = require('bluebird')
const tar = require('tar');
import axios from 'axios';
import * as fsExtra from 'fs-extra';
const { ESLint } = require('eslint');
const archiver = require('archiver');

const writeFile = promisify(fs.writeFile);
const eslintCommand = 'npx eslint --ext .ts'; // Add any necessary ESLint options here

const gitHubToken = String(process.env.GITHUB_TOKEN);
const octokit = new Octokit({ 
    auth: gitHubToken, // github token
    userAgent: 'pkg-manager/v1.0.0'
});
//////////////////////////////////////////////////////////////////////
// now actual metric score calculations

interface RepoData {
    URL: string;
    NET_SCORE: number;
    RAMP_UP_SCORE: number;
    CORRECTNESS_SCORE: number;
    BUS_FACTOR_SCORE: number;
    LICENSE_SCORE: number;
    GOOD_PINNING_PRACTICE: number;
    PULL_REQUEST: number;
    RESPONSIVE_MAINTAINER_SCORE: number;
}

function calcuBusFactor(x: number): number {
    const result = (Math.pow((Math.log(x + 1) / (Math.log(1500+1))), 1.22));
    //console.log(`Bus Factor: ${result}`);
    return result;
  }


function calcRampUpScore(x: number): number {
    const result = (1 - (Math.pow((Math.log(x + 1) / (Math.log(105906+1))), 1.22)));
    //console.log(`Ramp Up: ${result}`);
    return result;
}

function calcLicenseScore(licenseName: string): number {
    let licenseScore = 0;
    const lowercaseLicense = licenseName.toLowerCase();

    if (lowercaseLicense.includes('apache') || lowercaseLicense.includes('mit') || lowercaseLicense.includes('gpl') || lowercaseLicense.includes('bsd')) {
        licenseScore = 1;
    }

    return licenseScore;
}

function calcCorrectnessScore(errors: number, filecount: number) {

    // lets get the errors/warnings per file
    // we really only care about errors
 
    const errorsPerFile = errors / filecount;

    let scaledError = 0;
    let correctnessScore = 0;  
    
    if (errorsPerFile > 1 && errorsPerFile < 10) { 
        scaledError = errorsPerFile / 10;
    } else if (errorsPerFile > 10 && errorsPerFile < 100) {
        scaledError = errorsPerFile / 100;
    } else if (errorsPerFile > 100) { // if we have 100 errors per file this is not good 
        scaledError = 1; 
    }

    
    if (scaledError === 1) { // we got way too many errors per file, cannot be a good file
        correctnessScore = 0;
    }  else {
        correctnessScore = (1 - (scaledError));
    }
   
   //console.log(`Correctness: ${correctnessScore}`);
    return correctnessScore;
}


function calcRespMaintScore(timeDifference: number[], username: string, repo: string) {
    const sum = timeDifference.reduce((acc, value) => acc + value, 0);
    const avg = sum / timeDifference.length;
    let maintainer = (1 - (avg / (86400000 * 30)));
    if (maintainer < 0) { // if average response is greater than a month 
        maintainer = 0;
    } else {
        maintainer = (1 - (avg / (86400000 * 30)));
    }

    //console.log(`Responsive Maintainer: ${maintainer}`);
    
    return maintainer;
}

async function calcTotalScore(busFactor: number, rampup: number, license: number, correctness: number, maintainer: number, pullRequest: number, pinning: number) {
    /*
    Sarah highest priority is is not enough maintainers, we tie this into the responsive maintainer score
    responsive ^
    bus factor
        important as we dont want package to die when one person leaves
    ramp up
        she explicitly wants a good ramp up score so engineers can work with the package easier
    */ 
    const busWeight = 0.10;
    const rampupWeight = 0.10;
    const respMaintWeight = 0.30;
    const correctnessWeight = 0.30;
    const pinningWeight = 0.10;
    const pullRequestWeight = 0.10;
    const busScore = busFactor * busWeight;
    const rampupScore = rampup * rampupWeight;
    const respMaintScore = maintainer * respMaintWeight;
    const correctnessScore = correctness * correctnessWeight;
    const pinningScore = pinning * pinningWeight;
    const pullRequestScore = pullRequest * pullRequestWeight;
    const score = license*(busScore + rampupScore + respMaintScore + correctnessScore + pinningScore + pullRequestScore);
    //console.log(`Total Score: ${score.toFixed(5)}`); // can allow more or less decimal, five for now
    return score;
}

async function get_metric_info(gitDetails: { username: string, repo: string }[]): Promise<any> {
    await logger.info(`Getting metric info: ${gitDetails[0].username}, ${gitDetails[0].repo}`);
    for (let i = 0; i < gitDetails.length; i++) {
        const gitInfo = gitDetails[i];
        try {
            //console.log(`Getting Metric info for ${gitInfo.username}/${gitInfo.repo}`);
            //await fetchRepoInfo(gitInfo.username, gitInfo.repo);
            let githubRepoUrl = `https://github.com/${gitInfo.username}/${gitInfo.repo}`
            let destinationPath = 'temp_linter_test';
            const busFactor = await fetchRepoContributors(gitInfo.username, gitInfo.repo);
            const license = await fetchRepoLicense(gitInfo.username, gitInfo.repo); 
            const rampup = await fetchRepoReadme(gitInfo.username, gitInfo.repo);
            const cloneRepoOut = await cloneRepo(githubRepoUrl, destinationPath);
            await fsExtra.remove(cloneRepoOut[1]);
            const correctness:number = cloneRepoOut[0];
            const maintainer = await fetchRepoIssues(gitInfo.username, gitInfo.repo);
            const pinning = await fetchRepoPinning(gitInfo.username, gitInfo.repo);
            const pullRequest = await fetchRepoPullRequest(gitInfo.username, gitInfo.repo);
            let score = await calcTotalScore(busFactor, rampup, license, correctness, maintainer, pullRequest, pinning);
            await logger.info(`Calculated score ${score}\n`);
            return {busFactor: busFactor.toFixed(5), rampup: rampup.toFixed(5), license: license.toFixed(5), correctness: correctness.toFixed(5), maintainer: maintainer.toFixed(5), pullRequest: pullRequest.toFixed(5), pinning: pinning.toFixed(5), score: score.toFixed(5)};
            //outputResults(gitInfo.username, gitInfo.repo, busFactor, rampup, license, correctness, maintainer, pinning, pullRequest, score);
            //console.log(`~~~~~~~~~~~~~~~~\n`);
          
        } catch (error) {
            //console.error(`Failed to get Metric info for ${gitInfo.username}/${gitInfo.repo}`);
            await logger.info(`Failed to get Metric info for ${gitInfo.username}/${gitInfo.repo}\n`);
        }
    }
}

async function outputResults(username: string, repo: string, busFactor: number, rampup: number, license: number, correctness: number, maintainer: number, pinning: number, pullRequest: number, score: number) {
    const url = `https://github.com/${username}/${repo}`;
    
    const repoData: RepoData = {
        URL: url,
        NET_SCORE: parseFloat(score.toFixed(5)),
        RAMP_UP_SCORE: parseFloat(rampup.toFixed(5)),
        CORRECTNESS_SCORE: parseFloat(correctness.toFixed(5)),
        BUS_FACTOR_SCORE: parseFloat(busFactor.toFixed(5)),
        LICENSE_SCORE: license,
        GOOD_PINNING_PRACTICE: parseFloat(pinning.toFixed(5)),
        PULL_REQUEST: parseFloat(pullRequest.toFixed(5)),
        RESPONSIVE_MAINTAINER_SCORE: parseFloat(maintainer.toFixed(5)),
    };
    console.log(JSON.stringify(repoData));
    const ndJsonpath = `./results.ndjson`;
    await logger.info(JSON.stringify(repoData) + "\n");
    await logger.info(JSON.stringify(repoData) + "\n");
}

//////////////////////////////////////////////////////////////////////
// here we are getting everything we need for our metrics from the api  (contributors, license, readme, issues, etc)

async function fetchRepoInfo(username: string,repo: string) { 

    try { 
        const repo_info = await octokit.request("GET /repos/{owner}/{repo}", {
            owner: username,
            repo: repo
        });

        return repo_info;
    } catch (error) { 
        //console.error(`Failed to get repo info for ${username}/${repo}`);
        await logger.info(`Failed to get repo info for ${username}/${repo}\n`);
    }
}

async function fetchRepoContributors(username: string, repo: string): Promise<number>{ 

    try {
        const repo_contributors = await octokit.paginate(`GET /repos/${username}/${repo}/contributors`, {
            per_page: 100,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
              }

        });
        
        const numberOfContributors = repo_contributors.length;
        return calcuBusFactor(numberOfContributors);
        
    
    } catch (error) { 
        //console.error(`Failed to get repo contributors for ${username}/${repo} due to: `, error);
        await logger.info(`Failed to get repo contributors for ${username}/${repo}\n`)
        return 0; 
    }
}

async function fetchRepoLicense(username: string, repo: string): Promise<number> { 
    //let licenseScore = 0; // define licenseScore here
    
    try { 
        const response = await octokit.request("GET /repos/{owner}/{repo}/license", {
            owner: username,
            repo: repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
              }
        });
        
        if((response.data.license?.key && (response.data.license?.key != "other"))) {
            return calcLicenseScore(response.data.license.name);
        } else { 
            //console.error(`No license found for ${username}/${repo}`);
            await logger.info(`No license found for ${username}/${repo}\r\nEither License not compatible with LGPLv2.1, or was not found in repo's license section.\n`);
            return 0;
        }
    } catch (error) { 
        //sconsole.error(`Failed to get repo license for ${username}/${repo}`, error);
        await logger.info(`Failed to get repo license for ${username}/${repo} from API\n`)
        return 0;  
    }
    
}

async function fetchRepoReadme(username: string, repo: string): Promise <number> {

    try {
        const repo_readme = await octokit.request("GET /repos/{owner}/{repo}/readme", {
            owner: username,
            repo: repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
              }
        });
        
        

        const readme = Buffer.from(repo_readme.data.content, 'base64').toString('utf8'); // convert to utf8 string 
        const test = readme.length; // test to see if readme is empty
        const size_kb = (test / 1024).toFixed(2); // convert to kb
        const size_kb_int = parseInt(size_kb); // convert to int
        
        if (test === 0) {
            //console.error(`Readme for ${username}/${repo}: No readme found`);
            await logger.info(`Readme for ${username}/${repo}: No readme found\n`)
        }
        return calcRampUpScore(size_kb_int); // calculate rampup time
        
    } catch (error) {
        //console.error(`Failed to get repo readme for ${username}/${repo}`);
        await logger.info(`Failed to get repo readme for ${username}/${repo}\n`);
        return 0; 
    }
}


//function for getting all typescript and javascript files from a repo
// function getRepoFiles(username: string, repo: string) {

interface RepoFile {
    name: string;
}

async function fetchRepoIssues(username: string, repo: string) {

    try {
        const timeDifference: number[] = []; //list to keep track of time differences for avg
        //var openIssueCnt = 0;
        const response = await octokit.request("GET /repos/{owner}/{repo}/issues", {
            owner: username,
            repo: repo,
            state: "all", // Fetch both open and closed issues
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
        
        if (response.data.length === 0) {
            //console.error(`No issues found for ${username}/${repo}`);
            await logger.info(`No issues found for ${username}/${repo}\n`);
            return 0;
        }

        response.data.forEach((issue) => {
            const createdAt = new Date(issue.created_at);
            var closedAt;
            if (issue.closed_at) {
                closedAt = new Date(issue.closed_at);
                var difference = closedAt.valueOf() - createdAt.valueOf();
                timeDifference.push(difference);
            }
            else {
                closedAt = null;
            }
        });  
        return calcRespMaintScore(timeDifference, username, repo);
    } catch (error) {
        //console.error(`Failed to get issues for ${username}/${repo}`);
        await logger.info(`Failed to get issues for ${username}/${repo}\n`);
        return 0;
    }
}

async function fetchRepoPinning(username: string, repo: string) {
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/contents/package.json', {
            owner: username,
            repo: repo,
        });

        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        const packageJson = JSON.parse(content);

        if (packageJson.dependencies) {
            let totalPackages = 0;
            let nonPinnedPackages = 0;
            Object.keys(packageJson.dependencies).forEach(deps => {
                let version = packageJson.dependencies[deps];
                const regex = /^\d+(\.\d+){2}(\.[a-zA-Zx])?$/;
                if(!regex.test(version)) {
                    nonPinnedPackages++;
                }
                totalPackages++;
            });
            //console.log(packageJson.dependencies);
            return nonPinnedPackages/totalPackages;
        } else {
            return 1;
        }
    } catch (error) {
        await logger.info('Error occurred while fetching data:', error);
        throw error;
    }
}

async function fetchRepoPullRequest(username: string, repo: string) {
    try {
        const pullRequests = await octokit.paginate("GET /repos/{owner}/{repo}/pulls", {
          owner: username,
          repo: repo,
          state: "closed",
        });
    
        let reviewedLines = 0;
        let totalLines = 0;
    
        let idx = 0;
        for (const pr of pullRequests) {
            if(idx > 50) {
                break;
            }
            if (pr.merged_at) {
                const files = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
                    owner: username,
                    repo: repo,
                    pull_number: pr.number,
                });
    
                for (const file of files) {
                    totalLines += file.additions;
    
                    const reviewComments = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
                        owner: username,
                        repo: repo,
                        pull_number: pr.number,
                    });
    
                    const fileComments = reviewComments.filter((comment: any) => comment.path === file.filename);
                    if (fileComments.length > 0) {
                        reviewedLines += file.additions;
                    }
                }
            }
            idx++;
        }
    
        if (totalLines === 0) {
          //console.log("No code changes found in the pull requests of the repository.");
          return 0;
        } else {
          const fraction = reviewedLines / totalLines;
          //console.log(`Fraction of code introduced through reviewed pull requests: ${fraction}`);
          return fraction;
        }
    } catch (error) {
        await logger.info("An error occurred while fetching data from GitHub API:", error);
        return 0;
    }
}

async function extractTarball(tarballPath: string, targetDir: any) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(tarballPath)
            .pipe(tar.extract({ cwd: targetDir, strip: 1 }))
            .on('error', reject)
            .on('end', resolve);
    });
}

async function downloadFile(url: string, destination: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(fs.createWriteStream(destination));

    await new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
    });
}

async function cloneRepo(repoUrl: string, destinationPath: string): Promise<[number, string]> {
    try {
        const cloneDir = path.join(__dirname, destinationPath);
        if (!fs.existsSync(cloneDir)) {
            fs.mkdirSync(cloneDir);
        }

        const tarballUrl = `${repoUrl}/archive/master.tar.gz`;
        const tarballPath = path.join(__dirname, 'temp.tar.gz');

        await downloadFile(tarballUrl, tarballPath);
        await extractTarball(tarballPath, cloneDir);

        await logger.info("Tarball extracted successfully");

        let score = await lintDirectory(cloneDir);

        fs.unlinkSync(tarballPath);
        return [score, cloneDir];
    } catch (error) {
        await logger.info("An error occurred when cloning the repo: ", error);
        return [0,""];
    }
}

async function lintDirectory(directoryPath: any) {
    const eslint = new ESLint({
        overrideConfig: {
            // ESLint configuration for JavaScript files
            parserOptions: {
                ecmaVersion: 2021,
            },
            rules: {
                // Add your JavaScript ESLint rules here
                // Example: 'semi': ['error', 'always']
            },
        },
        useEslintrc: false,
    });

    const tsEslint = new ESLint({
        overrideConfig: {
            // ESLint configuration for TypeScript files
            parser: '@typescript-eslint/parser',
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: 'module',
                project: './tsconfig.json', // Path to your tsconfig.json file
            },
            plugins: ['@typescript-eslint'],
            extends: [
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking',
            ],
            rules: {
                // Add your TypeScript ESLint rules here
                // Example: '@typescript-eslint/explicit-module-boundary-types': 'error'
            },
        },
        useEslintrc: false,
    });

    let totalWarnings = 0;
    let totalErrors = 0;
    let totalLines = 0;

    try {
        const results = await Promise.all([
            eslint.lintFiles([path.join(directoryPath, '**/*.js')]),
        ]);

        for (const result of results) {
            for (const fileResult of result) {
                const fileContent = fs.readFileSync(fileResult.filePath, 'utf-8');
                const lines = fileContent.split('\n').length; // Count lines
                totalLines += lines;
                totalWarnings += fileResult.warningCount;
                totalErrors += fileResult.errorCount;
            }
        }
    } catch (error) {
        await logger.info('Error while linting (js):', error);
    }

    try {
        const results = await Promise.all([
            tsEslint.lintFiles([path.join(directoryPath, '**/*.ts')]),
        ]);

        let totalWarnings = 0;
        let totalErrors = 0;

        let totalLines = 0;
        for (const result of results) {
            for (const fileResult of result) {
                const fileContent = fs.readFileSync(fileResult.filePath, 'utf-8');
                const lines = fileContent.split('\n').length; // Count lines
                totalLines += lines;
                totalWarnings += fileResult.warningCount;
                totalErrors += fileResult.errorCount;
            }
        }
    } catch (error) {
        await logger.info('Error while linting (ts):', error);
    }

    await logger.info(`Total Warnings: ${totalWarnings}`);
    await logger.info(`Total Errors: ${totalErrors}`);
    await logger.info(`Total lines: ${totalLines}`);
    return Math.max((totalLines - 5 * (totalWarnings + totalErrors)) / totalLines, 0);
}

const readJSON = (jsonPath: string, callback: (data: Record<string, unknown> | null) => void) => {
    fs.readFile(jsonPath, 'utf-8', async (err, data) => {
        if (err) {
        await logger.info('Error reading file:', err);
        callback(null); // Pass null to the callback to indicate an error
        return;
        }
    
        try {
        const jsonData = JSON.parse(data);
        callback(jsonData); // Pass the parsed JSON data to the callback
        }catch (parseError) {
        await logger.info('Error parsing JSON:', parseError);
        callback(null); // Pass null to the callback to indicate an error
        }
    });
    };
    

async function check_npm_for_open_source(filePath: string): Promise<string> {
    return new Promise((resolve) => {
        readJSON(filePath, async (jsonData) => {
        if (jsonData !== null) {
            await logger.info(`reading json (not null)...`);
            const repository = jsonData.repository as Record<string, unknown>;
            if (repository.type == 'git') {
                await logger.info(`repo is git`);
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
                    
                await logger.info(`made gitUrl: ${gitUrl}`);
                resolve(gitUrl);
            } else {
                await logger.info('No git repository found.');
                resolve("Invalid");
            }
        } else {
            await logger.info('Failed to read or parse JSON.');
            return "";
        }
        });

    });
}

    const get_github_info = (gitUrl: string): { username: string, repo: string}  => {
        const gitRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)/i; // regex to get user/repo name  from git url
        const gitMatch = gitUrl.match(gitRegex);
        if (gitMatch) { 
            return {
                username: gitMatch[1],
                repo: gitMatch[2]
            };
        }
        return {
            username: "",
            repo: ""
        };
    }

    const get_npm_package_name = (npmUrl: string): string  => { 
        const npmRegex = /https:\/\/www\.npmjs\.com\/package\/([\w-]+)/i; // regex to get package name from npm url
        const npm_match = npmUrl.match(npmRegex);
        if (npm_match) { // if url is found with proper regex (package identifier)
            return npm_match[1]; // return this package name
        }
        return "";  
    }

    async function zipDirectory(directoryPath: any, outputZipPath: any) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputZipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
    
            output.on('close', () => {
                logger.info('Directory has been zipped successfully.');
                resolve(outputZipPath);
            });
    
            archive.on('error', (err: any) => {
                logger.error('Error zipping directory:', err);
                reject(err);
            });
    
            archive.pipe(output);
            archive.directory(directoryPath, false);
            archive.finalize();
        });
    }    

export {
    get_metric_info, cloneRepo, check_npm_for_open_source, get_github_info, get_npm_package_name, zipDirectory
}
