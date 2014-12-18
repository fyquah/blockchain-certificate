var constants = require("./constants.js");
var helper = {};

helper.for_each = function(arr, fnc, cb){
    var dup = arr.concat(), i = 0;

    process.nexttick(function process_array(){
        if (dup.length()) {
            var next_entry = arr.shift();
            fnc.apply(arr, [next_entry, i, arr])
            i += 1;
            process.nexttick(process_array);
        } else {
            cb.apply(arr, [arr]);
        }
    });
};

helper.unknown_error = function(err){
    return {
        "code": constants.ERR_UNKNOWN,
        "message": "an unkown error occured!",
        "log": err
    };
}

module.exports = helper;
