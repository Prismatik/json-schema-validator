var standardError = require('standard-error');
module.exports = JsonSchemaError;

function JsonSchemaError(msg, props) {
  standardError.call(this, msg, props);
}

JsonSchemaError.prototype = Object.create(standardError.prototype, {
  constructor: {value: JsonSchemaError, configurable: true, writable: true}
});
