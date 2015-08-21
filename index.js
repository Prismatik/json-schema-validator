'use strict';

var format = require('util').format;
var jsen = require('jsen');
var _ = require('lodash');
var jsonSchemaError = require('./libs/json_schema_error');

const DEFINITION_NOT_FOUND = 'Could not find \'%s\'.';
const LINKS_NOT_FOUND = 'Schema does not contain links array.';
const SCHEMA_NOT_FOUND = 'Could not find schema for \'%s\' \'%s\'.';
const INVALID_DATA = 'Invalid data.';
const MISSING_PROP = 'Must supply \'%s\' prop.';
const REQUIRED_PROPS = ['url', 'method'];

exports.definition = definition;
exports.schema = schema;
exports.mandatory = mandatory;
exports.resource = resource;

exports.validate = function(schemata, props, data) {
  return new Promise((resolve, reject) => {
    let validator, res;

    try {
      props = checkProps(props);
      res = resource(props.url);

      let doc = _.compose(
        mandatory(schemata, res),
        schema(props),
        definition(schemata)
      );

      validator = jsen(doc(res));
    } catch(e) {
      reject(new jsonSchemaError(e.message));
    }

    let valid = validator(namespaceData(res, data));

    if (!valid && validator.errors.length) {
      let props = {fields: validator.errors};
      return reject(new jsonSchemaError(INVALID_DATA, props));
    }

    return resolve(data);
  });
};

function definition(schemata) {
  return (resource) => {
    resource = ['definitions', resource];
    let found = _.get(schemata, resource);

    if (!found) {
      let path = resource.join('.');
      throw new jsonSchemaError(format(DEFINITION_NOT_FOUND, path));
    } else return found;
  };
}

function schema(props) {
  return (definition) => {
    let links = _.get(definition, 'links');

    if (!links) throw new jsonSchemaError(LINKS_NOT_FOUND);

    try { props = checkProps(props); } catch(e) { throw e; }

    let schemata = _.chain(links)
      .find((a) => {
        let method = strCompare(a.method, props.method);
        let url = strCompare(a.href, props.url);

        return method && url;
      })
      .get('schema')
      .value();

    if (!schemata) {
      let msg = format(SCHEMA_NOT_FOUND, props.method, props.url);
      throw new jsonSchemaError(msg);
    }

    return schemata;
  };
}

function mandatory(schemata, resource) {
  return (spec) => {
    let need = _.get(spec, 'required');

    if (!need) return schemata;

    let clone = _.cloneDeep(schemata);
    _.assign(clone.definitions[resource], {required: need});
    return clone;
  };
}

function checkProps(props) {
  REQUIRED_PROPS.forEach((prop) => {
    if (!_.has(props, prop))
      throw new jsonSchemaError(format(MISSING_PROP, prop));
  });
  return props;
}

function resource(url) {
  let del = '/';
  let str = _.first(url.split(del).filter((part) => part != ''));
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
  let body = {};
  body[resource] = data;
  return body;
}
