"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const errors_test_1 = require("./suites/errors.test");
const class_test_1 = require("./suites/class.test");
const expressServer_test_1 = require("./suites/expressServer.test");
const express_cookie_simple_test_1 = require("./suites/express.cookie.simple.test");
mocha_1.describe('Class CryptoCookie', class_test_1.default.bind(this));
mocha_1.describe('Test Errors...', errors_test_1.default.bind(this));
mocha_1.describe('Express cookie override', expressServer_test_1.default.bind(this));
mocha_1.describe('Express response res.cookie method and res.cookie_async method', express_cookie_simple_test_1.default.bind(this));
