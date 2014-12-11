var db = require("db");

var Model = function(){
    // do nothing, because this contrusctor is not meant to be used anyway..
};

// private methods 
var generateSqlSelectString = function(conditions, table_name, limit){
    var prop,
        sql_string = "SELECT * FROM " + table_name + 
            (Object.keys(conditions).length > 0 ? " WHERE " : "");
    for (prop in conditions) {
        sql_string += prop + "=" + conditions[prop];
    }
    sql_string += limit ? " LIMIT " + limit : "";
    return sql_string;
};

var generateSqlValuesString = function(attributes, obj){
    var column_string = " ",
        values_string = " VALUES(",
        number_of_attributes = 0;

    attributes.forEach(function(attr, i){
        if (obj.attr) {
            values_string += (number_of_attributes == 0 ? "" : ", ") + attr + "=" + obj[attr] + " ";
            column_string += (number_of_attributes == 0 ? "" : ", ") + attr + "=" + obj[attr] + " ";
            number_of_attributes += 1;
        }
    });
    values_string += ")";
    return (number_of_attributes == 0 ? "" : column_string + values_string);
}

// public methods
Model.prototype.create = function(callback){
    var values_string = generateSqlValuesString(this.constructor.attributes, this),
        that = this,
        sql_string;

    sql_string = "INSERT INTO " + that.constructor.table_name + values_string;

    db.run(sql_string , function(err, rows){
        callback.apply(that, [err != null]);
    })
};

Model.prototype.update = function(callback){
    return this.updateAttributes(this, callback);
};

Model.prototype.updateAttributes = function(obj, callback){
    var values_string = generateSqlValuesString(this.constructor.attributes, obj),
        that = this;

    sql_string = "UPDATE " + that.constructor.table_name + values_string + " WHERE ID =" + that.id;
    db.run(sql_string, function(err, rows){
        callback.apply(that, [err != null]);
    })
};

Model.where = function(obj, callback){
    var sql_string = generateSqlSelectString(obj, this.table_name);
    
    db.run(sql_string, function(err, callback){
        callback.apply(res.reduce(function(entry){
            return that[entry];
        }), [err != null]);
    });
};

Model.find_by = function(obj, callback){
    var sql_string = generateSqlSelectString(obj, this.table_name, 1);

    db.run(sql_string, function(err, res){
        callback.apply(res.length == 0 ? null : that(res[0]), [err != null]);
    });
};

Model.all = function(callback) {
    return this.where({}, callback);
};

module.exports = Model;