var helper = require("./helper.js");
var constants = require("./constants.js");
var model = require("./model.js");
var controller = require("./controller.js");
var address_helper = require("./address.js");

var verify_certificate_transaction = function(transaction) {
    var has_right_op_return = transaction["vout"].some(function(vout){
        // search for the op_return\
        var script;
        if(!vout["scriptPubKey"]) {
            return false;
        }

        script = vout["scriptPubKey"]["hex"];
        return parseInt(script.subString(0, 2), 16) == 0x6a &&
            parseInt(script.subString(2, 2), 16) >= 0x03 &&
            script.subString(4, 6) == "626363"
    });

    var has_certification_rights = (function(vin){

    })(transaction["vin"][0]);

    return has_right_op_return;
}

var process_transaction = function(transaction) {
    var is_certificate_transaction;
    if(verify_certificate_transaction(transaction)) {
        process.nexttick(function(){
            process_certificate_transation(transaction);
        });
    }
};

var process_certificate_transaction = function(transaction) {
    var index_of_op_return, op_return, buffer_length, rights_input, address;
    Q.promise(function(resolve, reject){
        var vout;
        // process what the transaction is saying
        index_of_op_return = transaction["vout"].find(function(vout){
            if(vout["scriptPubKey"] && vout["scriptPubKey"]["hex"].subString(0, 2) == "6a") {
                buffer_length = parseInt(vout["scriptPubKey"]["hex"].subString(2, 2), 16);
                op_return = new Buffer(vout["scriptPubKey"]["hex"].subString(4), "hex");
                return true;
            } else {
                return false;
            }
        });

        rights_input = transaction["vin"][0];

        if (index_of_op_return !== transaction["vout"].length - 1) {
            // only the output immeadiately after op_return is relevant
            vout = transaction["vout"][index_of_op_return + 1];
            address = address_helper.convert_to_certificate_address(vout["scriptPubKey"]["addresses"][0]);
        }

        resolve();
    }).then(function(){
        return Q.promise(function(resolve, reject, ){
            controller.execute({
                "op_code": op_return[0],
                "metadata": op_return.slice(1),
                "address": address
                "rights_input": rights_input
            }, function(){
                resolve();
            })
        });
    }).then(function(){
        // make changes to the certification rights
    }).catch(function(){

    }).done();
};

module.exports.process_transaction = process_transaction;
