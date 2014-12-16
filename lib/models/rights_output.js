var Model = require(__dirname + "/model.js");
var RightsOutput = function(obj){
    obj = obj || {};
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        this[attr] = obj[attr];
    });
};
RightsOutput.inherit(Model);

RightsOutput.initialize("rights_outputs", {
    "txid": "string", // because all rights outputs are registered with a txid
    "node_id": "string", // the ide of the node
    "vout": "integer", // the vout
    "spent": "boolean" // spent (obvious)
}); // initialize table name and attributes

module.exports = RightsOutput;
