var db = require(__dirname + "/db.js");
var Q = require("q");

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
};

// public methods
Model.prototype.create = function(callback){
    var values_string = generateSqlValuesString(this.constructor.attributes, this),
        that = this,
        sql_string, error_occured;

    sql_string = "INSERT INTO " + that.constructor.table_name + values_string;

    db.serialize(function(){
        db.run(sql_string , function(err, rows){
            callback.apply(that, [err != null]);
        });
    });
};

Model.prototype.update = function(callback){
    return this.updateAttributes(this, callback);
};

Model.prototype.update_attributes = function(obj, callback){
    var values_string = generateSqlValuesString(this.constructor.attributes, obj),
        that = this;

    sql_string = "UPDATE " + that.constructor.table_name + values_string + " WHERE ID =" + that.id;
    db.serialize(function(){
        db.run(sql_string, function(err, rows){
            callback.apply(that, [err != null]);
        });
    });
};

Model.where = function(obj, callback){
    var sql_string = generateSqlSelectString(obj, this.table_name);

    db.serialize(function(){
        db.all(sql_string, function(err, callback){
            callback.apply(res.reduce(function(entry){
                return that[entry];
            }), [err != null]);
        });
    });
};

Model.find_by = function(obj, callback){
    var sql_string = generateSqlSelectString(obj, this.table_name, 1),
        that = this;

    db.serialize(function(){
        db.all(sql_string, function(err, res){
            callback.apply(res.length == 0 ? null : that(res[0]), [err != null]);
        });
    });
};

Model.all = function(callback) {
    return this.where({}, callback);
};

Model.initialize = function(table_name, obj){
    var prop,
        generateIndexName = function(table_name, column_name){
            return "index_" + table_name + "_on_" + column_name;
        },
        that = this,
        completed_initialization = false;

    this.table_name = table_name;
    this.attributes = [];
    for (prop in obj) {
        if (prop != "id") {
            this.attributes.push(prop);
        }
    }
    this.attributes.push("id");

    Q.promise(function(resolve, reject, notify){
        var sql_string = "CREATE TABLE IF NOT EXISTS " + table_name + " (id INTEGER PRIMARY KEY ASC"; // create the models table
        var prop;
        Object.keys(obj).forEach(function(attr, i){
            sql_string += ", " + attr + " " + obj[attr].toUpperCase();
        });
        sql_string += ");";
        console.log(sql_string);
        db.serialize(function(){
            db.run(sql_string, function(err, res){
                if (err != null) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }).then(function(){
        return Q.promise(function(resolve, reject, notify){
            that.attributes.forEach(function(attr, i){
                var sql_string = "CREATE INDEX IF NOT EXISTS " +
                    generateIndexName(that.table_name, attr) +
                    " ON " + that.table_name +
                    " (" + attr + ");";
                console.log(sql_string);
                db.serialize(function(){
                    db.run(sql_string, function(err, res){
                        if (err != null) {
                            reject(err);
                        }
                        else if (i === that.attributes.length - 1) {
                            resolve();
                        }
                    });
                });
            });
        });
    }).catch(function(err){
        console.log("An unkown error occured!");
        console.log(err);
        error_occured = err;
    }).finally(function(){
        completed_initialization = true;
    }).done();
}

module.exports = Model;
