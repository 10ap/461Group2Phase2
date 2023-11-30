"use strict";
//////////////////////////////////////////////////////////////////////
// now actual metric score calculations
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
exports.calcTotalScore = exports.outputResults = exports.get_metric_info = exports.calcRespMaintScore = exports.calcCorrectnessScore = exports.calcRampUpScore = exports.calcLicenseScore = exports.calcuBusFactor = void 0;
var main_1 = require("./main");
var fs = require("fs");
var metric_helpers_1 = require("./metric_helpers");
function calcuBusFactor(x) {
    var result = (Math.pow((Math.log(x + 1) / (Math.log(1500 + 1))), 1.22));
    //console.log(`Bus Factor: ${result}`);
    return result;
}
exports.calcuBusFactor = calcuBusFactor;
function calcRampUpScore(x) {
    var result = (1 - (Math.pow((Math.log(x + 1) / (Math.log(105906 + 1))), 1.22)));
    //console.log(`Ramp Up: ${result}`);
    return result;
}
exports.calcRampUpScore = calcRampUpScore;
function calcLicenseScore(licenseName) {
    var licenseScore = 0;
    var lowercaseLicense = licenseName.toLowerCase();
    if (lowercaseLicense.includes('apache') || lowercaseLicense.includes('mit') || lowercaseLicense.includes('gpl') || lowercaseLicense.includes('bsd')) {
        licenseScore = 1;
    }
    return licenseScore;
}
exports.calcLicenseScore = calcLicenseScore;
function calcCorrectnessScore(errors, filecount) {
    // lets get the errors/warnings per file
    // we really only care about errors
    var errorsPerFile = errors / filecount;
    var scaledError = 0;
    var correctnessScore = 0;
    if (errorsPerFile > 1 && errorsPerFile < 10) {
        scaledError = errorsPerFile / 10;
    }
    else if (errorsPerFile > 10 && errorsPerFile < 100) {
        scaledError = errorsPerFile / 100;
    }
    else if (errorsPerFile > 100) { // if we have 100 errors per file this is not good 
        scaledError = 1;
    }
    if (scaledError === 1) { // we got way too many errors per file, cannot be a good file
        correctnessScore = 0;
    }
    else {
        correctnessScore = (1 - (scaledError));
    }
    //console.log(`Correctness: ${correctnessScore}`);
    return correctnessScore;
}
exports.calcCorrectnessScore = calcCorrectnessScore;
function calcRespMaintScore(timeDifference, username, repo) {
    var sum = timeDifference.reduce(function (acc, value) { return acc + value; }, 0);
    var avg = sum / timeDifference.length;
    var maintainer = (1 - (avg / (86400000 * 30)));
    if (maintainer < 0) { // if average response is greater than a month 
        maintainer = 0;
    }
    else {
        maintainer = (1 - (avg / (86400000 * 30)));
    }
    //console.log(`Responsive Maintainer: ${maintainer}`);
    return maintainer;
}
exports.calcRespMaintScore = calcRespMaintScore;
function calcTotalScore(busFactor, rampup, license, correctness, maintainer, pullRequest, pinning) {
    return __awaiter(this, void 0, void 0, function () {
        var busWeight, rampupWeight, respMaintWeight, correctnessWeight, pinningWeight, pullRequestWeight, busScore, rampupScore, respMaintScore, correctnessScore, pinningScore, pullRequestScore, score;
        return __generator(this, function (_a) {
            busWeight = 0.10;
            rampupWeight = 0.10;
            respMaintWeight = 0.30;
            correctnessWeight = 0.30;
            pinningWeight = 0.10;
            pullRequestWeight = 0.10;
            busScore = busFactor * busWeight;
            rampupScore = rampup * rampupWeight;
            respMaintScore = maintainer * respMaintWeight;
            correctnessScore = correctness * correctnessWeight;
            pinningScore = pinning * pinningWeight;
            pullRequestScore = pullRequest * pullRequestWeight;
            score = license * (busScore + rampupScore + respMaintScore + correctnessScore + pinningScore + pullRequestScore);
            //console.log(`Total Score: ${score.toFixed(5)}`); // can allow more or less decimal, five for now
            return [2 /*return*/, score];
        });
    });
}
exports.calcTotalScore = calcTotalScore;
function get_metric_info(gitDetails) {
    return __awaiter(this, void 0, void 0, function () {
        var i, gitInfo, busFactor, license, rampup, correctness, maintainer, pinning, pullRequest, score, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < gitDetails.length)) return [3 /*break*/, 14];
                    gitInfo = gitDetails[i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 12, , 13]);
                    //console.log(`Getting Metric info for ${gitInfo.username}/${gitInfo.repo}`);
                    //await fetchRepoInfo(gitInfo.username, gitInfo.repo);
                    return [4 /*yield*/, (0, metric_helpers_1.createLintDirs)(gitInfo.username, gitInfo.repo)];
                case 3:
                    //console.log(`Getting Metric info for ${gitInfo.username}/${gitInfo.repo}`);
                    //await fetchRepoInfo(gitInfo.username, gitInfo.repo);
                    _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchRepoContributors)(gitInfo.username, gitInfo.repo)];
                case 4:
                    busFactor = _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchRepoLicense)(gitInfo.username, gitInfo.repo)];
                case 5:
                    license = _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchRepoReadme)(gitInfo.username, gitInfo.repo)];
                case 6:
                    rampup = _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchLintOutput)(gitInfo.username, gitInfo.repo)];
                case 7:
                    correctness = _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchRepoIssues)(gitInfo.username, gitInfo.repo)];
                case 8:
                    maintainer = _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchRepoPinning)(gitInfo.username, gitInfo.repo)];
                case 9:
                    pinning = _a.sent();
                    return [4 /*yield*/, (0, metric_helpers_1.fetchRepoPullRequest)(gitInfo.username, gitInfo.repo)];
                case 10:
                    pullRequest = _a.sent();
                    console.log(pullRequest);
                    return [4 /*yield*/, calcTotalScore(busFactor, rampup, license, correctness, maintainer, pullRequest, pinning)];
                case 11:
                    score = _a.sent();
                    outputResults(gitInfo.username, gitInfo.repo, busFactor, rampup, license, correctness, maintainer, pinning, pullRequest, score);
                    return [3 /*break*/, 13];
                case 12:
                    error_1 = _a.sent();
                    //console.error(`Failed to get Metric info for ${gitInfo.username}/${gitInfo.repo}`);
                    if (main_1.logLevel == 2) {
                        fs.appendFile(main_1.logFilePath, "Failed to get Metric info for ".concat(gitInfo.username, "/").concat(gitInfo.repo, "\n"), function (err) { });
                    }
                    return [3 /*break*/, 13];
                case 13:
                    i++;
                    return [3 /*break*/, 1];
                case 14: return [2 /*return*/];
            }
        });
    });
}
exports.get_metric_info = get_metric_info;
function outputResults(username, repo, busFactor, rampup, license, correctness, maintainer, pinning, pullRequest, score) {
    return __awaiter(this, void 0, void 0, function () {
        var url, repoData, ndJsonpath;
        return __generator(this, function (_a) {
            url = "https://github.com/".concat(username, "/").concat(repo);
            repoData = {
                URL: url,
                NET_SCORE: parseFloat(score.toFixed(5)),
                RAMP_UP_SCORE: parseFloat(rampup.toFixed(5)),
                CORRECTNESS_SCORE: parseFloat(correctness.toFixed(5)),
                BUS_FACTOR_SCORE: parseFloat(busFactor.toFixed(5)),
                LICENSE_SCORE: license,
                GOOD_PINNING_PRACTICE: parseFloat(pinning.toFixed(5)),
                PULL_REQUEST: parseFloat(pullRequest.toFixed(5)),
                RESPONSIVE_MAINTAINER_SCORE: parseFloat(maintainer.toFixed(5))
            };
            console.log(JSON.stringify(repoData));
            ndJsonpath = "./results.ndjson";
            fs.appendFileSync(ndJsonpath, JSON.stringify(repoData) + "\n");
            if (main_1.logLevel >= 1) {
                fs.appendFileSync(main_1.logFilePath, JSON.stringify(repoData) + "\n");
            }
            return [2 /*return*/];
        });
    });
}
exports.outputResults = outputResults;
