"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.readJSON = exports.check_npm_for_open_source = exports.ensureDirectoryExistence = exports.runEslint = exports.logFilePath = exports.logLevel = exports.octokit = void 0;
var octokit_1 = require("octokit"); // Octokit v17
var fs = require("fs"); // use filesystem
var child_process_1 = require("child_process"); // to execute shell cmds
var dotenv = require("dotenv");
var exec = require('child_process').exec; // to execute shell cmds async version
var metrics_1 = require("./metrics");
var urls_parse_1 = require("./urls_parse");
var arg = process.argv[2]; // this is the url(s).txt arguement passed to the js executable
var npmPkgName = []; // setup array for package names
var gitDetails = []; // setup array for git user/repo name 
var gitUrls = []; // setup array for git urls
dotenv.config();
// Env variables
var gitHubToken = String(process.env.GITHUB_TOKEN);
var logLevel = Number(process.env.LOG_LEVEL);
exports.logLevel = logLevel;
var logFilePath = String(process.env.LOG_FILE);
exports.logFilePath = logFilePath;
if (!gitHubToken || !logLevel || !logFilePath) {
    console.error("Error: environment variables not set...\n", gitHubToken, logLevel, logFilePath);
    console.log("gitHubToken:", gitHubToken);
    console.log("logLevel:", logLevel);
    console.log("logFilePath:", logFilePath);
    process.exit(1);
}
function ensureDirectoryExistence(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}
exports.ensureDirectoryExistence = ensureDirectoryExistence;
// if we get here, we know the token is valid
// octokit setup
var octokit = new octokit_1.Octokit({
    auth: gitHubToken,
    userAgent: 'pkg-manager/v1.0.0'
});
exports.octokit = octokit;
// run es lint
function runEslint(directory) {
    return new Promise(function (resolve, reject) {
        exec("npx eslint ".concat(directory, " -o ").concat(directory, "/result.json"), { encoding: 'utf8' }, function (error, stdout, stderr) {
            if (error) {
                // Check if the error is due to linting issues
                if (error.code === 1) {
                    resolve(stdout); // if error is due to linting, it's not a "real" error for us
                }
                else {
                    reject(error);
                }
            }
            else {
                resolve(stdout);
            }
        });
    });
}
exports.runEslint = runEslint;
////////////////////////////////////////////////////////////////////////////////
// now we want to get the package.json file from the npm package name and the github repo/username
// npmPkgName and gitDetails are the arrays we will use to get the package.json files, they hold:
// the package names and github user/repo names
var readJSON = function (jsonPath, callback) {
    fs.readFile(jsonPath, 'utf-8', function (err, data) {
        if (err) {
            //console.error('Error reading file:', err);
            if (logLevel == 2) {
                fs.appendFile(logFilePath, "Error reading file: ".concat(err, "\n"), function (err) { });
            }
            callback(null); // Pass null to the callback to indicate an error
            return;
        }
        try {
            var jsonData = JSON.parse(data);
            callback(jsonData); // Pass the parsed JSON data to the callback
        }
        catch (parseError) {
            //console.error('Error parsing JSON:', parseError);
            if (logLevel == 2) {
                fs.appendFile(logFilePath, "Error parsing JSON: ".concat(parseError, "\n"), function (err) { });
            }
            callback(null); // Pass null to the callback to indicate an error
        }
    });
};
exports.readJSON = readJSON;
function check_npm_for_open_source(filePath) {
    return new Promise(function (resolve) {
        readJSON(filePath, function (jsonData) {
            if (jsonData !== null) {
                var repository = jsonData.repository;
                if (repository.type == 'git') {
                    var gitUrl = repository.url;
                    if (gitUrl.startsWith('git+ssh://git@')) {
                        // Convert SSH URL to HTTPS URL
                        gitUrl = gitUrl.replace('git+ssh://git@', 'https://');
                    }
                    else if (gitUrl.startsWith('git+https://')) {
                        gitUrl = gitUrl.replace('git+https://', 'https://');
                    }
                    if (gitUrl.endsWith('.git')) {
                        gitUrl = gitUrl.substring(0, gitUrl.length - 4);
                    }
                    //return github url
                    gitUrls.push(gitUrl);
                    resolve(gitUrl);
                }
                else {
                    //console.error('No git repository found.');
                    if (logLevel == 2) {
                        fs.appendFile(logFilePath, "No git repository found.\n", function (err) { });
                    }
                    resolve("Invalid");
                }
            }
            else {
                //console.error('Failed to read or parse JSON.');
                if (logLevel == 2) {
                    fs.appendFile(logFilePath, "Failed to read or parse JSON.\n", function (err) { });
                }
                resolve(null);
            }
        });
    });
}
exports.check_npm_for_open_source = check_npm_for_open_source;
function get_npm_package_json(pkgName) {
    return __awaiter(this, void 0, void 0, function () {
        var i, pkg, output, file, gitURLfromNPM, gitInfo, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < pkgName.length)) return [3 /*break*/, 6];
                    pkg = pkgName[i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    output = (0, child_process_1.execSync)("npm view ".concat(pkg, " --json --silent"), { encoding: 'utf8' });
                    fs.writeFileSync("./temp_npm_json/".concat(pkg, "_info.json"), output); // write json to file
                    file = "./temp_npm_json/".concat(pkg, "_info.json");
                    return [4 /*yield*/, check_npm_for_open_source(file)];
                case 3:
                    gitURLfromNPM = _a.sent();
                    if (gitURLfromNPM) {
                        gitInfo = (0, urls_parse_1.get_github_info)(gitURLfromNPM);
                        if (gitInfo) {
                            gitDetails.push(gitInfo); // push to github details array
                        }
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    //console.error(`Failed to get npm info for package: ${pkg}`);
                    if (logLevel == 2) {
                        fs.appendFile(logFilePath, "Failed to get npm info for package: ".concat(pkg, "\n"), function (err) { });
                    }
                    return [3 /*break*/, 5];
                case 5:
                    i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
//////////////////////////////////////////////////////////////////////
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var delay, filename, urls;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (fs.existsSync(logFilePath)) {
                        fs.unlinkSync(logFilePath); // delete log file
                    }
                    ensureDirectoryExistence('./temp_linter_test'); // make temp directory for linter test files
                    ensureDirectoryExistence('./temp_npm_json'); // make temp directory for npm json files
                    delay = function (ms) { return new Promise(function (res) { return setTimeout(res, ms); }); };
                    return [4 /*yield*/, delay(1000)];
                case 1:
                    _a.sent(); // wait 1 second
                    if (!/\.txt$/.test(arg)) return [3 /*break*/, 4];
                    filename = arg;
                    urls = (0, urls_parse_1.url_list)(filename);
                    if (urls.length === 0) {
                        //console.error("No URLS found");
                        if (logLevel == 2) {
                            fs.appendFile(logFilePath, "No URLS found\n", function (err) { });
                        }
                        process.exit(0);
                    }
                    urls.forEach(function (url) {
                        var npmPackageName = (0, urls_parse_1.get_npm_package_name)(url); // get package name 
                        var gitInfo = (0, urls_parse_1.get_github_info)(url); // get github info
                        if (npmPackageName) { // since they return the package name or null, we can check for null
                            npmPkgName.push(npmPackageName); // push to package name array
                        }
                        else if (gitInfo) {
                            gitDetails.push(gitInfo); // push to github details array
                        }
                        else {
                            //console.error(`Error, invalid url: ${url}`); // non git or npm url
                            if (logLevel == 2) {
                                fs.appendFile(logFilePath, "Error, invalid url: ".concat(url, "\n"), function (err) { });
                            }
                        }
                    });
                    return [4 /*yield*/, get_npm_package_json(npmPkgName)];
                case 2:
                    _a.sent();
                    try {
                        (0, child_process_1.execSync)("curl -f -H \"Authorization: token ".concat(gitHubToken, "\" https://api.github.com/user/repos 2>/dev/null"));
                    }
                    catch (error) {
                        console.error("Invalid GitHub token: ".concat(gitHubToken));
                        if (logLevel == 2) {
                            fs.appendFile(logFilePath, "Invalid GitHub token: ".concat(gitHubToken, "\n"), function (err) { });
                        }
                    }
                    return [4 /*yield*/, (0, metrics_1.get_metric_info)(gitDetails)];
                case 3:
                    _a.sent();
                    fs.rmdirSync('./temp_linter_test', { recursive: true });
                    fs.rmdirSync('./temp_npm_json', { recursive: true });
                    process.exit(0);
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
main();
// https://github.com/Purdue-ECE-461/is-sorted
