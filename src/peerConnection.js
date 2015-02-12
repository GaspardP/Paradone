/* @flow weak */
'use strict';

var dataChannel = require('./dataChannel.js')
var util = require('./util.js')
module.exports = PeerConnection

/**
 * @typedef RTCPeerConnection
 * @see http://www.w3.org/TR/webrtc/#rtcpeerconnection-interface
 */
var RTCPeerConnection =
    window.RTCPeerConnection ||
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection
/**
 * @typedef RTCSessionDescription
 * @see http://www.w3.org/TR/webrtc/#idl-def-RTCSessionDescription
 */
var RTCSessionDescription =
    window.RTCSessionDescription ||
    window.mozRTCSessionDescription ||
    window.webkitRTCSessionDescription
/**
 * @typedef RTCConfiguration
 * @see http://www.w3.org/TR/webrtc/#idl-def-RTCConfiguration
 */
var RTCConfiguration = {
  iceServers: [
    { // Amazon
      /** @deprecated replaced by `urls` */
      url: 'stun:23.21.150.121',
      urls: 'stun:23.21.150.121'
    }, {
      url: 'stun:stun.l.google.com:19302',
      urls: 'stun:stun.l.google.com:19302'
    }
  ],
  iceTransports: 'all', // none relay all
  peerIdentity: null
}
var MediaConstraints// Should NOT be defined

/**
 * @class The PeerConnection is a RTCPeerConnection configured to forward event
 *        to the Peer object attached to it.
 *
 * @constructor
 * @augments RTCPeerConnection
 * @param {Peer} peer - Peer holding the connection (usually the local node)
 * @param {string} remotePeer - Id of the remote peer
 * @property {string} id - Id of the peer
 * @property {string} remotePeer - Id of the remote peer
 * @property {string} status - Indicates the state of the connection
 */
function PeerConnection(peer, remotePeer) {
  // TODO Inheritance: Can we extend RTCPeerConnection directly?
  //      RTCPeerConnection.call(this, RTCConfiguration)
  var id = peer.id
  var pc = new RTCPeerConnection(RTCConfiguration, MediaConstraints)

  pc.id = id
  pc.remotePeer = remotePeer
  pc.status = 'connecting'

  /**
   * Create and configure the DataChannel for the PeerConnection
   * @see DataChannel for the list of configurations
   *
   * @function PeerConnection#createChannel
   * @return {DataChannel} The configured DataChannel
   */
  pc.createChannel = function() {
    pc.channel = dataChannel.create(peer, pc, remotePeer)
    return pc.channel
  }

  /**
   * Creates the SDPOffer to open a connection to the remote peer
   *
   * @function PeerConnection#createSDPOffer
   * @param {function} sendOffer - Use the signaling server to transmit the
   *                               offer to the remote Peer
   */
  pc.createSDPOffer = function(sendOffer) {
    // TODO Use generators when available
    pc.createOffer(function(offer) {
      pc.setLocalDescription(offer, function() {
        sendOffer(offer)
      }, util.error(new Error('Failed to set local description')))
    }, util.error(new Error('Failed to create SDP offer')))
  }

  /**
   * Create a SDPAnswer from a SDPOffer and send it to the remote peer
   *
   * @function PeerConnection#createSDPAnswer
   * @param {string} remoteSDP - Id of the remote peer
   * @param {function} sendAnswer - callback used to send the SDPAnswer. Use
   *                                the signaling system to transmit it
   */
  pc.createSDPAnswer = function(remoteSDP, sendAnswer) {
    // TODO Use generator when available
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
   * Use the DataChannel to transmit the message to the remote peer
   *
   * @function PeerConnection#send
   * @param {Message} message - message that should be sent to the remote peer
   */
  pc.send = function(message) {
    if('open' === pc.status) {
      pc.channel.send(JSON.stringify(message))
    }
  }

  // Events

  /**
   * Directly send ICECandidates to the remote peer when received
   *
   * @private
   * @event PeerConnection#onicecandidate
   * @param {Event} event - Object containing the candidate when the callback is
   *                        fired
   */
  pc.onicecandidate = function(event) {
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
   * @private
   * @event PeerConnection#ondatachannel
   * @param {Event} event - Contains a RTCDataChannel created by the remote peer
   */
  pc.ondatachannel = function(event) {
    pc.channel = dataChannel.setHandlers(
      event.channel,
      peer,
      pc,
      remotePeer)
  }

  // Supercharged RTCPeerConnection
  return pc
}
