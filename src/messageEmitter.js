/*
 * Copyright 2015 Paradone
 *
 * This file is part of Paradone.
 *
 * Paradone is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Paradone is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Paradone.  If not, see <http://www.gnu.org/licenses/>.
 */
/* @flow */
'use strict';

module.exports = MessageEmitter

/**
 * @class Event-like emitter for messages. A message is a JS object
 *        containing a `type` attribute
 *
 * @constructor
 * @property {Map.<Set.<Function>>} listeners - Set of listeners associated to
 *           message types
 */
function MessageEmitter() {
  this.listeners = new Map ()
}

/**
 * Adds a listener function to the specified message type.
 *
 * @param {String} messageType - Type of message the listener will handle
 * @param {Function} listener - Method called when the message is emitted
 * @return {MessageEmitter} Current instance for chaining purposes
*/
MessageEmitter.prototype.addListener =
MessageEmitter.prototype.on = function(messageType, listener) {
  if(!this.listeners.has(messageType)) {
    this.listeners.set(messageType, new Set())
  }
  this.listeners.get(messageType).add(listener)
  return this
}

/**
 * Adds a listener function to the specified message type. The listener will be
 * removed after it is called.
 *
 * @param {String} messageType - Type of message the listener will handle
 * @param {Function} listener - Method called when the message is emitted
 * @return {MessageEmitter} Current instance for chaining purposes
*/
MessageEmitter.prototype.once = function(messageType, listener) {
  var me = this
  var autodestroy = function(message) {
    listener(message)
    me.removeListener(messageType, autodestroy)
  }
  this.on(messageType, autodestroy)
  return this
}

/**
 * Removes a previously attached listener function.
 *
 * @param {String} messageType - Type of message the listener handles
 * @param {Function} listener - Listener that should be removed
 * @return {MessageEmitter} Current instance for chaining
*/
MessageEmitter.prototype.removeListener = function(messageType, listener) {
  if(this.listeners.has(messageType)) {
    this.listeners.get(messageType).delete(listener)
  }
  return this
}

/**
 * Removes all listeners attached to a given message type.
 *
 * @param {String} messageType - Type of message the listeners handle
 * @return {MessageEmitter} Current instance for chaining
*/
MessageEmitter.prototype.removeAllListeners = function(messageType) {
  if(typeof messageType === 'undefined') {
    this.listeners.clear()
  } else {
    if(!this.listeners.has(messageType)) {
      this.listeners.get(messageType).clear()
    }
  }
  return this
}

/**
 * Emits a message activating all the listeners attached to the message type
 *
 * @param {Object} message - Message that should be emitted
 */
MessageEmitter.prototype.emit = function(message) {
  var type = message.type
  if(typeof type === 'undefined') {
    throw new Error('The message object isn\'t well formed')
  } else if(this.listeners.has(type)) {
    this.listeners.get(type).forEach(function(listener) {
      listener.call(this, message)
    }, this)
  }
}

/**
 * @return {number} the number of listeners added to the emitter
 */
MessageEmitter.prototype.listenerCount = function() {
  var sum = 0
  this.listeners.forEach(function(value) {
    sum += value.size
  })
  return sum
}
