/* @flow weak */
'use strict';

var Media = require('./media.js')
var Peer = require('./peer.js')
var PeerConnection = require('./peerConnection.js')
var Signal = require('./signal.js')

/**
 * Find every video tag and start downloading and sharing them through the mesh
 *
 * @param {Object} opts
 *   1. Signaling server
 *   2. Turn/Stun server
 */
var start = function(opts) {
  document.addEventListener('DOMContentLoaded', function() {
    var videos = document.getElementsByTagName('video')
    for(var i = 0; i < videos.length; ++i) {
      parseVideoTag(opts, videos[i])
    }
  })
}

/**
 * Finds all video tag and try to find the source file on the mesh
 *
 * @param {Object} opts
 * @param {HTMLMediaElement} videoTag
 */
var parseVideoTag = function(opts, videoTag) {
  var source = videoTag.src
  videoTag.removeAttribute('src')
  var peer = new Peer(opts)
  peer.addMedia(source, videoTag, true)
  // DEBUG
  window.peer = peer
}

module.exports = {
  Media: Media,
  Peer: Peer,
  PeerConnection: PeerConnection,
  Signal: Signal,
  start: start,
  util: require('./util.js'),
  datachannel: require('./dataChannel.js')
}

// Global namespace export
window.paradone = module.exports

// Additional type definitions
/**
 * @typedef {Object} Info
 * @property {string} url - URL of the media
 * @property {number} parts - Number of parts for the whole media
 * @property {number} size - Size of the file
 * @property {Array.<number>} available - Numbers of parts locally possessed
 * @property {Remote} remote - Availability of parts on known peers
 */

/**
 * @typedef {Object} Message
 * @property {string} type - message type
 * @property {string} from - id of the sender
 * @property {string} to - id of the recipient (-1 for broadcast)
 * @property {number} ttl - "time to live", maximum number of forwarding
 * @property {Array.<string>} forwardBy - Id of peers which already have
 *           forwarded the message
 * @property {Object} [data] - Data of the message (media extension related)
 * @property {string} [url] - URL of the desired media
 * @property {number} [number] - Number of the part transmitted in
 *           `request-part` and `part` messages
 */

/**
 * @typedef {Object.<string, Array.<number>>} Remote
 * Map a peer ID to an array of possessed parts number
 */
