/*
 * Copyright 2015 Paradone
 *
 * This file is part of Paradone <https://paradone.github.io>
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
/* @flow weak */
'use strict'

var Firebase = require('firebase')
module.exports = Signal

/**
 * @class Connection to the signal server with the Firebase module
 *
 * @constructor
 * @param {Peer} peer - Messages will be forwarded to this peer
 * @param {Object} opts - Connection options for Firebase (url, credentials)
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
 * @return {string} Id of the peer
 */
Signal.prototype.getId = function() {
  return this.id
}

/**
 * Use the signal server to transmit a message.
 * Two modification need to be done to the message:
 * - The ttl will be set to 0 to prevent forwarding redundancy after the
 *   Firebase broadcast
 * - The message data will be transformed to a JSON String
 *
 * @param {Message} message -  message to be sent on the mesh
 */
Signal.prototype.send = function(message) {
  message.ttl = 0
  message = JSON.stringify(message)
  this.firebase.push(message)
}

/**
 * Defines the callback handling new messages received from the sigbal server
 *
 * @private
 * @param {Firebase} firebase
 * @param {string} id -  Id of the peer
 * @param {Peer} peer -  instance of Peer object messages should be sent to
 */
var setOnMessage = function(firebase, id, peer) {
  firebase.on('child_added', function(snapshot) {
    var message = JSON.parse(snapshot.val())
    if(message.type === 'request-peer' &&
       message.from < id) {
      // Do not try to respond to older request messages so we don't need to
      // reset Firebase cache every time we make changes
      return
    } else if(message.from !== id &&
              (message.to === -1 || message.to === id)) {
      peer.emit(message)
    }
  })
}
