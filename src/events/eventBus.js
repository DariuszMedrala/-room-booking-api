const { EventEmitter } = require("node:events");

function createEventBus() {
  const emitter = new EventEmitter();

  return {
    publish(type, payload) {
      emitter.emit(type, payload);
    },
    subscribe(type, listener) {
      emitter.on(type, async payload => {
        try {
          await listener(payload);
        } catch (err) {
          console.error(`[eventBus] listener for "${type}" failed:`, err);
        }
      });
    }
  };
}

module.exports = { createEventBus };
