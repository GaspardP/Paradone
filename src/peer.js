/* @flow */
'use strict';

var Media = require('./media.js')
var Signal = require('./signal.js')
var PeerConnection = require('./peerConnection.js')
var util = require('./util.js')
var EventEmitter = require('eventemitter3')
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
 * @param {Object} [opts] - Configuration options
 *
 * @property {Media} files - Map of files indexed by url
 * @property {string} id - Id of the peer
 * @property {Map.<PeerConnection>} connections - Connections
 *           indexed
 *                                                         by remote peer id
 * @property {Map.<Set.<RTCIceCandidate>>} icecandidates - Store ICECandidates
 *                                                          for a connection if
 *                                                          it's not active yet
 */
function Peer(opts) {
  if(!(this instanceof Peer)) {
    // Namespace guard
    return new Peer(opts)
  }

  if(typeof opts === 'undefined') {
    console.info('Default parameters used')
    opts = {}
  }

  this.files = new Map()

  // Set signaling system
  var signal = new Signal(this, opts.signal)
  this.id = signal.getId() // Get id

  // Will hold the peers when a connection is created
  this.connections = new Map()
  this.icecandidates = new Map()

  this.connections.set('signal', signal)

  // Check out if there are any local files we can seed
  Media.forEachStoredMedia((function(mediafile) {
    this.files.set(mediafile.url, mediafile)
  }).bind(this))

  // Events
  this.on('offer', onoffer)
  this.on('answer', onanswer)
  this.on('icecandidate', onicecandidate)
  this.on('request', onrequest)

  this.on('connected', onconnected)
  this.on('disconnected', ondisconnected)

  this.on('info', oninfo)
  this.on('part', onpart)

  // Inheritance from EE
  EventEmitter.call(this)
}

Peer.prototype = Object.create(EventEmitter.prototype)

/**
 * Set a new media we need to leech
 *
 * @param {string} src - URL for the fie
 * @param {HTMLMediaElement} tag - HTML Element where the media should be played
 * @param {boolean} autoload - Whether or not the file should be played when the
 *                          download is over
 */
Peer.prototype.addMedia = function(src, tag, autoload) {
  if(!this.files.has(src)) {
    // Track the file
    var media = new Media(src, tag, autoload)

    // TODO Check for the local storage?
    this.requestSeed(src)

    // If no peer give answers within 5 seconds the file will be downloaded
    // directly from the server
    media.startDownloadTimeout()

    this.files.set(src, media)
  }
  // TODO Else could be a new tag for the media
}

/**
 * Use the connections to send a message to a remote peer.
 * Two solutions : The peer has the recipient as neighbour or we need to
 * broadcast the message.
 *
 * @param {Message} message - information to be sent
 */
Peer.prototype.send = function(message) {
  // TODO Validate message construction
  var messageValidator = function(msg) {
    var params = ['type', 'from', 'to', 'url', 'ttl', 'forwardBy', 'data']
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
 * @param {String} url - Id for the file
 */
Peer.prototype.requestSeed = function(url) {
  this.send({
    type: 'request',
    from: this.id,
    to: -1,
    url: url,
    ttl: 3,
    data: 'peer',
    forwardBy: []
  })
}

/**
 * Extract ids and url information to define an answer message
 * @param {Message} message - Original message
 * @param {Object} answer - Values (like data and type) to be sent
 */
Peer.prototype.respondTo = function(message, answer) {
  answer.from = this.id
  answer.to = message.from
  answer.url = message.url
  answer.ttl = 3 //TODO Magic Number !
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
 * Return the next part a peer should ask based on the metadata of a media and
 * the already downloaded parts.
 *
 * @param {Media} media - Media file from which the peer possesses at-least the
 *                        meta-data
 * @param {number} nbParts - number of parts to be returned
 */
Peer.prototype.askForNextParts = function(media, nbParts) {
  media.nextPartsToDownload(nbParts)
    .forEach(function sendRequest(info) {
      var remote = info[0]
      var partNumber = info[1]
      console.info('Asking for part', partNumber, 'to peer', remote)
      this.send({
        type: 'request',
        from: this.id,
        to: remote,
        url: media.url,
        ttl: 3,
        forwardBy: [],
        data: 'part',
        number: partNumber
      })
      media.pendingParts.push(partNumber)
    }, this)
}

/**
 * Handle when the channel is openned
 *
 * @event Peer#onconnected
 * @param {string} remotePeer - Id of the remote peer we just connected to
 */
var onconnected = function(remotePeer) {
  // We want to know which files the neighbour has
  this.files.forEach(function(file) {
    if(!file.complete) {
      console.info('Asking for media info', file.url, 'to remote', remotePeer)
      this.connections.get(remotePeer).send({
        type: 'request',
        from: this.id,
        to: remotePeer,
        url: file.url,
        forwardBy: [],
        data: 'info'
      })
    }
  }, this)
}

/**
 * Handle when connection (channel) to a peer is closed
 *
 * @event Peer#ondisconnected
 * @param {string} remotePeer - Id of the peer that disconnected
 * @param {Event} event - information about the disconnection
 */
var ondisconnected = function(remotePeer, event) {
  return remotePeer || event // TODO?
}

/**
 * Handle an answer type response, the last part of the connecion
 * establishement. Set the remote description on local node. Once the connection
 * will be established, the datachannel event should be triggered indicating
 * that the connexion can be used to send messages.
 *
 * @event Peer#onanswer
 * @param {Message} message - An answer containing the remote SDP
 * Description
 *                            needed to set up the connection
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
 * Store the information of the file and updates the information on the
 * mediafile
 *
 * @event Peer#oninfo
 * @param {Message} message - An info type message containing meta-data about
 *                            the media file the node needs
 */
var oninfo = function(message) {
  var info = message.data
  var url = message.url
  var from = message.from
  var media = this.files.get(url)

  media.buildInfoFromRemote(info, from)

  // If the remote peer has parts
  if(info.available.length > 0) {
    media.cancelServerDownload()
  }

  // Start downloading parts
  this.askForNextParts(media, 3) // TODO Magic Number
}

/**
 * Extract the SDPOffer from the received message and respond with a SDPAnswer
 *
 * @event Peer#onoffer
 * @param {Message} message - An offer type message containing the remote peer's
 *                            SDPOffer
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
 * Message containing a part of the desired media
 *
 * @event Peer#onpart
 * @param {Message} message - A part type message containing a chunk of media
 */
var onpart = function(message) {
  console.assert(
    Array.isArray(message.data),
    'Message type:part .data is not an array')
  console.assert(
    this.files.has(message.url),
    'Message type:part received for an undesired file')

  // Store the part
  var media = this.files.get(message.url)
  // TODO Store parts as pure array ?
  media.storeChunk(message.number, new Uint8Array(message.data))
  // Ask for a new part
  this.askForNextParts(media, 1)
}

/**
 * Dispatch a request message depending on is type.
 *
 * @event Peer#onrequest
 * @private
 * @param {Message} message - A request type message
 */
var onrequest = function(message) {
  // TODO Split requests to allow subscription with the `on` function
  // TODO Check URL or forward
  var kind = message.data
  var requestKinds = {
    info: onrequestinfo,
    part: onrequestpart,
    peer: onrequestpeer
  }

  if(!requestKinds.hasOwnProperty(kind)) {
    throw new Error('Invalid kind of request: ' + message.data)
  } else {
    requestKinds[kind].call(this, message)
  }
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

// MEDIA LOGIC
// TODO Move in dedicated file
/**
 * The remote node request the info of a file (size, number of parts). We return
 * this information and the local parts we have in case he is interested
 *
 * @event Peer#onrequestinfo
 * @param {Message} message - A request for information about a media
 */
var onrequestinfo = function(message) {
  if(this.files.has(message.url) &&
     this.files.get(message.url).info !== undefined) {
    this.respondTo(message, {
      type: 'info',
      data: this.files.get(message.url).info
    })
  }
}

/**
 * The remote peer requests some file part
 * We need to check if we have them and then we can send them
 *
 * @event Peer#onrequestpart
 * @param {Message} message - A request for a chunk of a media
 */
var onrequestpart = function(message) {
  var sendChunks = (function(chunk) {
    //TODO Gotta check
    // We have to change the Uint8Array in a Array
    // Should take less space in the message and be easier to parse
    var data = []
    for(var i = 0; i < chunk.length; ++i) {
      data.push(chunk[i])
    }

    this.respondTo(
      message, {
        type: 'part',
        number: message.number,
        data: data
      })
  }).bind(this)

  this.files.get(message.url)
    .getChunk(message.number)
    .then(sendChunks)
}
