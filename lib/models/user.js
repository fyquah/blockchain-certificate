var Model = require(__dirname + "/model.js");
var User = function(obj){
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        this[attr] = obj[attr];
    });
};
User.prototype = Object.create(Model); // inherit
(function(){
    for (var prop in Model) {
        User[prop] = Model[prop];
    }
})();

User.table_name = "users";
User.initialize("users", {
    "public_key": "text",
    "txid": "text", // because all users are registered with a txid
    "btc_address": "string"
}); // initialize table name and attributes

module.exports = User;