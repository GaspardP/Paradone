/* @flow weak */
'use strict';

var localforage = require('localforage')
var util = require('./util.js')
module.exports = Media

var MediaSource = window.MediaSource || window.WebKitMediaSource

localforage.config({
  name:'HEA',// DBName
  storeName:'VID', // datastore or table
  version:1.0,// Default
  description:'A test table'
})

// DEBUG Remove all previous data to enforce peer communication
localforage.clear()

/**
 * Special wrapping for promise related errors with line number
 * @param {Error} e Error object containing detailed information on the error
 */
var errorHandler = function(e) {
  var linenum = e.lineNumber
  return function(err) {
    console.warn('Error line ', linenum)
    console.error(err)
  }
}

/**
 * @constructor
 * @param url The source of the file
 * @param sourceTag The tag where the media should be displayed
 */
function Media(url, sourceTag, autoload) {
  this.url = url
  this.sourceTag = sourceTag
  this.info = {}
  this.complete = false
  this.pendingParts = []
  this.autoload = typeof autoload !== 'undefined' ? autoload : false
}

Media.chunkSize = 1000

Media.downloadTimeout = 3000 // Was 8000

// TODO Rename function
// TODO Inline call (une seule utilisation dans le reste du code ?)
/**
 * Apply function on an array of all locally stored medias
 * @param forEachStoredMedia {Function} Function applied to each file
 */
Media.forEachStoredMedia = function(forEachCallback) {
  localforage.keys(function(err, keys) {

    if(err) {
      throw err
    }

    // No errors: we get every info parts
    keys.filter(function(key) {
      return /-info$/.test(key)
    }).forEach(function(key) {
      localforage.getItem(key, function(err, info) {
        if(Array.isArray(info.available) &&
           info.parts === info.available.length) {
          // If the file is complete we apply the function
          // TODO Do not create a Media file
          var file = Media.createMediaFromInfo(info, false)
          forEachCallback(file)
        }
      })
    })
  })
}

/**
 * @param info {Object} Meta-data associated to the media
 * @param autoplay {boolean} Flag if media should be played immediatly after
 * download
 * @return a Media object from its meta-data. The media is marked as completed
 * indicating it should not be requested on the mesh.
 */
Media.createMediaFromInfo = function(info, autoplay) {
  var m = new Media(info.url, null, autoplay)
  m.info = info
  m.complete = true
  return m
}

/**
 * Action done when the file is complete. Here we start playing the media
 */
Media.prototype.isComplete = function(value) {
  this.complete = value
  if(value && this.autoload) {
    this.loadMediasourceFromStoredFile(this.sourceTag)
  }
}

/**
 * Start the timeout to download the file from the server
 */
Media.prototype.startDownloadTimeout = function() {
  this.sourceDownloadTimeout = window.setTimeout((function() {
    console.info('No peers offered a connection')
    this.clearDownloadTimeout()
    this.storeDistantFile()
  }).bind(this), Media.downloadTimeout)
}

/**
 * When we have a contact with other peers the timeout for server download can
 * be removed
 */
Media.prototype.clearDownloadTimeout = function() {
  this.sourceDownloadTimeout = null
}

/**
 * Called when the peer has source offer from peer and does not need
 * to download the file from the server
 */
Media.prototype.cancelServerDownload = function() {
  console.info('Download the file from peer')
  window.clearTimeout(this.sourceDownloadTimeout)
  this.clearDownloadTimeout()
}

/**
 * Get the file from the distant server
 */
Media.prototype.storeDistantFile = function() {
  return this.getRemoteFile(this.url, 'arraybuffer')
    .then(this.storeFileBuffer.bind(this, Media.chunkSize))
    .catch(function(e) {
      console.error('The file could not be stored', e)
    })
}

/**
 * Select next parts to be downloaded
 * Need to prevent multiple calls to this one
 */
Media.prototype.nextPartsToDownload = function(howMany) {
  // We ask for parts to multiple peers if possible
  //TODO Generators
  var nbParts = this.info.parts
  var needed = new Array(nbParts)

  /**
   * Get all peers possessing a specific part of the media and select one of
   * them randomly
   */
  var selectPeer = function(remotes, partNumber) {
    // Get all random peers
    var remoteIds = util.shuffleArray(Object.keys(remotes))
    // Take the first peer which has the desired part
    for(var j = 0; j < remoteIds.length; ++j) {
      var id = remoteIds[j]
      if(remotes[id].indexOf(partNumber) !== -1) {
        return [id, partNumber]
      }
    }
  }

  // All the possible parts
  for(var i = 0; i < nbParts; ++i) {
    needed[i] = i
  }

  return needed.filter(function(elt) {
    // Keep only parts we don't have
    return !this.peerHasPart(elt)
  }, this)
    .filter(function(elt) {
      // Remove pending parts
      return this.pendingParts.indexOf(elt) === -1
    }, this)
    .map(selectPeer.bind(null, this.info.remote)) // Select a peer for each part
    .filter(function(elt) {
      // Remove parts not found
      return typeof elt !== 'undefined'
    })
    .slice(0, howMany) // Keep the desired number of parts
}

/**
 * Check if a particular part is available on peer side
 * @param partNumber {integer}
 * @return {boolean} True if the peer has the part
 */
Media.prototype.peerHasPart = function(partNumber) {
  return this.info.available.indexOf(partNumber) !== -1
}

/**
 * Check if a remote peer has a particular part of a media. It is based on the
 * meta-data received through info-request and is not 100% accurate
 *
 * @param remotePeer {string} Which remote peer should be checked
 * @param partNumber {integer}
 * @return {boolean} True if the remote peer seems to possess the part
 */
Media.prototype.remoteHasPart = function(remotePeer, partNumber) {
  var remote = this.info.remote[remotePeer]
  if(typeof remote === 'undefined') {
    return false
  } else {
    return remote.indexOf(partNumber) !== -1
  }
}

/**
 * Return the result of a XHR as a promise. If the XHR succeed, the resolve
 * function of the promise will have the file requested as first parameter.
 *
 * @param {string} fileUrl
 * @return {Promise} a new Promise holding the file's URL and ArrayBuffer
 */
Media.prototype.getRemoteFile = function(fileUrl, responseType) {
  responseType = responseType || 'blob'

  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', fileUrl, true)
    xhr.responseType = responseType // Set the responseType to ArrayBuffer
    xhr.onreadystatechange = function() {
      if(this.readyState === this.DONE) {
        if(this.status === 200) {
          resolve(this.response)
        } else {
          reject(this)
        }
      }
    }
    xhr.send()
  })
}

/**
 * Better store it as splitted elements if you want to send it later

 * @param chunkSize {integer} Max size for a part. Depends on DataChannel's
 * limit
 * @param fileBuffer {ArrayBuffer} Buffer representing the file
 * @return a bunch of Promises
 */
Media.prototype.storeFileBuffer = function(chunkSize, fileBuffer) {
  var parts = Math.ceil(fileBuffer.byteLength / chunkSize)
  var promises = []

  // Save info for later
  // WARNING This needs to be processed before all parts are stored to
  //         activate the SourceMedia.
  promises.push(this.buildInfoFromLocal(fileBuffer.byteLength, parts))

  // Save the parts
  for(var i = 0; i < parts; ++i) {
    // TODO [Storage] Save as Uint8 Array?
    var aSlice = new Uint8Array(
      fileBuffer.slice(i * chunkSize, (i + 1) * chunkSize))
    promises.push(
      this.storeChunk(i, aSlice)
        .catch(errorHandler(new Error('Part ' + i + ' was not stored'))))
  }
  return Promise.all(promises)
}

/**
 * Define the file's information and store it locally
 * @return {Promise} A promise to store the info
 */
Media.prototype.buildInfoFromLocal = function(size, nbrParts) {
  var info = {
    url: this.url,
    parts: nbrParts,
    size: size,
    remote: {},
    available: []
  }

  this.info = info

  return this.storeInfo(info)
}

/**
 * Define information through extracting it from a message. If the info is not
 * defined yet we create it from the info message. We extract the available
 * parts on the remote peer and store it.  Finally we check if the remote peer
 * has some new information about availability of the file on the other nodes.
 *
 * @param info {Object} the data from an info message
 * @param from {string} id of the remote peer
 * @return {Promise} A promise to store the info
 */
Media.prototype.buildInfoFromRemote = function(info, from) {
  // Add local information
  if(!this.info.hasOwnProperty('url')) {
    this.info.url = info.url
    this.info.parts = info.parts
    this.info.size = info.size
    this.info.available = []
    this.info.remote = info.remote
  }

  // Save fresh information about remote peer
  this.info.remote[from] = info.available

  // Update data about other peers
  Object.keys(info.remote).forEach(function(remotePeer) {
    var availParts = info.remote[remotePeer]

    if(this.info.remote.hasOwnProperty(remotePeer)) {
      // The node already had some info about the peer. We add the
      // new available parts
      for(var i = 0; i < availParts.length; ++i) {
        var partNumber = availParts[i]
        if(this.info.remote[from].indexOf(partNumber) === -1) {
          this.info.remote[from].push(partNumber)
        }
      }
    } else {
      this.info.remote[from] = availParts
    }
  }, this)

  // Store everything
  return this.storeInfo(info)
}

/**
 * Update the info of the media and store it in local storage
 *
 * @param info {Object}
 * return {Promise}
 */
Media.prototype.storeInfo = function(info) {
  return localforage
    .setItem(info.url + '-info', info)
    .catch(function(e) {
      console.error(e)
    })
}

/**
 * Store a chunk of data associated to a part number
 *
 * @param partNumber {integer}
 * @param data The part of the media we need to store
 */
Media.prototype.storeChunk = function(partNumber, data) {

  // Remove part if it was pending
  var id = this.pendingParts.indexOf(partNumber)
  if(id !== -1) {
    delete this.pendingParts[id]
  }

  if(this.info.available.indexOf(partNumber) !== -1) {
    console.debug('Part already stored')
    return Promise.resolve()
  }

  this.info.available.push(partNumber)
  // Number of stored chunks
  var nbrAvail = this.info.available.length
  var retour = localforage.setItem(this.url + '-part' + partNumber, data)

  if(nbrAvail === this.info.parts) {
    console.info('Last part of the media has been stored')
    retour.then((function() {
      this.isComplete(true)
    }).bind(this))
  }

  return retour
}

/**
 * Get media information from local storage
 *
 * @return {Promise} Promise returning the info object as firest parameter
 */
Media.prototype.getInfo = function() {
  return localforage
    .getItem(this.url + '-info')
    .catch(function(e) {
      console.error(e)
    })
}

/**
 * Get a media chunk from local storage
 *
 * @param chunkNumber The number of the desired chunk
 * @return {Promise} Prmosie returning the chunk as first parameter
 */
Media.prototype.getChunk = function(chunkNumber) {
  return localforage
    .getItem(this.url + '-part' + chunkNumber)
    .catch(function(e) {
      console.error(e)
    })
}

/**
 *
 *
 * @params video the video tag where we want the file to be played
 * @params fileName the name of the local file
 */
Media.prototype.loadMediasourceFromStoredFile = function(video) {

  console.debug('Loading from storage')

  var mediaSource = new MediaSource()
  var fileUrl = this.url
  /**
   * We have to wait for the chunk to be completly written before appending the
   * next chunk ("updateended" event)
   */
  var readChunk = function(sourceBuffer, partNumber, lastNumber) {
    // Get the chunk from storage
    localforage.getItem(fileUrl + '-part' + partNumber).then(function(chunk) {
      // When current chunk will be written this event will be called
      sourceBuffer.addEventListener('updateend', function selfHandle() {
        // We remove this event to create a new one with updated values
        sourceBuffer.removeEventListener('updateend', selfHandle)
        if(partNumber < lastNumber) {
          // Some remaining chunks, we loop
          readChunk(sourceBuffer, partNumber + 1, lastNumber)
        } else {
          // Last chunk written in buffer, the stream is complete
          console.info('Media is fully loaded')
          mediaSource.endOfStream()
        }
      })
      // Write current chunk
      sourceBuffer.appendBuffer(chunk)
    }).catch(function(e) {
      console.error(e)
    });
  }

  // When mediaSource is ready we append the parts in a new source buffer.
  mediaSource.addEventListener('sourceopen', function() {
    localforage.getItem(fileUrl + '-info').then(function(info) {
      // TODO Check the codecs
      var codec = 'video/webm; codecs="vorbis, vp8"'
      var sourceBuffer = mediaSource.addSourceBuffer(codec)
      // Start recursion
      readChunk(sourceBuffer, 0, info.parts - 1)
    })
  }, false)

  // Triggers the "sourceopen" event of the MediaSource object
  video.src = window.URL.createObjectURL(mediaSource)
}
