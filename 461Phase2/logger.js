"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.time = exports.logger = exports.getLogger = void 0;
var winston = require('winston'); //Logging library
var dotenv = require("dotenv");
dotenv.config();
var logLevels = {
    0: 'silent',
    1: 'info',
    2: 'debug',
};
var timezone = 'America/New_York';
function getLogLevel() {
    var logLevel = Number(process.env.LOG_LEVEL);
    if (!logLevel) {
        // Default log level is 0
        return logLevels[0];
    }
    else if (logLevel > 2) {
        // Just for convenience, instead of panicking
        return logLevels[2];
    }
    else if (logLevel < 0) {
        // Also just for convenience, instead of panicking
        return logLevels[0];
    }
    return logLevels[logLevel];
}
function getLogPath() {
    var logPath = process.env.LOG_FILE;
    if (!logPath) {
        var error = new Error("Could not find LOG_FILE path, please make sure it is valid");
        console.error("Error: ".concat(error));
        throw error;
    }
    return logPath;
}
function getLogger() {
    var logLevel = getLogLevel();
    var logPath = getLogPath();
    var logger = winston.createLogger({
        level: logLevel,
        format: winston.format.printf(function (_a) {
            var level = _a.level, message = _a.message;
            return "[".concat(level, "]: ").concat(message);
        }),
        transports: [
            new winston.transports.File({ filename: logPath, level: logLevel }), // Actual log file
        ],
    });
    return logger;
}
exports.getLogger = getLogger;
function getTimestampLogger() {
    var logPath = getLogPath();
    var logLevel = getLogLevel();
    var time_logger = winston.createLogger({
        level: logLevel,
        format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss', tz: timezone }), winston.format.printf(function (_a) {
            var message = _a.message, timestamp = _a.timestamp;
            return "[time]: ".concat(timestamp, " -- ").concat(message);
        })),
        transports: [
            new winston.transports.File({ filename: logPath, level: logLevel }), // Actual log file
        ],
    });
    return time_logger;
}
exports.logger = getLogger();
exports.time = getTimestampLogger();
