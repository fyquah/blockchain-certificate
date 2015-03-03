var fs = require("fs");
var constants = require(__dirname + "/constants.js");

var reader = function(file_path){
    if(fs.fileExistsSync) {
        try {
            var _contents = fs.readFileSync(file_path, {"encoding": "utf-8"});
            _contents = JSON.parse(_contents);
        } catch(e) {
            _contents = _contents || {};
        }
    }

    return {
        read: function(){
            return _contents;
        },
        update: function(cb){
            fs.writeFile(file_path, typeof _contents === "object" ? JSON.stringify(_contents) : _contents, function(err){
                if(err !== null) {
                    console.error(err);
                }

                if (typeof cb === "function") {
                    cb((err || null), _contents);
                }
            });
        },
        write: function(new_contents, cb){
            fs.writeFile(file_path, (typeof new_contents === "object" ? JSON.stringify(new_contents) : new_contents), function(err, stdout){
                if (typeof new_contents === "object") {
                    _contents = new_contents;
                } else {
                    try {
                        _contents = JSON.parse(new_contents);
                    } catch(e) {
                        _contents = new_contents;
                    }
                }

                if (typeof cb === "function") {
                    cb((err || null), _contents);
                }
            })
        }
    };
};

module.exports.config = reader(process.env["HOME"] + "/.blockchain-certificate/config.json")
module.exports.status = reader(process.env["HOME"] + "/.blockchain-certificate/status.json")
