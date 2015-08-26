var format = require('util').format;
var jsen = require('jsen');
var _ = require('lodash');
var jsonSchemaError = require('./libs/json_schema_error');

var DEFINITION_NOT_FOUND = 'Could not find \'%s\'.';
var LINKS_NOT_FOUND = 'Schema does not contain links array.';
var SCHEMA_NOT_FOUND = 'Could not find schema for \'%s\' \'%s\'.';
var INVALID_DATA = 'Invalid data.';
var MISSING_PROP = 'Must supply \'%s\' prop.';
var REQUIRED_PROPS = ['url', 'method'];

exports.definition = definition;
exports.schema = schema;
exports.mandatory = mandatory;
exports.resource = resource;

exports.validate = function(schemata, attr, data) {
  return new Promise(function(resolve, reject) {
    var validator, res;

    try {
      props = checkProps(attr);
      res = resource(props.url);

      var doc = _.compose(
        mandatory(schemata, res),
        schema(props),
        definition(schemata)
      );

      validator = jsen(doc(res));
    } catch(e) {
      reject(new jsonSchemaError(e.message));
    }

    var valid = validator(namespaceData(res, data));

    if (!valid && validator.errors.length) {
      var props = {fields: validator.errors};
      return reject(new jsonSchemaError(INVALID_DATA, props));
    }

    return resolve(data);
  });
};

function definition(schemata) {
  return function(resource) {
    resource = ['definitions', resource];
    var found = _.get(schemata, resource);

    if (!found) {
      var path = resource.join('.');
      throw new jsonSchemaError(format(DEFINITION_NOT_FOUND, path));
    } else return found;
  };
}

function schema(props) {
  return function(definition) {
    var links = _.get(definition, 'links');

    if (!links) throw new jsonSchemaError(LINKS_NOT_FOUND);

    try { props = checkProps(props); } catch(e) { throw e; }

    var schemata = _.chain(links)
      .find(function(a) {
        var method = strCompare(a.method, props.method);
        var url = strCompare(a.href, props.url);

        return method && url;
      })
      .get('schema')
      .value();

    if (!schemata) {
      var msg = format(SCHEMA_NOT_FOUND, props.method, props.url);
      throw new jsonSchemaError(msg);
    }

    return schemata;
  };
}

function mandatory(schemata, resource) {
  return function(spec) {
    var need = _.get(spec, 'required');

    if (!need) return schemata;

    var clone = _.cloneDeep(schemata);
    _.assign(clone.definitions[resource], {required: need});
    return clone;
  };
}

function checkProps(props) {
  REQUIRED_PROPS.forEach(function(prop) {
    if (!_.has(props, prop))
      throw new jsonSchemaError(format(MISSING_PROP, prop));
  });
  return props;
}

function resource(url) {
  var del = '/';
  var str = _.first(url.split(del).filter(function(part) {
    return part != '';
  }));
  if (isPlural(str)) str = str.slice(0, -1);
  return str;
}

function isPlural(str) {
  return str.endsWith('s');
}

function toUpper(str) {
  return str.toUpperCase();
}

function strCompare(s1, s2) {
  return toUpper(s1) === toUpper(s2);
}

function namespaceData(resource, data) {
  var body = {};
  body[resource] = data;
  return body;
}
