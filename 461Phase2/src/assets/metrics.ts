import { Octokit, App } from "octokit"; // Octokit v17
const { exec } = require('child_process'); // to execute shell cmds async version
import { execSync } from 'child_process'; // to execute shell cmds
import * as fs from 'fs';
import { logger, time } from '../../logger';

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
            await createLintDirs(gitInfo.username, gitInfo.repo);
            const busFactor = await fetchRepoContributors(gitInfo.username, gitInfo.repo);
            const license = await fetchRepoLicense(gitInfo.username, gitInfo.repo); 
            const rampup = await fetchRepoReadme(gitInfo.username, gitInfo.repo);
            const correctness = await fetchLintOutput(gitInfo.username, gitInfo.repo);
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

async function fetchTsAndJsFiles(username: string, repo: string)  {
    // not gonna worry about overwriting files, we just need a decent amount to lint 

    try {

        const limitFiles = 2500; // changing this will limit how many files we get from a repo
        let charsAccumulated = 0; // keep track of characters accumulated
        let filesCounted = 0; // files counted
        // needs to handle sha thats not master branch
        //https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28#get-a-tree
        const repoInfo = await fetchRepoInfo(username, repo);
        const defaultBranch = repoInfo?.data?.default_branch;

        if (!defaultBranch) {
            //console.error(`Failed to fetch default branch for ${username}/${repo}`);
            await logger.info(`Failed to fetch default branch for ${username}/${repo}\n`);
            return;
        }
        

        const response = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner: username,
            repo: repo,
            tree_sha: defaultBranch,
            recursive: "1",
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        

        // only grab ts and js files
        const tsAndJsFiles = response.data.tree.filter(file => {
            const eslintFiles = [
                '.eslintrc', 
                '.eslintrc.js', 
                '.eslintrc.json', 
                '.eslintrc.yaml', 
                '.eslintrc.yml', 
                '.eslintignore',
                '.commitlintrc.js'
            ];
            if (eslintFiles.includes(file.path?.split('/').pop() || '')) return false; // skip eslint files
            return (file.type === "blob" && file.path && (file.path.endsWith(".ts") || file.path.endsWith(".js")));
        });

        const fileCount = tsAndJsFiles.length;
        

        // create directory for repo
        const dirPath = `./temp_linter_test/${repo}`;
        createLintDirs(username, repo);
        await logger.info(`Found TS and JS files for ${username}/${repo}: ${tsAndJsFiles}\n`);

        for (const file of tsAndJsFiles) {
            
            if (file.type === "blob" || file.type === "file") {
                const fileResponse = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                    owner: username,
                    repo: repo,
                    path: file.path ?? '',
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });

                

                if ('content' in fileResponse.data) {
                    const fileContent = fileResponse.data.content;
                    const fileContentDecoded = Buffer.from(fileContent, 'base64').toString('utf8');
                    const length = fileContentDecoded.length;
                    charsAccumulated += length;
                    if (length === 0) {
                        continue; // skip empty files and files less than 100 characters
                    }
                    const fileName = file.path?.split('/').pop();
                    if (!fileName) {
                        //console.error(`Failed to get file name for ${username}/${repo}/${file.path}`);
                        await logger.info(`Failed to get file name for ${username}/${repo}/${file.path}\n`);
                        continue;
                    }
                    
                    filesCounted++;
                    if (charsAccumulated > limitFiles) {
                        break;
                    }
                } else {
                    //console.error(`Failed to get file content for ${username}/${repo}/${file.path}`);
                    await logger.info(`Failed to get file content for ${username}/${repo}/${file.path}\n`);
                }
            }
        }
        await logger.info(`Successfully fetched TS and JS files for ${username}/${repo}\n`);
        return filesCounted;
    } catch (error) {
        //console.error(`Failed to fetch TS and JS files for ${username}/${repo}: ${error}`);
        await logger.info(`Failed to fetch TS and JS files for ${username}/${repo}\n`);
    }

}

async function createLintDirs(username: string, repo: string) {
    await logger.info(`Creating test linting directory for ${username}/${repo} ... \n`);
    const appendRepo = `/${repo}`;
    const subDir = `./temp_linter_test${appendRepo}`;
    const esLintconfig = `/* eslint-env node */
module.exports = {
    extends: ['eslint:recommended'],
    "parserOptions": {
        "ecmaVersion": 5,
    },
    "overrides": [
        {
            "files": ["*.ts", "*.tsx"],
            "parser": "@typescript-eslint/parser",
            "plugins": ['@typescript-eslint'],
            "extends": [
                "plugin:@typescript-eslint/recommended",
            ],
        }
    ],
    root: true,
};
    `;
    const config = esLintconfig.trim(); // remove whitespace
    try {
        fs.mkdirSync(subDir, { recursive: true }); 
        fs.writeFileSync(`${subDir}/.eslintrc.cjs`, config);
        await logger.info(`Successfuly created test linting directory for ${username}/${repo}\n`);
        return 1;
    } catch(e) {
        await logger.info(`Failed to create test linting directory for ${username}/${repo}\n`);
        return e;
    }
}

async function runEslint(directory: string) {
    try {
        const command = `npx eslint ${directory} -o ${directory}/result.json`;
        const output = execSync(command, { encoding: 'utf8' });
        await logger.info(`Linting successful:\n${output}\n`);
        return output;
    } catch (error) {
        await logger.error(`Error executing ESLint: ${error}\n`);
        throw error;
    }
}

async function fetchLintOutput(username: string, repo: string): Promise<number> {

    const subDir = `./temp_linter_test/${repo}`;
    try {
        let fileCount = await fetchTsAndJsFiles(username, repo);
        if (!fileCount) {
            fileCount = 0;
            //console.error(`No TS or JS files found for ${username}/${repo}`);
            await logger.info(`No TS or JS files found for ${username}/${repo}\n`);
            process.exit(1);
        }
        await runEslint(subDir);
        if (!fs.existsSync(`${subDir}/result.json`)) {
            
            //correctness = 1; // if we dont have a result.json file, we will assume the code is correct
            await logger.info(`Calculating correctness (no result.json file): ${0}/${fileCount}\n`);
            return calcCorrectnessScore(0,fileCount);
        
        }
        const {errors} = getErrorAndWarningCount(`${subDir}/result.json`);
        await logger.info(`Calculating correctness: ${errors}/${fileCount}\n`);
        return calcCorrectnessScore(errors,fileCount);
        

    } catch (error) {
        //console.error(`Failed to get lint output for ${username}/${repo}: ${error}`);
        await logger.info(`Failed to get lint output for ${username}/${repo} : ${error}\n`);
        return 0;
    }
}

function getErrorAndWarningCount(filepath: fs.PathOrFileDescriptor) {

    const file = fs.readFileSync(filepath, 'utf8');
    const lines = file.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line.startsWith('✖')) {
            const errorMatch = line.match(/(\d+) error/);
            const errors = errorMatch ? parseInt(errorMatch[1],10) : 0;
            return {errors};
        }
    }
    return {errors: 0};

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
        console.error('Error occurred while fetching data:', error);
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
        console.error("An error occurred while fetching data from GitHub API:", error);
        return 0;
    }
}

export {
    get_metric_info
}
