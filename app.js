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
exports.app = void 0;
var express_1 = require("express");
var multer_1 = require("multer");
var aws_sdk_1 = require("aws-sdk");
var jest_aws_sdk_mock_1 = require("jest-aws-sdk-mock");
var logger_1 = require("./461Phase2/logger");
var rds_configurator = require("./461Phase2/rds_config");
var rds_handler = require("./461Phase2/rds_packages");
var s3_packages_1 = require("./461Phase2/s3_packages");
var app = (0, express_1.default)();
exports.app = app;
var port = 3001;
var upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
var s3 = new aws_sdk_1.default.S3({
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_KEY',
}); //aws setup
// Mock the AWS S3 services
jest_aws_sdk_mock_1.AWSMock.setSDKInstance(aws_sdk_1.default);
// Mock S3 upload
jest_aws_sdk_mock_1.AWSMock.mock('S3', 'upload', function (params, callback) {
    // Define your mock behavior for S3 upload here
    callback(null, { Location: 'mocked-s3-location' });
});
// Mock S3 getObject
jest_aws_sdk_mock_1.AWSMock.mock('S3', 'getObject', function (params, callback) {
    // Define your mock behavior for S3 getObject here
    var rateData = { rate: 10 };
    var response = {
        Body: JSON.stringify(rateData),
    };
    callback(null, response);
});
app.post('/upload', upload.single('file'), function (req, res) {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }
        if (!req.file.originalname.endsWith('.zip')) {
            return res.status(400).send('Invalid file format. Please upload a zip file.');
        }
        var params = {
            Bucket: 'your-s3-bucket-name',
            Key: req.file.originalname,
            Body: req.file.buffer,
        }; //aws s3 parameters
        s3.upload(params, function (err, data) {
            if (err) {
                console.error('S3 upload error:', err);
                return res.status(500).send('An error occurred while uploading the file.');
            }
            console.log('File uploaded to S3:', data.Location);
            res.status(200).send('File uploaded successfully!');
        });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred.');
    }
});
app.get('/rate/:packageId', function (req, res) {
    try {
        var packageId = req.params.packageId;
        //S3 getObject parameters
        var s3Params = {
            Bucket: 'your-s3-bucket-name',
            Key: packageId + '.json', //assuming each rate data is stored as a JSON object
        };
        s3.getObject(s3Params, function (err, data) {
            var _a;
            if (err) {
                console.error('S3 getObject error:', err);
                return res.status(500).send('An error occurred while fetching the rate data.');
            }
            // Parse the rate data from the response
            var rateData = JSON.parse(((_a = data.Body) === null || _a === void 0 ? void 0 : _a.toString()) || '');
            if (!rateData || !rateData.rate) {
                return res.status(404).send('Rate data not found.');
            }
            res.status(200).json(rateData);
        });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred.');
    }
});
app.get('/download/:packageId', function (req, res) {
    try {
        var packageId = req.params.packageId;
        var s3Params = {
            Bucket: 'your-s3-bucket-name',
            Key: packageId + '.json',
        };
        s3.getObject(s3Params)
            .createReadStream()
            .pipe(res); //send package directly
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred.');
    }
});
app.get('/packages', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var s3Params, s3Objects, packages, page, perPage, startIndex, endIndex, paginatedPackages, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                s3Params = {
                    Bucket: 'your-s3-bucket-name',
                    Prefix: '',
                };
                return [4 /*yield*/, s3.listObjectsV2(s3Params).promise()];
            case 1:
                s3Objects = _a.sent();
                packages = s3Objects.Contents.map(function (object) { return object.Key; });
                page = req.query.page || 1;
                perPage = req.query.perPage || 10;
                startIndex = (page - 1) * perPage;
                endIndex = page * perPage;
                paginatedPackages = packages.slice(startIndex, endIndex);
                res.status(200).json(paginatedPackages);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Error:', error_1);
                res.status(500).send('An error occurred.');
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Sends the a list of package names that match the regex
app.get('/search', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var searchString, searchResults, package_names, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                searchString = req.query.q;
                if (!searchString) {
                    return [2 /*return*/, res.status(400).send('Search string is required.')];
                }
                return [4 /*yield*/, rds_handler.match_rds_rows(searchString)];
            case 1:
                searchResults = _a.sent();
                package_names = searchResults.map(function (data) { return data.package_name; });
                logger_1.logger.info("Successfully searched packages");
                res.status(200).json(package_names);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                logger_1.logger.error('Error:', error_2);
                res.status(500).send('An error occurred.');
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Resets RDS and S3
app.post('/reset', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                // const s3Params = {
                //   Bucket: 'your-s3-bucket-name',
                // };
                // s3.listObjectsV2(s3Params, (err, data) => {
                //   if (err) {
                //     console.error('Error listing objects:', err);
                //     return res.status(500).send('An error occurred while listing objects.');
                //   }
                //   if (data.Contents.length === 0) {
                //     return res.status(200).send('Registry is already empty.');
                //   }
                //   const deleteErrors = [];
                //   data.Contents.forEach((object) => {
                //     s3.deleteObject({ Bucket: 'your-s3-bucket-name', Key: object.Key }, (err) => {
                //       if (err) {
                //         console.error('Error deleting object:', err);
                //         deleteErrors.push(err.message);
                //       }
                //     });
                //   });
                //   if (deleteErrors.length > 0) {
                //     return res.status(500).json({
                //       message: 'Registry reset with errors',
                //       errors: deleteErrors,
                //     });
                //   }
                //   res.status(200).send('Registry reset to default state.');
                // });
                return [4 /*yield*/, (0, s3_packages_1.clear_s3_bucket)()];
            case 1:
                // const s3Params = {
                //   Bucket: 'your-s3-bucket-name',
                // };
                // s3.listObjectsV2(s3Params, (err, data) => {
                //   if (err) {
                //     console.error('Error listing objects:', err);
                //     return res.status(500).send('An error occurred while listing objects.');
                //   }
                //   if (data.Contents.length === 0) {
                //     return res.status(200).send('Registry is already empty.');
                //   }
                //   const deleteErrors = [];
                //   data.Contents.forEach((object) => {
                //     s3.deleteObject({ Bucket: 'your-s3-bucket-name', Key: object.Key }, (err) => {
                //       if (err) {
                //         console.error('Error deleting object:', err);
                //         deleteErrors.push(err.message);
                //       }
                //     });
                //   });
                //   if (deleteErrors.length > 0) {
                //     return res.status(500).json({
                //       message: 'Registry reset with errors',
                //       errors: deleteErrors,
                //     });
                //   }
                //   res.status(200).send('Registry reset to default state.');
                // });
                _a.sent();
                return [4 /*yield*/, rds_configurator.drop_package_data_table()];
            case 2:
                _a.sent();
                return [4 /*yield*/, rds_configurator.setup_rds_tables()];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_3 = _a.sent();
                logger_1.logger.error('Error clearing databases:', error_3);
                res.status(500).send('An error occurred while resetting the registry.');
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
app.listen(port, function () {
    console.log("Server is running on port ".concat(port));
});
