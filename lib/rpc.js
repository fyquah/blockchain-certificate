var rpc = require('node-json-rpc');

var options = {
    // int port of rpc server, default 5080 for http or 5433 for https
    port: 9339,
    // string domain name or ip of rpc server, default '127.0.0.1'
    host: '127.0.0.1',
    // string with default path, default '/'
    path: '/',
    // boolean false to turn rpc checks off, default true
    strict: true
};

var inspect_parameters_count  = function(count, params){
    if(params.length === count) {
        return null;
    } else {
        return { "message": "expected " + count + " parameter(s)" }
    }
};

// Create a server object with options
var server = new rpc.Server(options);

// query methods
server.addMethod("listrights", function(params, cb){
    var error = inspect_parameters_count(0, params);
    if(error) {
        cb(error, null);
        return;
    }

    controller.query({
        "method": "listrights"
    }, cb);
});

server.addMethod("listnodes", function(params, cb){
   var error = inspect_parameters_count(0, params);
    if(error) {
        cb(error, null);
        return;
    }

    controller.query({
        "method": "listnodes"
    }, cb);
});

server.addMethod("listusers", function(params, cb){
    var error = inspect_parameters_count(1, params);
    if(error) {
        cb(error, null);
        return;
    }

    controller.query({
        "method": "listusers", 
        "metadata": params[0]
    }, cb)
});


server.addMethod("verifysignature", function(params, cb){
    var error = inspect_parameters_count(5, params);
    if(error){
        cb(error, null);
        return;
    }

    controller.query({
        "method": "verifysignature",
        "metadata": params[0],
        "address": params[1],
        "document": params[2],
        "signature_r": params[3],
        "signature_s": params[4]
    }, cb)
});

// broadcast methods
server.addMethod("initialize", function(params, cb){
    var error = inspect_parameters_count(1, params);
    if(error){
        cb(error, null);
        return;
    }

    controller.broadcast({
        "method": "initialize",
        "metadata": params[0]
    }, cb)
});

server.addmethod("terminate", function(params, cb){
    var error = inspect_parameters_count(1, params);
    if(error) {
        cb(error, null);
        return;
    }

    controller.broadcast({
        "method": "terminate",
        "metadata": params[0]
    });
});

server.addMethod("terminatechild", function(params, cb){
    var error = inspect_parameters_count(0, params);
    // think about this
});

server.addmethod("broadcastsignature", function(params, cb){
    var error = inspect_parameters_count(5, params);
    if(error) {
        cb(error, null);
        return;
    }

    controller.broadcast({
        "method": "broadcastsignature",
        "metadata": params[0],
        "document": params[1],
        "address": params[2],
        "signature_r": params[3],
        "signature_s": params[4]
    });
});

server.addMethod("registeruser", function(params, cb){
    var error = inspect_parameters_count(2, params);
    if(error) {
        cb(error, null);
        return;
    }

    controller.broadcast({
        "method": "registeruser",
        "metadata": params[0],
        "address": params[1]
    })
})

server.start(function(err){
    if (err) {
        throw err;
    } else {
        console.log("server is up and running");
    }
});