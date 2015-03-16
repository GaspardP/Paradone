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

var MessageEmitter = require('./messageEmitter.js')
var PeerConnection = require('./peerConnection.js')
var Signal = require('./signal.js')
var util = require('./util.js')
var extensions = require('./extensions/list.js')

module.exports = Peer

/**
 * @typedef RTCIceCandidate
 * @see https://w3c.github.io/webrtc-pc/#rtcicecandidate-type
 */
var RTCIceCandidate =
    window.RTCIceCandidate ||
    window.mozRTCIceCandidate
/**
 * @typedef RTCSessionDescription
 * @see https://w3c.github.io/webrtc-pc/#rtcsessiondescription-class
 */
var RTCSessionDescription =
    window.RTCSessionDescription ||
    window.mozRTCSessionDescription ||
    window.webkitRTCSessionDescription

/**
 * @class A peer holds the information for connections with the mesh, and info
 *        about possessed files. It communicates with other peers through a
 *        messaging system. Local objects can subscribe to message event with
 *        the `on`function and send messages with the `emit` function.
 *
 * @constructor
 * @param {Object} [options] - Configuration options
 *
 * @property {string} id - Id of the peer
 * @property {Map.<PeerConnection>} connections - Connections indexed by remote
 *           peer id
 * @property {Map.<Set.<RTCIceCandidate>>} icecandidates - Store ICECandidates
 *           for a connection if it's not active yet
 */
function Peer(options) {
  if(!(this instanceof Peer)) {
    // Namespace guard
    return new Peer(options)
  }

  MessageEmitter.call(this)

  if(typeof options === 'undefined') {
    console.info('Default parameters used')
    options = {}
  } else {
    extensions.apply(this, options.extensions)
    if(options.hasOwnProperty('peer') &&  options.peer.hasOwnProperty('ttl')) {
      Peer.ttl = options.peer.ttl
    }
  }

  // Set signaling system
  var signal = new Signal(this, options.signal)
  this.id = signal.getId() // Get id

  // Will hold the peers when a connection is created
  this.connections = new Map()
  this.icecandidates = new Map()

  this.connections.set('signal', signal)

  // Message Handlers
  this.on('offer', onoffer)
  this.on('answer', onanswer)
  this.on('icecandidate', onicecandidate)
  this.on('request-peer', onrequestpeer)

}

Peer.prototype = Object.create(MessageEmitter.prototype)

Peer.ttl = 3

/**
 * Use the connections to send a message to a remote peer.
 * Two solutions: The peer has the recipient as neighbour or we need to
 * broadcast the message.
 *
 * @param {Message} message - information to be sent
 */
Peer.prototype.send = function(message) {
  // TODO Validate message construction
  var messageValidator = function(msg) {
    var params = ['type', 'from', 'to', 'ttl', 'forwardBy']
    params.forEach(function(param) {
      if(!msg.hasOwnProperty(param) || typeof msg[param] === 'undefined') {
        throw new Error('Message#' + param + ' is missing')
      }
    })
    return true
  }

  if(!messageValidator(message)) {
    throw new Error('Message object is invalid')
  }

  var to = message.to
  var from = message.forwardBy

  if(this.connections.has(to) && this.connections.get(to).status === 'open') {
    // Node is already connected to desired recipient
    this.connections.get(to).send(message)
  } else { // Broadcast
    var targets = 0
    // Get all open connections which have not received the message yet
    this.connections.forEach(function(connection, peerId) {
      // Do not send to signal and nodes that already had this message
      // Do not send the message to nodes that forwarded it
      if(peerId !== 'signal' &&
         from.indexOf(peerId) === -1 &&
         connection.status === 'open') {
        connection.send(message)
        targets += 1
      }
    })

    if(targets === 0 && this.connections.has('signal')) { //TODO Magic number
      // Not enough neighbours for broadcast, use signal system
      this.connections.get('signal').send(message)
    }
  }
}

/**
 * Send a new request for peers to everyone
 */
Peer.prototype.requestPeer = function() {
  this.send({
    type: 'request-peer',
    from: this.id,
    to: -1,
    ttl: 3,
    forwardBy: []
  })
}

/**
 * Extract information to define an answer message
 * @param {Message} message - Original message
 * @param {Object} answer - Values (like data and type) to be sent
 */
Peer.prototype.respondTo = function(message, answer) {
  answer.from = this.id
  answer.to = message.from
  answer.ttl = Peer.ttl
  answer.forwardBy = []
  this.send(answer)
}

/**
 * When the node receives a message for someone else it decrease the ttl by one
 * and forwards it
 * @param {Message} message - message to be forwarded
 */
Peer.prototype.forward = function(message) {
  message.ttl -= 1
  message.forwardBy.push(this.id)
  this.send(message)
}

/**
 * Handle an answer type response, the last part of the connecion
 * establishement. Set the remote description on local node. Once the connection
 * will be established, the datachannel event should be triggered indicating
 * that the connexion can be used to send messages.
 *
 * @event Peer#onanswer
 * @param {Message} message - An answer containing the remote SDP Description
 *        needed to set up the connection
 */
var onanswer = function(message) {
  //TODO Move logic to peerConection
  //TODO Check status in PeerConnection
  var from = message.from
  var answer = new RTCSessionDescription(message.data)
  var status = this.connections.get(from).status

  // TODO Assert should check the connection status RTCSignalingState which can
  // be stable, have-local-offer, have-remote-offer, have-local-pranswer,
  // have-remote-pranswer or closed
  console.assert(
    this.connections.has(from) && status === 'connecting',
    'Error while connecting to node ' + from + ' : status ' + status)

  this.connections.get(from).setRemoteDescription(
    answer,
    function() {}, // Do nothing, we have to wait for the datachannel to open
    util.error(new Error()))
}

/**
 * Remote ICECandidates have to be added to the corresponding peerConnection. If
 * the connection is not established yet, we store the data.
 *
 * @event Peer#onicecandidate
 * @param {Message} message - an icecandidate type message
 */
var onicecandidate = function(message) {
  var candidate = new RTCIceCandidate(message.data)
  var from = message.from

  if(!this.connections.has(from)) {
    // Received ICE Candidates before SDP Description we store them
    if(!this.icecandidates.has(from)) {
      this.icecandidates.set(from, new Set([candidate]))
    } else {
      this.icecandidates.get(from).add(candidate)
    }
  } else {
    // The connection already exists
    this.connections.get(from).addIceCandidate(
      candidate,
      function() {},
      util.error(new Error()))
  }
}

/**
 * Extract the SDPOffer from the received message and respond with a SDPAnswer
 *
 * @event Peer#onoffer
 * @param {Message} message - An offer type message containing the remote peer's
 *        SDPOffer
 */
var onoffer = function(message) {
  var remotePeer = message.from
  var remoteSDP = message.data
  var peerConnection = new PeerConnection(this, remotePeer)
  /** Add ICE Candidates if they exist */
  var addIceCandidate = function(remotePeer, peerConnection) {
    if(this.icecandidates.has(remotePeer)) {
      var candidates = this.icecandidates.get(remotePeer)
      var successCallback = function() {
        console.info('Succesfully added stored icecandidates')
      }
      candidates.forEach(function(candidate) {
        peerConnection.addIceCandidate(
          candidate,
          successCallback,
          util.error(new Error()))
      }, this)
      this.icecandidates.delete(remotePeer)
    }
  }
  // Send an answer to the message
  var sendAnswer = function(message, answer) {
    this.respondTo(message, {type: 'answer', data: answer})
  }

  // Create and send the SDPAnswer
  peerConnection.createSDPAnswer(remoteSDP, sendAnswer.bind(this, message))
  // Add ICECandidate to the peer connection if we already have some
  addIceCandidate.call(this, remotePeer, peerConnection)
  // Save the connection
  this.connections.set(remotePeer, peerConnection)
}

/**
 * The remote peer want our mediafile
 * The node begin the connection
 *
 * @event Peer#onrequestpeer
 * @param {Message} message - A request for a new connection
 */
var onrequestpeer = function(message) {
  // TODO Check we don't already have the connection
  var remote = message.from
  if(this.connections.has(remote) &&
     this.connections.get(remote).status !== 'close') {
    return
  }

  var peerConnection = new PeerConnection(this, message.from)
  var sendOffer = function(message, offer) {
    this.respondTo(message, { type: 'offer', data: offer })
  }

  // Setup the communication channel only on one side
  peerConnection.createChannel()
  // Send the SDP Offer once the connection is created
  peerConnection.createSDPOffer(sendOffer.bind(this, message))
  // Save the new connexion
  this.connections.set(message.from, peerConnection)
}
