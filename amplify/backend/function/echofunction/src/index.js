exports.handler = function (event, context) { //eslint-disable-line
  console.log(`Echoing...\n${JSON.stringify(event, null, 4)}`);
  context.done(null, event.arguments.msg);
};
