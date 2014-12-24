var express, http, socketio, ftp, 
    fs, request, compression, noticeboard, path, mime, prettysize,
    server, app, logger, io;

    noticeboard = require('cjs-noticeboard');
    compression = require('compression');
    bodyparser = require('body-parser');
    prettysize = require('prettysize');
    socketio = require('socket.io');
    express = require('express')();
    mime = require('mime-types');
    request = require('request');
    multer = require('multer');
    http = require('http');
    path = require('path');
    ftp = require('ftp');
    fs = require('fs');

// configure app
    app = new noticeboard({logging: false});
    logger = new noticeboard();

    // pipe logger to console
        logger.watch('log-entry', 'node-console', function(msg){

            var entry = msg.notice;

            // filter
                if(typeof entry.length === 'undefined' || entry.length < 1){ return; }

            // format output
                switch(entry.length){

                    case 1: 
                        console.log( entry[0] );
                        break;

                    default:
                        console.log.apply(console, entry);
                        break;
                }
        });

    // handle ftp-push request
        app.watch('push-request', 'ftp-pusher', function(msg){ 

          var request_struct, 
              requester, resource, filename, 
              total_size, downloaded_so_far, downloaded_percent,
              report;
              
              report = {};
              report.completed = false;
              report.success = false;

              request_struct = msg.notice;

              filename = request_struct.rename || path.basename(request_struct.resource);
              filename = (filename + '_wadup_com_ng').replace(/[^a-zA-Z0-9]/g,'_').replace(/_{2,}/g,"_").toLowerCase();
              requester = request_struct.requester;
              resource = request_struct.resource;

          // update requester
            report.msg = "downloading file to my server -- this may take a moment";            
            requester.emit('status', (report) );

            delete report.msg;

          // fetch remote resource
            request({

              url: resource,
              encoding: null

            }, function (error, response, body) {
              
              if(error){
                
                report.completed = true;
                report.msg = 'could not download it -- try again please';
                
                requester.emit('status', report);
              }

              else{

                var now = new Date();

                var extension = mime.extension( response.headers['content-type'] );

                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                    month = (month < 10 ? "0" : "") + month;
                
                var path = 'wp-content/uploads/' + year + '/' + month + '/';
                var file = filename + '.' + extension;

                report.completed = false;
                report.msg = 'downloaded to my server -- now pushing to yours';
                report.url = 'http://wadup.com.ng/' + path + file;
                
                requester.emit('status', (report) );

                app.notify('resource-downloaded', {
                  
                  content: body,
                  path: path + file,
                  requester: requester
                }, 'express-push-endpoint');
              }
            }).on('response', function(response){

              downloaded_so_far = 0;
              total_size = response.headers['content-length'];

              report.size = prettysize( total_size );

              requester.emit('status', (report) );
            
            }).on('data', function(data){

              downloaded_so_far += data.length;

              var progress_to_percent = ((downloaded_so_far / total_size) * 100).toFixed();

              if(progress_to_percent !== downloaded_percent){

                downloaded_percent = progress_to_percent;

                report.downloaded = downloaded_percent;

                requester.emit('status', report);  
              }

              logger.log('download: ' + downloaded_so_far + '/' + total_size);
            });
        });   
  
    // do ftp-push
        app.watch('resource-downloaded', 'ftp-pusher', function(msg){

          var ftp_client, resource_struct;

          resource_struct = msg.notice;
          ftp_client = new ftp();
            
          ftp_client.on('ready', function(){

            ftp_client.put( resource_struct.content, resource_struct.path, function(err) {
              
              if (err) throw err;
              ftp_client.end();
              
              resource_struct.requester.emit('status', {

                url: 'http://wadup.com.ng/' +  resource_struct.path,
                msg: 'PUSH SUCCESSFUL!',
                success: true,
                completed: true
              });

            });
          });

          app.watch('ftp-credentials-loaded', 'ftp-pusher', function(message){

            var ftp, credentials;
                ftp = message.watcher;
                credentials = message.notice;

            ftp.connect( credentials );

          }, {useCache: true, message: ftp_client});
        });

    // process html request
        app.once('html-loaded', 'setup-html-request-handler', function(data){

          var html = data.notice;

          app.watch('html-requested', 'html-request-handler', function(msg){

            var request, html;
                request = msg.notice;
                html = msg.watcher;

            request.send( html );

          }, {message: html});
        },{useCache: true});

    // process logo request
        app.once('logo-loaded', 'setup-logo-request-handler', function(data){

          var logo = data.notice;

          app.watch('logo-requested', 'logo-request-handler', function(msg){

            var request, logo;
                request = msg.notice;
                logo = msg.watcher;

            request.send( logo );

          }, {message: logo});
        },{useCache: true});

// configure server
    server = http.Server( express );

    // compress responses
        express.use( compression() );

    // start server
        app.watch('html-loaded', 'start-server', function(){

            server.listen(3000);

            logger.log('SERVER STARTED!');
        });

    // root path
        express.get('/', function(request, response){

            var process, expires_duration;
                process = 'express';
                expires_duration = 60 * 5; // 5 Minutes

            // set cache control headers
                response.set('Cache-Control', 'max-age=' + expires_duration );
                response.set('Expires', new Date( (Date.now() + (expires_duration * 1000)) ).toUTCString());
            
            app.notify('html-requested', response, process);
        });

    // logo path
        express.get('/img/logo.png', function(request, response){

            var process, expires_duration;
                process = 'express';
                expires_duration = 60 * 60 * 24 * 5; // 5 Days

            // set type header
                response.type('png');

            // set cache control headers
                response.set('Cache-Control', 'max-age=' + expires_duration );
                response.set('Expires', new Date( (Date.now() + (expires_duration * 1000)) ).toUTCString());

            app.notify('logo-requested', response, process);
        });

// configure socket
    io = socketio( server );

    // new connection
        io.on('connection', function(socket){
          
          // message from connection
              socket.on('ftp-push', function(request){

                var this_socket = this;

                request.requester = this_socket;
                app.notify('push-request', request, 'socket.io');

                logger.log('PUSH REQUEST:', {url: request.resource, rename: request.rename});
              });
        });

// load html
    fs.readFile('./bin/index.html', 'utf8', function(err, html){

        if(err){ 
        
            logger.log('\nERROR: HTML NOT LOADED', '\n  | \n  |-> fs.readFile(\'./bin/index.html\')\n\n', err); 
            return; 
        }

        else app.notify('html-loaded', html, 'fs-readfile');
    });

// load logo
    fs.readFile('./img/logo.png', function(err, binary){

        if(err){ 
        
            logger.log('\nERROR: LOGO NOT LOADED', '\n  | \n  |-> fs.readFile(\'./img/logo.png\')\n\n', err); 
            return; 
        }

        else app.notify('logo-loaded', binary, 'fs-readfile');
    });

// load ftp credentials
  fs.readFile('./ftpcredentials.json', 'utf8', function(err, data){
    if (err){
      
      logger.log('\nERROR: FTPCREDENTIALS NOT LOADED', '\n  | \n  |-> fs.readFile(\'./ftpcredentials.json\')\n\n', err); 
      return; 
    }

    else {

      var ftpcredentials = JSON.parse(data);
      app.notify('ftp-credentials-loaded', ftpcredentials, 'fs-readfile');
    }      
  });


// HELPER FUNCTIONS
// ----------------

function object_each( obj, process_each ){

  var process_next;

  // filter
      if(Object.prototype.toString.call( obj ) !== '[object Object]' // obj is not an object
      || (process_each && typeof process_each !== 'function') // process_each is set but isn't a function
      ){ return false }

  for( var key in obj ){

    // skip inherited keys
        if( !obj.hasOwnProperty(key) ){ continue; }

    process_next = process_each( key, obj[key] );

    if(process_next === false){ return; }
  }
}