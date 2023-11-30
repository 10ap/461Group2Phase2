"use strict";
// this section will take in the urls.txt arguement from the command line and parse it for npm package names and github user/repo names
exports.__esModule = true;
exports.get_npm_package_name = exports.url_list = exports.get_github_info = void 0;
var fs = require("fs");
var main_1 = require("./main");
var npmRegex = /https:\/\/www\.npmjs\.com\/package\/([\w-]+)/i; // regex to get package name from npm url
var gitRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)/i; // regex to get user/repo name  from git url
// read urls from file
// returns array of urls
var url_list = function (filename) {
    try {
        return fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean);
    }
    catch (error) {
        //console.error(`File does not exist`);
        if (main_1.logLevel == 2) {
            fs.appendFile(main_1.logFilePath, "URL file does not exist.\n", function (err) { });
        }
        process.exit(1);
    }
};
exports.url_list = url_list;
/*
 gets npm package names
 returns package name
 npm package names are found in the url after /package/
 example: https://www.npmjs.com/package/express
*/
var get_npm_package_name = function (npmUrl) {
    var npm_match = npmUrl.match(npmRegex);
    if (npm_match) { // if url is found with proper regex (package identifier)
        return npm_match[1]; // return this package name
    }
    return null;
};
exports.get_npm_package_name = get_npm_package_name;
/*
 gets github username and repo
 returns object with username and repo
 example: https://github.com/nullivex/nodist
*/
var get_github_info = function (gitUrl) {
    var gitMatch = gitUrl.match(gitRegex);
    if (gitMatch) {
        return {
            username: gitMatch[1],
            repo: gitMatch[2]
        };
    }
    return null;
};
exports.get_github_info = get_github_info;
