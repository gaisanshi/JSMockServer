# JSMockServer
A Mock Server by Phantom JS

http://phantomjs.org/

This Module will start a http server and bind with the given port. After that, it accept to config the request/response mapping with
  method 'when(request)' and 'response(response)'. If you want to re-config the mapping, method 'reset()' should be called to clear the exiting mapping.
  
  
  Request:
   {url: "url_pattern", method: "GET/POST/PUT/DELETE", data: "body_pattern"}
   
  Response:
   {status: "200/404/300/500/XXX", headers: {headers_key-value_pair}, responseTime: "the_expected_latency_in_millisecond",
       isTimeout: true_or_false_if_simulate_timeout, responseText: "the_static_response_text",
       responseFile: "path_to_file_which_have_the_response_content"
 
     Note: responseText will overwrite responseFile if both are defined.
 
 
  Usage:
  
      var mockServer = require('./mock_server.js').MockServer.start("9001");
      
      //mock a http GET which url match 'ajax_info_1', return 'Mock Response 1'
      mockServer
      .when({url: "ajax_call_1", method: "GET"})
      .response({status: 200, responseText: "Mock Response 1"});
 
      //mock a http GET which url match 'ajax_info_1', return the content of file './mytest.txt'
      mockServer
      .when({url: "ajax_call_2", method: "GET"})
      .response({status: 200, responseFile: "./mytest.txt"});
 
      //mock a http POST which url match 'ajax_info_2' and body match 'member_id=1', return 'Mock Response 2' in 5000 ms
      mockServer
      .when({url: "ajax_call_3", method: "POST"}, data: "member_id=1")
      .response({status: 200, responseTime: 5000, responseFile: "Mock Response 2"});
 
      //mock a http GET for a js 'dummy.js' loading, return a hardcode js "alert('this is alert');"
      mockServer
      .when({url: "dummy.js", method: "GET"})
      .response({status: 200, responseText: "alert('this is alert');", headers: {"Content-Type": "application/x-javascript"}});
 
      //reset all the request/response mapping
      mockServer
      .reset();
