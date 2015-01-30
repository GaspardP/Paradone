/* @flow weak */
'use strict';

var Media = require('./media.js')
var Peer = require('./peer.js')
var PeerConnection = require('./peerConnection.js')
var Signal = require('./signal.js')

/**
 *
 *
 * @param config {config}
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
  start: start
}
// Global namespace
window.paradone = module.exports
