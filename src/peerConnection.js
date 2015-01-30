/* @flow weak */
'use strict';

var dataChannel = require('./dataChannel.js')
var util = require('./util.js')
module.exports = PeerConnection

var RTCPeerConnection =
    window.RTCPeerConnection ||
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection
var RTCSessionDescription =
    window.RTCSessionDescription ||
    window.mozRTCSessionDescription ||
    window.webkitRTCSessionDescription
var RTCConfiguration = {
  iceServers: [
    { url: 'stun:23.21.150.121' }, // Amazon
    { url: 'stun:stun.l.google.com:19302'}
  ],
  iceTransports: 'all', // none relay all
  peerIdentity: null
}
var RTCConfigurationOptions // Should NOT be defined

/**
 * The PeerConnection is a RTCPeerConnection configured to forward event to the
 * Peer object attached to it
 *
 * @constructor
 */
function PeerConnection(peer, id, remotePeer) {
  // TODO Remove peer and only add send function
  // TODO Inheritance: Can we extend RTCPeerConnection directly?
  //      RTCPeerConnection.call(this, RTCConfiguration)
  var pc = new RTCPeerConnection(RTCConfiguration, RTCConfigurationOptions)

  pc.id = id
  pc.remotePeer = remotePeer
  pc.status = 'connecting'

  // TODO Remove bind for efficiency
  pc.onicecandidate = onicecandidate.bind(null, peer, id, remotePeer)
  pc.ondatachannel = ondatachannel.bind(null, peer, pc, remotePeer)
  pc.createSDPAnswer = createSDPAnswer.bind(null, pc)
  pc.createSDPOffer = createSDPOffer.bind(null, pc)
  pc.createChannel = createChannel.bind(null, pc, id, remotePeer)
  pc.send = send.bind(null, pc)

  return pc
}

/**
 * Automatically send ICECandidates to the remote peer
 *
 * @param peer {Peer} the Peer object attached to the PeerConnection
 * @param id {string} id of the Peer
 * @param remotePeer {string} id of the remote peer the connection is linked to
 * @param event {Event} Object containing the candidate when the callback is
 * fired
 */
var onicecandidate = function(peer, id, remotePeer, event) {
  if(null === event.candidate) {
    return
  }
  peer.send({
    type: 'icecandidate',
    from: id,
    to: remotePeer,
    url: '', //TODO Send url or remove message guard in peer
    ttl: 3,
    data: event.candidate,
    forwardBy: []
  })
}

/**
 * When a the remote peer opens a DataChannel, it adds the default event
 * handlers and tells the Peer to emit an `onconnected` event
 *
 * @param peer {Peer} the Peer object attached to the PeerConnection
 * @param peerConnection {PeerConnection} the PeerConnection object
 * @param remotePeer {string} id of the remote peer the connection is linked to
 * @param event {Event} Object containing the DataChannel when the callback is
 * fired
 */
var ondatachannel = function(peer, peerConnection, remotePeer, event) {
  peerConnection.channel = dataChannel.setHandlers(event.channel,
                                                   peer,
                                                   peerConnection,
                                                   remotePeer)
  peer.emit('connected', remotePeer)
}

/**
 * Use the DataChannel to transmit the message to the remote peer
 *
 * @param pc {PeerConnection} the PeerConnection object
 * @param message {Message} the Message
 */
var send = function(pc, message) {
  // Parse the message before sending it
  // TODO Find a way to send binary messages
  if('open' === pc.status) {
    pc.channel.send(JSON.stringify(message))
  }
}

/**
 * Create and configure the DataChannel for the PeerConnection
 *
 * @param pc {PeerConnection}
 * @param id {string}
 * @param remotePeer {string}
 * @param peer {Peer}
 */
var createChannel = function(pc, id, remotePeer, peer) {
  pc.channel = dataChannel.create(peer, pc, remotePeer)
  return pc
}

/**
 * Create a SDPAnswer from a SDPOffer and sen it to the remote peer
 *
 * @param pc {PeerConnection}
 * @param remoteSDP
 * @param sendAnswer {Function} callback used to send the SDPAnswer. Use the
 * signaling system to transmit it
 */
var createSDPAnswer = function(pc, remoteSDP, sendAnswer) {
  // TODO Should you generators when available
  remoteSDP = new RTCSessionDescription(remoteSDP)
  pc.setRemoteDescription(remoteSDP, function() {
    // Then create the answer
    pc.createAnswer(function(answer) {
      // Then set local description from the answer
      pc.setLocalDescription(answer, function success() {
        // ... and send it
        sendAnswer(answer)
      }, util.error(new Error()))
    }, util.error(new Error()))
  }, util.error(new Error()))
}

/**
 * Creates the SDPOffer to open a connection to the remote peer
 *
 * @param pc {PeerConnection}
 * @param sendOffer {Function} Use the signaling server to transmit the offer to
 * the remote Peer
 */
var createSDPOffer = function(pc, sendOffer) {
  // TODO Should you generators when available
  pc.createOffer(function(offer) {
    pc.setLocalDescription(offer, function() {
      sendOffer(offer)
    }, util.error(new Error('Failed to set local description')))
  }, util.error(new Error('Failed to create SDP offer')))
}
