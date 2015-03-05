/*
 * Copyright 2015 Paradone
 *
 * This file is part of Paradone <https://paradone.github.io>
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
'use strict'

module.exports = {
  /**
   * Special wrapping for promise related errors with line number
   * @param {Error} e - Contains detailed information on the error
   */
  error: function(e) {
    return function(err) {
      console.warn('Error line ', e.lineNumber)
      console.error(err)
    }
  },

  /**
   * Special definition for type extension and correct prototype chain
   */
  extend: function(base, sub) {
    // Also, do a recursive merge of two prototypes, so we don't overwrite the
    // existing prototype, but still maintain the inheritance chain
    var origProto = sub.prototype;
    sub.prototype = Object.create(base.prototype);

    Object.keys(origProto).forEach(function(key) {
      sub.prototype[key] = origProto[key];
    })

    // Remember the constructor property was set wrong, let's fix it
    sub.prototype.constructor = sub;
    // In ECMAScript5+ (all modern browsers), you can make the constructor
    // property non-enumerable if you define it like this instead
    Object.defineProperty(sub.prototype, 'constructor', {
      enumerable: false,
      value: sub
    });
  },

  /**
   * Shuffle an array
   * @param {Array} array
   * @param {Array} Same array with its elements shuffled
   */
  shuffleArray: function(array) {
    var i, j, temp
    for(i = array.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1))
      temp = array[i]
      array[i] = array[j]
      array[j] = temp
    }
    return array
  }
}
