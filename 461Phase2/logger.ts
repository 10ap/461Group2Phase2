const winston = require('winston'); //Logging library
import * as dotenv from 'dotenv';

dotenv.config();

const logLevels: { [key: number]: string }= {
    0: 'silent',
    1: 'info',
    2: 'debug',
}

const timezone = 'America/New_York'

function getLogLevel() {
    const logLevel = Number(process.env.LOG_LEVEL);
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
    const logPath = process.env.LOG_FILE;
    if (!logPath) {
        const error = new Error("Could not find LOG_FILE path, please make sure it is valid");
        console.error(`Error: ${error}`);
        throw error;
    }

    return logPath;
}

export function getLogger() {
    const logLevel = getLogLevel();
    const logPath = getLogPath();
    
    const logger = winston.createLogger({
        level: logLevel,
        format: winston.format.printf(({ level, message }: { level: string; message: string }) => {
            return `[${level}]: ${message}`;
        }),
        transports: [
          new winston.transports.File({ filename: logPath, level: logLevel }),   // Actual log file
        ],
      });

    return logger;
}

function getTimestampLogger() {
    const logPath = getLogPath();
    const logLevel = getLogLevel();

    const time_logger = winston.createLogger({
        level: logLevel,
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss', tz: timezone }),
            winston.format.printf(({ message, timestamp }: { message: string; timestamp: string }) => {
                return `[time]: ${timestamp} -- ${message}`;
            }),
        ),
        transports: [
            new winston.transports.File({ filename: logPath, level: logLevel }),   // Actual log file
          ],
    });

    return time_logger
}

export const logger = getLogger();
export const time = getTimestampLogger();

