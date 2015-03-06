/* global __dirname */
'use strict';
var gulp = require('gulp')
var uglify = require('gulp-uglify')
var browserify = require('browserify')
var karma = require('karma')
var buffer = require('vinyl-buffer')
var source = require('vinyl-source-stream')
var watchify = require('watchify')

var sources = './src/'
var mainFile = './src/main.js'
var destPath = './dist/'
var destFile = 'paradone.js'
// var dest = destPath + destFile
var karmaConf = __dirname + '/karma.conf.js'

gulp.task('default', function() {
  console.info('usage: npm run <command>\n' +
               '       gulp <command>\n\n' +
               '  build   Concatenate and minify the script\n' +
               '  debug   Auto-build on save with source-map\n' +
               '  test    Run the tests on the source files\n' +
               '  watch   Run tests on file change\n')
})

gulp.task('build', function() {
  console.info('Building `' + destPath + destFile + '`')
  return browserify(mainFile, {
    fullPaths: false,
    debug: false,
    baseDir: sources
  }).bundle()
    .pipe(source(destFile))
    .pipe(buffer())
    .pipe(uglify({preserveComments: 'some'}))
    .pipe(gulp.dest(destPath))
})

gulp.task('debug', function() {
  var opts = watchify.args
  opts.fullPaths = false
  opts.baseDir = sources
  opts.debug = true

  var bundler = watchify(browserify(mainFile, opts))
  var rebundle = function() {
    return bundler.bundle()
      .pipe(source(destFile))
      .pipe(gulp.dest(destPath))
  }

  bundler.on('update', rebundle)
  return rebundle()
})

/**
 * Run the test once the existing Karma server
 */
gulp.task('test', function(done) {
  karma.server.start({
    configFile: karmaConf,
    port: 9877,
    autoWatch: false,
    singleRun: true
  }, done)
})

/**
 * Watch source files and test modifications on file save.
 */
gulp.task('watch', function(done) {
  karma.server.start({
    configFile: karmaConf
  }, done)
})
