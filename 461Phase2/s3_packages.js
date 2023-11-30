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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.clear_s3_bucket = exports.download_package = exports.upload_package = void 0;
var AWS = require("aws-sdk");
var dotenv = require("dotenv");
var logger_1 = require("./logger");
dotenv.config();
var access_id = String(process.env.S3_ACCESS_ID);
var access_key = String(process.env.S3_ACCESS_KEY);
var region = String(process.env.S3_REGION);
// Set your AWS credentials and region
AWS.config.update({
    accessKeyId: access_id,
    secretAccessKey: access_key,
    region: region,
});
// Create an S3 instance
var s3 = new AWS.S3();
var BUCKET_NAME = "461s3bucketv2";
function upload_package(package_id, file) {
    return __awaiter(this, void 0, void 0, function () {
        var file_content, unique_filename, params, file_url, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    file_content = file.buffer;
                    unique_filename = "package_ID_".concat(package_id);
                    params = {
                        Bucket: BUCKET_NAME,
                        Key: unique_filename,
                        Body: file_content,
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, s3.upload(params).promise()];
                case 2:
                    _a.sent();
                    file_url = "https://".concat(BUCKET_NAME, ".s3.").concat(AWS.config.region, ".amazonaws.com/").concat(unique_filename);
                    logger_1.logger.debug("File uploaded successfully to S3. URL: ".concat(file_url));
                    return [2 /*return*/, file_url];
                case 3:
                    error_1 = _a.sent();
                    logger_1.logger.error('Error uploading file to S3:', error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.upload_package = upload_package;
function download_package(package_id) {
    return __awaiter(this, void 0, void 0, function () {
        var params, file, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    params = {
                        Bucket: BUCKET_NAME,
                        Key: "package_ID_".concat(package_id)
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, s3.getObject(params).promise()];
                case 2:
                    file = _a.sent();
                    logger_1.logger.debug("File downloaded successfully.");
                    return [2 /*return*/, file.Body];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error('Error downloading file from S3:', error_2);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.download_package = download_package;
function clear_s3_bucket() {
    return __awaiter(this, void 0, void 0, function () {
        var params, s3Objects, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    params = {
                        Bucket: BUCKET_NAME,
                        Delete: { Objects: [] }, // Initialize the Objects array
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, s3.listObjects(params).promise()];
                case 2:
                    s3Objects = _a.sent();
                    if (!(s3Objects.Contents && s3Objects.Contents.length > 0)) return [3 /*break*/, 4];
                    params.Delete.Objects = s3Objects.Contents.map(function (obj) { return ({ Key: obj.Key }); });
                    return [4 /*yield*/, s3.deleteObjects(params).promise()];
                case 3:
                    _a.sent();
                    logger_1.logger.debug('All S3 objects deleted successfully.');
                    return [3 /*break*/, 5];
                case 4:
                    logger_1.logger.debug('No S3 objects to delete!');
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_3 = _a.sent();
                    logger_1.logger.error('Error deleting S3 objects:', error_3);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.clear_s3_bucket = clear_s3_bucket;
