var helper = require("./helper.js");

var process_transaction = function(transaction) {
    Q.promise(function(resolve, reject, notify){
        var op_return, address;
        helper.for_each(transaction["vout"], function(vout) {
            var script = vout["hex"], len;
            if(script.subString(0, 2) == "6a") {
                len = eval("0x" + script.subString(2, 2));
                op_return = script.subString(4, len);
            } else {
                address = vout.addresses[0];
            }
        });
        process.nexttick(function(){
            process_script(op_return, address);
            resolve();
        })
    }).then(function(){

    }).then(function(){

    }).done();
};

var process_script = function(address, op_return) {
    
}

module.exports.process_transaction = process_transaction;
