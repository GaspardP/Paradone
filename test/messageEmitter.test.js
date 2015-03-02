/* @flow weak */
'use strict';

var ME = require('../src/messageEmitter.js')
window.ME = ME

describe('MessageEmitter', function() {
  describe('@constructor', function() {
    it('should have an empty map of listeners', function() {
      var me = new ME()
      expect(me.listenerCount()).to.be.eq(0)
    })
  })

  describe('#on', function() {
    var me
    var noop = function() {}

    beforeEach(function() {
      me = new ME()
    })

    it('should add one listener', function() {
      me.on('something', noop)
      expect(me.listenerCount()).to.be.eq(1)
    })

    it('should add different listeners to different types', function() {
      var noop1 = function() {}
      var noop2 = function() {}
      var noop3 = function() {}
      me.on('something', noop1)
        .on('something else', noop2)
        .on('third', noop3)
      expect(me.listenerCount()).to.be.eq(3)
    })

    it('should add different listeners to the same type', function() {
      var noop1 = function() {}
      var noop2 = function() {}
      var noop3 = function() {}
      me.on('same', noop1)
        .on('same', noop2)
        .on('same', noop3)
      expect(me.listenerCount()).to.be.eq(3)
    })

    it('should not add twice the same listener for the same type', function() {
      me.on('same thing', noop)
        .on('same thing', noop)
      expect(me.listenerCount()).to.be.eq(1)
    })
  })

  describe('#once', function() {
    var me, check

    beforeEach(function() {
      me = new ME()
      check = false
      me.once('onlyonce', function() {
        check = true
      })
    })

    it('should add a listener', function() {
      expect(me.listenerCount()).to.be.eq(1)
    })

    it('should trigger the listener', function() {
      me.emit({type: 'onlyonce'})
      expect(me.listenerCount()).to.be.eq(0)
      expect(check).to.be.true()

    })

    it('should remove the listenenr', function() {
      me.emit({type: 'onlyonce'})
      expect(me.listenerCount()).to.be.eq(0)
    })
  })

  describe('#removeListener', function() {
    it('should not leave the listener', function() {
      var me = new ME()
      var noop = function() {}
      me.on('type', noop)
      me.removeListener('type', noop)
      expect(me.listenerCount()).to.be.eq(0)
    })

    it('it should not remove other listeners', function() {
      var me = new ME()
      var noop1 = function() {}
      var noop2 = function() {}
      var noop3 = function() {}
      me.on('type', noop1)
      me.on('type', noop2)
      me.on('other', noop3)
      me.removeListener('type', noop1)
      expect(me.listenerCount()).to.be.eq(2)
    })

    it('it should not remove non existing listener', function() {
      var me = new ME()
      var noop1 = function() {}
      var noop2 = function() {}
      var noop3 = function() {}
      me.on('type', noop1)
      me.on('type', noop2)
      me.removeListener('type', noop3)
      expect(me.listenerCount()).to.be.eq(2)
    })
  })

  describe('#removeAllListeners', function() {
    it('should not do anything on empty ME', function() {
      var me = new ME()
      me.removeAllListeners()
      expect(me.listenerCount()).to.be.eq(0)
    })

    it('should remove everything (single listener)', function() {
      var me = new ME()
      me.on('single', function() {})
      me.removeAllListeners()
      expect(me.listenerCount()).to.be.eq(0)
    })

    it('should remove everything (single listener)', function() {
      var me = new ME()
      me.on('multi', function() {})
      me.on('multi', function() {})
      me.on('multi2', function() {})
      me.removeAllListeners()
      expect(me.listenerCount()).to.be.eq(0)
    })

  })

  describe('#emit', function() {
    it('should trigger the only listener', function() {
      var me = new ME()
      var check1 = false
      var check2 = false
      var l1 = function() {
        check1 = true
      }
      var l2 = function() {
        check2 = true
      }
      me.on('type', l1)
        .on('type2', l2)
      me.emit({type: 'type'})
      expect(check1).to.be.true()
      expect(check2).to.be.false()
    })

    it('should trigger every listener of the same type', function() {
      var me = new ME()
      var check1 = false
      var check2 = false
      var l1 = function() {
        check1 = true
      }
      var l2 = function() {
        check2 = true
      }
      me.on('type', l1)
        .on('type', l2)
      me.emit({type: 'type'})
      expect(check1).to.be.true()
      expect(check2).to.be.true()
    })

  })
})
