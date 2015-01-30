/* @flow weak */
'use strict';

var Media = require('../src/media.js')
var media
var url = 'url/to/my.file'
var buildInfo = function(nbParts, available, remote) {
  return {
    url: url,
    parts: nbParts,
    size: 250,
    available: available,
    remote: remote
  }
}

describe('Media', function() {

  beforeEach(function(done) {
    media = new Media(url, null, false)
    done()
  })

  describe('#peerHasPart', function() {
    it('should have no parts', function() {
      media.info = buildInfo(3, [], {})
      media.peerHasPart(0).should.be.false()
      media.peerHasPart(-1).should.be.false()
      media.peerHasPart(1).should.be.false()
      media.peerHasPart(10).should.be.false()
    })

    it('should have part n°7', function() {
      media.info = buildInfo(10, [7], {})

      media.peerHasPart(7).should.be.true()

      media.peerHasPart(0).should.be.false()
      media.peerHasPart(-1).should.be.false()
      media.peerHasPart(10).should.be.false()
    })

    it('should have multiple continous parts', function() {
      media.info = buildInfo(5, [0, 1, 2, 3], {})

      media.peerHasPart(0).should.be.true()
      media.peerHasPart(1).should.be.true()
      media.peerHasPart(2).should.be.true()
      media.peerHasPart(3).should.be.true()

      media.peerHasPart(4).should.be.false()
      media.peerHasPart(5).should.be.false()
      media.peerHasPart(-1).should.be.false()
      media.peerHasPart(10).should.be.false()
    })

    it('should have multiple discontinous parts', function() {
      media.info = buildInfo(10, [0, 3, 4, 7], {})

      media.peerHasPart(0).should.be.true()
      media.peerHasPart(3).should.be.true()
      media.peerHasPart(4).should.be.true()
      media.peerHasPart(7).should.be.true()

      media.peerHasPart(-1).should.be.false()
      media.peerHasPart(10).should.be.false()
    })

    it('should have all the parts', function() {
      media.info = buildInfo(3, [0, 1, 2], {})

      media.peerHasPart(0).should.be.true()
      media.peerHasPart(1).should.be.true()
      media.peerHasPart(2).should.be.true()

      media.peerHasPart(-1).should.be.false()
      media.peerHasPart(10).should.be.false()
    })
  })

  describe('#remoteHasPart', function() {
    it('should have no parts if there is no known peers', function() {
      media.info = buildInfo(3, [], {})
      media.remoteHasPart(1, 0).should.be.false()
      media.remoteHasPart(1, 1).should.be.false()
    })

    it('should find the parts for one peer', function() {
      media.info = buildInfo(3, [1], {1: [0, 1, 4, 5]})

      media.remoteHasPart(1, 1).should.be.true()

      media.remoteHasPart(1, 2).should.be.false()
      media.remoteHasPart(2, 1).should.be.false()
    })

    it('should find parts for multiple peers', function() {
      media.info = buildInfo(5, [1, 2, 3], {2: [0, 2, 4], 5: [1, 2]})

      media.remoteHasPart(2, 0).should.be.true()
      media.remoteHasPart(2, 2).should.be.true()
      media.remoteHasPart(2, 4).should.be.true()
      media.remoteHasPart(5, 1).should.be.true()
      media.remoteHasPart(5, 2).should.be.true()

      media.remoteHasPart(3, 0).should.be.false()
      media.remoteHasPart(2, 1).should.be.false()
      media.remoteHasPart(5, 3).should.be.false()
    })
  })

  describe('#nextPartsToDownload', function() {
    it('should give three parts from peer n°1', function() {
      var infoOnepeerFullparts = buildInfo(5, [], {1: [0, 1, 2, 3, 4]})

      media.info = infoOnepeerFullparts
      var nextParts = media.nextPartsToDownload(3)
      expect(nextParts).not.to.be.null()
      expect(Array.isArray(nextParts)).to.be.true()
      nextParts.should.have.length(3)
    })

    it('should give three parts possibly form different peers', function() {
      var infoOnepeerFullparts = buildInfo(5, [], {
        1: [1, 2, 5],
        3: [0, 1, 3, 4]
      })

      media.info = infoOnepeerFullparts
      var nextParts = media.nextPartsToDownload(3)
      expect(nextParts).not.to.be.null()
      expect(Array.isArray(nextParts)).to.be.true()
      nextParts.should.have.length(3)
    })

  })

})
