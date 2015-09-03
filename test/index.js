var assert = require('assert');
var _ = require('lodash');
var jsonSchema = require('../index');
var jsonSchemaError = require('../libs/json_schema_error');
var testSchema = require('./schema.json');

describe('jsonSchema', function() {
  before(function() {
    this.props = {url: '/tests', method: 'post'};
    this.resource = jsonSchema.resource(this.props.url);
  });

  describe('.definition', function() {
    it('must return schema', function() {
      var found = jsonSchema.definition(testSchema)(this.resource);
      assert(found, testSchema.definitions.test);
    });

    it('must throw error if schema not found', function() {
      assert.throws(function() {
        jsonSchema.definition(testSchema)('nope');
      }, jsonSchemaError);
    });
  });

  describe('.schema', function() {
    it('must throw error if links property not found' , function() {
      assert.throws(function() {
        jsonSchema.schema(this.props)({nope: {}});
      }, jsonSchemaError);
    });

    it('must throw error if schema \'url\' not found', function() {
      assert.throws(function() {
        var props = {method: 'post'};
        jsonSchema.schema(props)(testSchema.definitions.test);
      }, jsonSchemaError);
    });

    it('must throw error if schema \'method\' not found', function() {
      assert.throws(function() {
        var props = {url: '/artists'};
        jsonSchema.schema(props)(testSchema.definitions.test);
      }, jsonSchemaError);
    });

    it('must throw error if schema not found', function() {
      var self = this;
      assert.throws(function() {
        var def = {links:[{href: '/artists', method: 'post'}]};
        jsonSchema.schema(self.props)(def);
      }, jsonSchemaError);
    });

    it('must return schema' , function() {
      var schema = _.compose(
        jsonSchema.schema(this.props),
        jsonSchema.definition(testSchema)
      );

      assert(schema(this.resource), testSchema);
    });
  });

  describe('.mandatory', function() {
    it('must return schema without required field', function() {

      // remove properties with undefined values.
      var clone = _.cloneDeep(testSchema);
      var schema = clone.definitions[this.resource].links[0].schema;
      schema.required = undefined;
      schema = _.first(filterNull(schema));
      clone.definitions[this.resource].links[0].schema = schema;

      var s = getSchema(clone, this.props);

      assert.equal(s.definitions[this.resource].required, undefined);
    });

    it('must not mutate schema', function() {
      var s = getSchema(testSchema, this.props);

      assert.notDeepEqual(s, testSchema);
    });

    it('must return schema with required fields', function() {
      var s = getSchema(testSchema, this.props);

      assert.equal(
        s.definitions[this.resource].required,
        testSchema.definitions[this.resource].links[0].schema.required
      );
    });
  });

  describe('.resource', function() {
    it('must return string with no forward slashes', function() {
      assert.equal(jsonSchema.resource('/sup/'), 'sup');
    });

    it('must return string as singular', function() {
      assert.equal(jsonSchema.resource('/bros'), 'bro');
    });
  });

  describe('.validate', function() {
    it('must throw error if supplied invalid JSON schema', function() {
      jsonSchema.validate('nope', this.props, {})
        .catch((e) => {
          assert.equal(e.message, 'Invalid schema.');
        });
    });

    it('must throw error if data invalid against schema', function() {
      var data = {artist: {name: true}};

      jsonSchema.validate(testSchema, this.props, data)
        .catch((e) => {
          assert.equal(e.message, 'Invalid data.');
        });
    });

    it('must not return a single error', function() {
      var data = {artist: {name: true, email: 'nope'}};

      jsonSchema.validate(testSchema, this.props, data, {greedy: true})
        .catch((e) => {
          assert(e.fields.length != 1);
        });
    });

    it('must return all errors', function() {
      var data = {artist: {name: true, email: 'nope'}};

      jsonSchema.validate(testSchema, this.props, data, {greedy: true})
        .catch((e) => {
          assert.equal(e.fields.length == 2);
        });
    });

    it('must return data if valid', function() {
      var data = {artist: {name: 'DJ Jiggles'}};

      jsonSchema.validate(testSchema, this.props, data)
        .then((res) => {
          assert.equal(res, data);
        });
    });
  });
});

function getSchema(schema, props) {
  var res = jsonSchema.resource(props.url);
  var doc = _.compose(
    jsonSchema.mandatory(schema, res),
    jsonSchema.schema(props)
  );
  return doc(schema.definitions[res]);
}

function filterNull(list) {
  return _.filter(list, function(a) { return a != undefined; });
}
