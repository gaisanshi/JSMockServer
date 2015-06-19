/**
 * Copyright [2015] [Gary Gai]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *
 *
 * Generic Mock Server by Phantom JS
 *
 * This Module will start a http server and bind with the given port. After that, it accept to config the request/response mapping with
 *  method 'when(request)' and 'response(response)'. If you want to re-config the mapping, method 'reset()' should be called to clear the exiting mapping,
 *  and call 'when' and 'response' with your config.
 *
 * Request:
 *  {url: "url_pattern", method: "GET/POST/PUT/DELETE", data: "body_pattern"}
 *
 *
 * Response:
 *  {status: "200/404/300/500/XXX", headers: {headers_key-value_pair}, responseTime: "the_expected_latency_in_millisecond",
 *      isTimeout: true_or_false_if_simulate_timeout, responseText: "the_static_response_text",
 *      responseFile: "path_to_file_which_have_the_response_content"
 *
 *    Note: responseText will overwrite responseFile if both are defined.
 *
 *
 * Usage:
 *
 * var mockServer = require('./mock_server.js').MockServer.start("9001");
 *      //mock a http GET which url match 'ajax_info_1', return 'Mock Response 1'
 *      .when({url: "ajax_info_1", method: "GET"})
 *      .response({status: 200, responseText: "Mock Response 1"})
 *
 *      //mock a http GET which url match 'ajax_info_1', return the content of file './mytest.txt'
 *      .when({url: "ajax_info_1", method: "GET"})
 *      .response({status: 200, responseFile: "./mytest.txt"})
 *
 *      //mock a http POST which url match 'ajax_info_2' and body match 'member_id=1', return 'Mock Response 2' in 5000 ms
 *      .when({url: "ajax_info_2", method: "POST"}, data: "member_id=1")
 *      .response({status: 200, responseTime: 5000, responseFile: "Mock Response 2"})
 *
 *      //mock a http GET for a js 'dummy.js' loading, return a hardcode js "alert('this is alert');"
 *      .when({url: "dummy.js", method: "GET"})
 *      .response({status: 200, responseText: "alert('this is alert');", headers: {"Content-Type": "application/x-javascript"}})
 *
 *      //reset all the request/response mapping
 *      .reset()
 */

exports.MockServer = (function () {
    'use strict';

    var isCasperInUsed = function() {
        return (typeof casper !== "undefined" && casper !== null && casper.constructor.name === "Casper");
    };


    var server = require('webserver').create();

    var mockServer = {};

    var _mapping = [];
    var _port = 0;
    var _isServerUp = false;
    var _currentReq = {};
    var _existingOnResourceRequested = isCasperInUsed() ? casper.options.onResourceRequested : {};


    /**
     * Start a http server and bind with the given port
     *
     * @param port - The server port number
     * @returns mockServer
     */
    var start = function (port) {
        _port = port;
        if (_isServerUp) {
            formatPrint("Mock Server has started already, no need to restart");
            reset();
            return mockServer;
        }

        /**
         * Add the request pattern the onResourceRequested event
         */
        addToResourceRequestedEvent();

        var result = server.listen(_port, function (request, response) {
            //console.log("GOT HTTP REQUEST");
            //console.log(JSON.stringify(request, null, 4));

            if (Object.keys(_currentReq).length !== 0) {
                formatPrint("You have .when() been called, but NO .response() following to define the expected response.");
            }
            var isMatched = false;
            for (var i = 0; i < _mapping.length && !isMatched; i++) {
                var expReq = _mapping[i].request;
                var expResp = _mapping[i].response;

                if (
                    (!expReq.method || expReq.method.toUpperCase() === request.method)  //The HTTP Method
                    && (!expReq.url || request.url.indexOf(expReq.url) >= 0 || new RegExp(expReq.url).test(request.url)) //The url include the parameters
                    && (!expReq.data || (request.post && JSON.stringify(request.post).indexOf(expReq.data) >= 0) || (request.post && new RegExp(expReq.data).test(JSON.stringify(request.post)))) //The http body, for POST/PUT only
                ) {
                    //found a match, and going to build the response.
                    isMatched = true;

                    console.log(request.url + " is matched with " + JSON.stringify(expReq));

                    var status = expResp.status || 200;
                    var headers = expResp.headers || {};
                    response.statusCode = status;
                    response.headers = headers;

                    if (expResp.isTimeout === true || (isString(expResp.isTimeout) && expResp.isTimeout.toLowerCase() === "true")) {
                        //this is timeout block, no return happen
                        formatPrint("Simulate a timeout for " + request.url);
                    } else {
                        var timeout = expResp.responseTime;
                        if (!isNumber(timeout)) {
                            timeout = 0;
                        }

                        var responseText = expResp.responseText;
                        if (!isString(responseText) && expResp.responseFile) {
                            try {
                                var fs = require('fs');
                                responseText = fs.read(expResp.responseFile);
                            } catch (err) {
                                formatPrint(err);
                            }
                        }

                        if (!isString(responseText)) {
                            responseText = "";
                        }

                        setTimeout(function () {
                            response.write(responseText);
                            response.close();
                            console.log(request.url + " is served in " + timeout + " ms: [status: " + status + "][response: " + responseText + "][headers: " + JSON.stringify(headers) + "]");
                        }, timeout);

                    }


                }
            }

            //No match found, return 404
            if (!isMatched) {
                formatPrint(request.url + ": NO match found");
                response.statusCode = 404;
                response.close();
            }

        });


        var statusLog = function (isUp) {
            if (!isUp) {
                formatPrint("Mock Server is NOT started successfully");
            } else {
                console.log("Mock Server is up");
            }
        };

        _isServerUp = result;
        statusLog(result);

        return mockServer;
    };

    /**
     * Close the mock server
     *
     * @returns mockServer
     */
    var close = function () {
        //TODO: Phantom JS has not implemented this method
        reset();
        return mockServer;
    };

    /**
     * Config the request object
     *
     * @param req  - the request object
     * @returns mockServer
     */
    var when = function (req) {
        if (req.data) {
            req.data = req.data.replace(/\"/g, "\\\"");
        }
        _currentReq = req;
        return mockServer;
    };

    /**
     * Config the response object
     *
     * @param resp  - the response object
     * @returns mockServer
     */
    var response = function (resp) {
        if (Object.keys(_currentReq).length === 0) {
            formatPrint("Please call .when() to set the request pattern first");
        } else {
            _mapping.push({
                "request": _currentReq,
                "response": resp
            });
            addToResourceRequestedEvent();
            _currentReq = {};
        }

        return mockServer;
    };


    /**
     * Clear the existing request/response mapping
     *
     * @returns mockServer
     */
    var reset = function () {
        _mapping.length = 0;
        _currentReq = {};
        if (isCasperInUsed()) {
            casper.options.onResourceRequested = _existingOnResourceRequested;
        }
        return mockServer;
    };

    /**
     * Add request mapping to the onResourceRequested
     *
     * @returns mockServer
     */
    var addToResourceRequestedEvent = function () {

        //validation
        if (_mapping.length === 0 || _port === '0' || _port === 0) {
            return mockServer;
        }

        //if casper is not been used.
        if (!isCasperInUsed()) {
            return mockServer;
        }

        //config the casper js onResourceRequested event filter
        casper.options.onResourceRequested = function (casper, requestData, request) {
            if (_existingOnResourceRequested && typeof(_existingOnResourceRequested) === "function") {
                _existingOnResourceRequested(casper, requestData, request);
            }

            for (var i = 0; i < _mapping.length; i++) {
                var expReq = _mapping[i].request;

                if (
                    (!expReq.method || expReq.method.toUpperCase() === requestData.method)  //The HTTP Method
                    && (!expReq.url || requestData.url.indexOf(expReq.url) >= 0 || new RegExp(expReq.url).test(requestData.url)) //The url include the parameters
                    && (!expReq.data || requestData.postData.indexOf(expReq.data) >= 0 || new RegExp(expReq.data).test(requestData.postData)) //The http body, for POST/PUT only
                ) {

                    var getLocation = function (href) {
                        var l = document.createElement("a");
                        l.href = href;
                        return l;
                    };

                    var location = getLocation(requestData.url);
                    location.host = "127.0.0.1";
                    location.port = _port;

                    console.log("Redirect the call to the mock server: '" + requestData.url + "' -> '" + location.href + "'");
                    request.changeUrl(location.href);
                }
            }
        };


        return mockServer;

    };

    /**
     * Is server running?
     *
     * @returns {boolean}
     */
    var isServerUp = function () {
        return _isServerUp;
    };

    var isString = function(myVar) {
        return (typeof myVar === 'string' || myVar instanceof String);
    };

    var isNumber = function(myVar) {
        return (typeof myVar === 'number' || myVar instanceof Number);
    };

    /**
     * Print out the message to console
     *
     * @param msg
     */
    var formatPrint = function (msg) {
        console.log(
            "#####################################################\n" +
            msg + "\n" +
            "#####################################################"
        );

    };

    if (!mockServer.hasOwnProperty("start")) {
        mockServer.start = start;
        mockServer.when = when;
        mockServer.response = response;
        mockServer.reset = reset;
        mockServer.isServerUp = isServerUp;
    }

    return mockServer;
}());
