/* @flow weak */
'use strict';

var Firebase = require('firebase')
module.exports = Signal

/**
 * Connection to the signal server
 * Should ask for an id
 * @constructor
 * @param peer {Peer}
 */
function Signal(peer, opts) {
  this.id = String(Date.now()) + String(Math.random()).slice(1, 6)
  this.status = 'open' // Interrop with other Connections

  if(typeof opts !== 'undefined') {
    this.firebase = new Firebase(opts.url)
    setOnMessage(this.firebase, this.id, peer)
  } else {
    console.error('Bad options definition for Signal')
  }
}

/**
 * Use the signal server to transmit a message.
 * Two modification need to be done to the message:
 * - The ttl will be set to 0 to prevent forwarding redundancy after the
 *   Firebase broadcast
 * - The message data will be transformed to a JSON String
 *
 * @param message {Message} message to be sent on the mesh
 */
Signal.prototype.send = function(message) {
  message.ttl = 0
  message = JSON.stringify(message)
  this.firebase.push(message)
}

/**
 * Defines the callback handling new messages received from the sigbal server
 *
 * @param firebase {Firebase}
 * @param id {string} Id of the peer
 * @param peer {Peer} instance of Peer object messages should be sent to
 */
var setOnMessage = function(firebase, id, peer) {
  firebase.on('child_added', function(snapshot) {
    var message = JSON.parse(snapshot.val())
    if(message.type === 'request' &&
       message.data === 'peer' &&
       message.from < id) {
      // Do not try to respond to older request messages so we don't need to
      // reset Firebase cache every time we make changes
      return
    } else if(message.from !== id &&
              (message.to === -1 || message.to === id)) {
      peer.emit(message.type, message)
    }
  })
}

/**
 * @return {string} Id of the peer
 */
Signal.prototype.getId = function() {
  return this.id
}
