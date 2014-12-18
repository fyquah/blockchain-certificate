var helper = require("./helper.js");
var constants = require("./constants.js");
var controller = require("./controller.js");
var address_helper = require("./address.js");
var Q = require("q");

var verify_certificate_transaction = function(transaction) {
    transaction = transaction || {};
    if (!transaction["vout"]) {
        return false;
    }

    var has_valid_op_return = transaction["vout"].some(function(vout){
        // search for the op_return\
        var script;
        if(!vout["scriptPubKey"]) {
            return false;
        }

        script = vout["scriptPubKey"]["hex"];
        console.log(script);
        return parseInt(script.substring(0, 2), 16) == 0x6a &&
            parseInt(script.substring(2, 4), 16) >= 0x03 &&
            script.substring(4, 10) === "626363"
    });

    return has_valid_op_return;
}

var process_transaction = function(transaction, cb) {
    if(verify_certificate_transaction(transaction)) {
        process.nextTick(function(){
            process_certificate_transaction(transaction, cb);
        });
    }
};

var process_certificate_transaction = function(transaction, cb) {
    var index_of_op_return, op_return, buffer_length, rights_input, address;
    Q.promise(function(resolve, reject){
        var vout;
        // process what the transaction is saying
        index_of_op_return = (function(vouts){
            for(var i = 0 ; i < vouts.length ; i++) {
                var vout = vouts[i];
                if(vout["scriptPubKey"] && vout["scriptPubKey"]["hex"] &&
                    vout["scriptPubKey"]["hex"].substring(0, 2) == "6a") {
                    buffer_length = parseInt(vout["scriptPubKey"]["hex"].substring(2, 4), 16);
                    op_return = new Buffer(vout["scriptPubKey"]["hex"].substring(4), "hex");
                    return i;
                }
            }
        })(transaction["vout"]);

        rights_input = transaction["vin"][0];

        if (index_of_op_return !== transaction["vout"].length - 1) {
            // only the output immeadiately after op_return is relevant
            vout = transaction["vout"][index_of_op_return + 1];
            address = address_helper.convert_to_certificate_address(vout["scriptPubKey"]["addresses"][0]);
        }
        console.log("index of op_return is ");
        console.log(index_of_op_return);
        resolve();
    }).then(function(){
        return Q.promise(function(resolve, reject){
            controller.execute({
                "op_code": op_return[3],
                "metadata": op_return.slice(4),
                "address": address,
                "rights_input": rights_input
            }, function(err, results){
                if(err !== null) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    }).then(function(){
        console.log({
            "rights_input": rights_input,
            "count": index_of_op_return,
            "txid": transaction.txid,
            "genesis": (constants.OP_INITIALIZE === op_return[3] ? op_return.slice(4) : false)
        });
        return Q.promise(function(resolve, reject) {
            if (op_return[3] !== constants.OP_TERMINATE) {
                controller.generate_new_rights({ // this will effectively destroy the old rights
                    "rights_input": rights_input,
                    "count": index_of_op_return,
                    "txid": transaction.txid,
                    "genesis": (constants.OP_INITIALIZE === op_return[3] ? op_return.slice(4) : false)
                }, function(err, node){
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(node);
                });
            } else {
                resolve(null);
            }
        });
        // make changes to the certification rights
    }).then(function(all_outputs_or_null){
        console.log("completed generation of new rights");
        if(typeof cb === "function"){
            cb(null, all_outputs_or_null);
        }
    }).catch(function(err){
        console.log("an error occured");
        console.log(err);
        if(typeof cb === "function"){
            cb(err);
        }
    }).done();
};

module.exports.process_transaction = process_transaction;
