/* @flow weak */
'use strict';

/**
 * Wrapper setting handlers of a RTCDatachannel from a given PeerConnection
 * @module
 */
module.exports = {
  options: {
    optional: [
      { DtlsSrtpKeyAgreement: true },
      { RtpDataChannels: true }
    ]
  },

  /**
   * Creates a new DataChannel from a PeerConnection object and add the
   * callbacks needed to forward events to the Peer and PeerConnection objects
   * (like a connection/disconnection, error and reception of messages)
   *
   * @param {Peer} peer - Events will be forwarded to this Peer
   * @param {PeerConnection} peerConnection - PeerConnection where the
   *                                          DataChannel will be stored
   * @param {string} id - Id of the remote peer
   *
   * @return DataChannel
   */
  create: function(peer, peerConnection, remotePeer) {
    var channel = peerConnection.createDataChannel(peer.id + '-' + remotePeer,
                                                   this.options)
    return this.setHandlers(channel, peer, peerConnection, remotePeer)
  },

  /**
   * Set all the callbacks of a newly created DataChannel
   *
   * @param {RTCDataChannel} channel - Channel to be configured
   * @param {Peer} peer - Events must be forwarded to this Peer
   * @param {PeerConnection} peerConnection - PeerConnection where the
   *                                          DataChannel will be stored
   * @param {string} id - Id of the remote peer
   * @return DataChannel
   */
  setHandlers: function(channel, peer, peerConnection, remotePeer) {
    channel.onmessage = this.onmessage.bind(null, peer)
    channel.onopen = this.onopen.bind(null, peer, peerConnection, remotePeer)
    channel.onclose = this.onclose.bind(null, peer, peerConnection, remotePeer)
    channel.onerror = this.onerror

    return channel
  },

  /**
   * When a message is received through the channel we send it to the Peer
   * onmessage handler. This allows us to handle data recevied through both the
   * signaling system and the mesh network with the same functions
   *
   * @param {Peer} peer - Messages will be forwarded to this Peer
   * @param {Event} event - Contains the message sent by the remote peer
   */
  onmessage: function(peer, event) {
    var message = JSON.parse(event.data)
    if(-1 === message.to || peer.id === message.to) {
      peer.emit(message.type, message)
    } else if(message.ttl > 0) {
      peer.forward(message)
    }
  },

  /**
   * Relay to the Peer instance the initialization of the data channel and save
   * it in the PeerConnection
   */
  onopen: function(peer, peerConnection, remotePeer, event) {
    var channel = event.target
    if('open' === channel.readyState.toLowerCase()) {
      console.info('[dc](' + peer.id + ') Channel open with' + remotePeer)
      peerConnection.channel = channel
      peerConnection.status = 'open'
      peer.emit('connected', remotePeer)
    }
  },

  /**
   * When a peer disconnect the channel is closed. We update the connection's
   * status of the Peer
   */
  onclose: function(peer, peerConnection, remotePeer, event) {
    console.info('[dc](' + peer.id + ') Channel closed with ' + remotePeer)
    peerConnection.status = 'close'
    peer.emit('disconnected', remotePeer, event)
  },

  /** An error has been thrown by the DataChannel */
  onerror: function(error) {
    console.error('Channel error:', error)
  }
}
