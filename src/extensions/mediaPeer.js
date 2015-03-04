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
module.exports = (function() {
  'use strict'
  var Media = require('../media.js')

  /**
   * Set a new media we need to leech
   *
   * @param {string} src - URL for the fie
   * @param {HTMLMediaElement} tag - Element in which the media should be played
   * @param {boolean} autoload - Whether or not the file should be played when
   *        the download is over
   */
  var addMedia = function(src, tag, autoload) {
    if(!this.files.has(src)) {
      // Track the file
      var media = new Media(src, tag, autoload)

      // TODO Check for the local storage?
      this.requestPeer(src)

      // If no peer give answers within 5 seconds the file will be downloaded
      // directly from the server
      media.startDownloadTimeout()

      this.files.set(src, media)
    }
    // TODO Else could be a new tag for the media
  }

  /**
   * Return the next part a peer should ask based on the metadata of a media and
   * the already downloaded parts.
   *
   * @param {Media} media - Media file from which the peer possesses at-least
   *        the meta-data
   * @param {number} nbParts - number of parts to be returned
   */
  var askForNextParts = function(media, nbParts) {
    media.nextPartsToDownload(nbParts)
      .forEach(function sendRequest(info) {
        var remote = info[0]
        var partNumber = info[1]
        console.info('Asking for part', partNumber, 'to peer', remote)
        this.send({
          type: 'request-part',
          from: this.id,
          to: remote,
          url: media.url,
          ttl: 3,
          forwardBy: [],
          number: partNumber
        })
        media.pendingParts.push(partNumber)
      }, this)
  }

  /**
   * Handle when the channel is openned
   *
   * @event MediaPeer#onconnected
   * @param {string} remotePeer - Id of the remote peer we just connected to
   */
  var onconnected = function(message) {
    var remotePeer = message.from
    // We want to know which files the neighbour has
    this.files.forEach(function(file) {
      if(!file.complete) {
        console.info('Asking for media info', file.url, 'to remote', remotePeer)
        this.connections.get(remotePeer).send({
          type: 'request-info',
          from: this.id,
          to: remotePeer,
          url: file.url,
          forwardBy: []
        })
      }
    }, this)
  }

  /**
   * Store the information of the file and updates the information on the
   * mediafile
   *
   * @event MediaPeer#oninfo
   * @param {Message} message - An info type message containing meta-data about
   *        the media file the node needs
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
   * Message containing a part of the desired media
   *
   * @event MediaPeer#onpart
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
   * The remote node request the info of a file (size, number of parts). We
   * return this information and the local parts we have in case he's interested
   *
   * @event MediaPeer#onrequestinfo
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
   * @event MediaPeer#onrequestpart
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

  /**
   * @mixin A media peer implements the functions used to share and retrieve
   *        media files on the mesh
   *
   * @constructor
   * @property {Media} files - Map of files indexed by url
   */
  return function MediaPeer(parameters) {
    this.on('connected', onconnected)
    this.on('request-info', onrequestinfo)
    this.on('info', oninfo)
    this.on('request-part', onrequestpart)
    this.on('part', onpart)

    this.files = new Map()
    this.askForNextParts = askForNextParts
    this.addMedia = addMedia

    // Check out if there are any local files we can seed
    var peer = this
    Media.forEachStoredMedia((function(mediafile) {
      peer.files.set(mediafile.url, mediafile)
    }))

    if(parameters.hasOwnProperty('downloadTimeout')) {
      Media.downloadTimeout = parameters.downloadTimeout
    }

    return this
  }

})()
