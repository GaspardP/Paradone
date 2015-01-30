/* global __dirname */
'use strict';
var gulp = require('gulp')
var browserify = require('browserify')
var karma = require('karma')
var kbg = require('karma-background')
var source = require('vinyl-source-stream')
var watchify = require('watchify')

var sources = './src/'
var mainFile = './src/main.js'
var destPath = './dist/'
var destFile = 'paradone.js'
// var dest = destPath + destFile
var karmaConf = __dirname + '/karma.conf.js'

gulp.task('default', ['test-watch'], function() {
  return gulp.src('')
})

gulp.task('build', function() {
  console.info('Building `' + destPath + destFile + '`')
  return browserify(mainFile, {
    fullPaths: false,
    debug: false,
    baseDir: sources
  }).bundle()
    .pipe(source(destFile))
    .pipe(gulp.dest(destPath))
})

gulp.task('watch', function() {
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
 * Initiate
 */
gulp.task('test', function(done) {
  karma.server.start({
    port: 9876,
    configFile: karmaConf
  }, done)
})

/**
 * Start Karma Server in background. We need to get the prompt back if we want
 * to finish the task. kbg creates a sub child process before starting the
 * server
 */
gulp.task('karma-start', function() {
  kbg({ configFile: karmaConf })
})

/**
 * Run the test on the existing Karma server
 */
gulp.task('karma-run', function(done) {
  karma.runner.run({ port: 9876 }, done)
})
