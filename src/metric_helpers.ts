//////////////////////////////////////////////////////////////////////
// here we are getting everything we need for our metrics from the api  (contributors, license, readme, issues, etc)
import * as fs from 'fs';
import { octokit, logLevel, logFilePath, runEslint, ensureDirectoryExistence } from './main';
import {
    calcuBusFactor,
    calcLicenseScore,
    calcRampUpScore,
    calcCorrectnessScore,
    calcRespMaintScore,
} from './metrics'


async function fetchRepoInfo(username: string,repo: string) { 

    try { 
        const repo_info = await octokit.request("GET /repos/{owner}/{repo}", {
            owner: username,
            repo: repo
        });

        return repo_info;
    } catch (error) { 
        //console.error(`Failed to get repo info for ${username}/${repo}`);
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to get repo info for ${username}/${repo}\n`, (err)=>{});
        }
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
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to get repo contributors for ${username}/${repo}\n`, (err)=>{});
        }
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
            if(logLevel == 2){
                fs.appendFile(logFilePath, `No license found for ${username}/${repo}\r\nEither License not compatible with LGPLv2.1, or was not found in repo's license section.\n`, (err)=>{});
            }
            return 0;
        }
    } catch (error) { 
        //sconsole.error(`Failed to get repo license for ${username}/${repo}`, error);
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to get repo license for ${username}/${repo} from API\n`, (err)=>{});
        }
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
            if(logLevel == 2){
                fs.appendFile(logFilePath, `Readme for ${username}/${repo}: No readme found\n`, (err)=>{});
            }
        }
        return calcRampUpScore(size_kb_int); // calculate rampup time
        
    } catch (error) {
        //console.error(`Failed to get repo readme for ${username}/${repo}`);
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to get repo readme for ${username}/${repo}\n`, (err)=>{});
        }
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

        const limitFiles = 25000; // changing this will limit how many files we get from a repo
        let charsAccumulated = 0; // keep track of characters accumulated
        let filesCounted = 0; // files counted
        // needs to handle sha thats not master branch
        //https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28#get-a-tree
        const repoInfo = await fetchRepoInfo(username, repo);
        const defaultBranch = repoInfo?.data?.default_branch;

        if (!defaultBranch) {
            //console.error(`Failed to fetch default branch for ${username}/${repo}`);
            if(logLevel == 2){
                fs.appendFile(logFilePath, `Failed to fetch default branch for ${username}/${repo}\n`, (err)=>{});
            }
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
                        if(logLevel == 2){
                            fs.appendFile(logFilePath, `Failed to get file name for ${username}/${repo}/${file.path}\n`, (err)=>{});
                        }
                        continue;
                    }
                    
                    fs.writeFileSync(`${dirPath}/${fileName}`, fileContentDecoded);
                    filesCounted++;
                    if (charsAccumulated > limitFiles) {
                        break;
                    }
                } else {
                    //console.error(`Failed to get file content for ${username}/${repo}/${file.path}`);
                    if(logLevel == 2){
                        fs.appendFile(logFilePath, `Failed to get file content for ${username}/${repo}/${file.path}\n`, (err)=>{});
                    }
                }
            }
        }
        return filesCounted;
    } catch (error) {
        //console.error(`Failed to fetch TS and JS files for ${username}/${repo}: ${error}`);
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to fetch TS and JS files for ${username}/${repo}\n`, (err)=>{});
        }
    }

}

async function createLintDirs(username: string, repo: string) {
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
        fs.writeFileSync(`${subDir}/.eslintrc.cjs`, config);
        return 1;
    } catch(e) {
        return e;
    }
}

async function fetchLintOutput(username: string, repo: string): Promise<number> {

    const subDir = `./temp_linter_test/${repo}`;
    try {
        let fileCount = await fetchTsAndJsFiles(username, repo);
        if (!fileCount) {
            fileCount = 0;
            //console.error(`No TS or JS files found for ${username}/${repo}`);
            if(logLevel == 2){
                fs.appendFile(logFilePath, `No TS or JS files found for ${username}/${repo}\n`, (err)=>{});
            }
            process.exit(1);
        }
        await runEslint(subDir);
        if (!fs.existsSync(`${subDir}/result.json`)) {
            
            //correctness = 1; // if we dont have a result.json file, we will assume the code is correct
            return calcCorrectnessScore(0,fileCount);
        
        }
        const {errors} = getErrorAndWarningCount(`${subDir}/result.json`);
        return calcCorrectnessScore(errors,fileCount);
        

    } catch (error) {
        //console.error(`Failed to get lint output for ${username}/${repo}: ${error}`);
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to get lint output for ${username}/${repo}\n`, (err)=>{});
        }
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
            if (logLevel == 2) {
                fs.appendFile(logFilePath, `No issues found for ${username}/${repo}\n`, (err)=>{});
            }
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
        if(logLevel == 2){
            fs.appendFile(logFilePath, `Failed to get issues for ${username}/${repo}\n`, (err)=>{});
        }
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
    createLintDirs,
    fetchRepoContributors,
    fetchRepoLicense,
    fetchRepoReadme,
    fetchLintOutput,
    fetchRepoIssues,
    fetchRepoInfo,
    fetchRepoPinning,
    fetchRepoPullRequest
}