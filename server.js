var express, http, socketio, ftp, 
    fs, request, compression, noticeboard, path, 
    server, app, io;

    noticeboard = require('cjs-noticeboard');
    compression = require('compression');
    bodyparser = require('body-parser');
    socketio = require('socket.io');
    express = require('express')();
    request = require('request');
    multer = require('multer');
    http = require('http');
    path = require('path');
    ftp = require('ftp');
    fs = require('fs');

// configure app
    app = new noticeboard();

    // pipe app log to console
        app.watch('log-entry', 'node-console', function(msg){

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
              requester, resource, filename, extension,
              report;
              
              report = {};
              report.completed = false;
              report.success = false;

              request_struct = msg.notice;

              filename = request_struct.rename || path.basename(request_struct.resource);
              extension = path.extname(request_struct.resource);
              requester = request_struct.requester;
              resource = request_struct.resource;

          // update requester
            report.msg = "downloading file to my server -- this may take a moment"
            requester.emit('status', report);

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

                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                    month = (month < 10 ? "0" : "") + month;
                
                var path = 'wp-content/uploads/' + year + '/' + month + '/';
                var file = (filename + '_wadup_com_ng').replace(/[^a-zA-Z0-9]/g,'_').replace(/_{2,}/g,"_").toLowerCase(); 
                    file = file + extension;

                report.completed = false;
                report.msg = 'downloaded to my server -- now pushing to yours';
                report.url = 'http://wadup.com.ng/' + path + file;
                
                requester.emit('status', report);

                app.notify('resource-downloaded', {
                  
                  content: body,
                  path: 'wp-content/uploads/' + year + '/' + month + '/' + file,
                  requester: requester
                }, 'express-push-endpoint');
              }
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

// configure server
    server = http.Server( express );

    // compress responses
        express.use( compression() );

    // start server
        app.watch('html-loaded', 'start-server', function(){

            server.listen(3000);

            app.log('SERVER STARTED!');
        });

    // root path
        express.get('/', function(req, res){

            var process = 'express';

            app.log('\n"/" PATH REQUESTED');
            
            app.watch('html-loaded', process + ':serve-html', function(msg){

                var response, html;

                    response = msg.watcher;
                    html = msg.notice;

                response.send( html );
            
            }, {message: res, useCache: true});
        });

    // img dir path
        express.get('/img/:image', function(req, res){ 

          res.sendFile(req.params.image, {root: __dirname + '/img/'});
        });

// configure socket
    io = socketio( server );

    // new connection        
        io.on('connection', function(socket){
          
          // message from connection
              socket.on('ftp-push', function(request){

                var this_socket = this;

                app.log('PUSH REQUEST:', request);

                request.requester = this_socket;

                app.notify('push-request', request, 'socket.io');
              });
        });

// load html
    fs.readFile('./bin/index.html', 'utf8', function(err, data){

        if(err){ 
        
            app.log('\nERROR: HTML NOT LOADED', '\n  | \n  |-> fs.readFile\n\n', err); 
            return; 
        }

        else app.notify('html-loaded', data, 'fs-readfile');
    });

// load ftp credentials
  fs.readFile('./ftpcredentials.json', 'utf8', function(err, data){
    if (err){
      
      app.log('\nERROR: FTPCREDENTIALS NOT LOADED', '\n  | \n  |-> fs.readFile(\'./ftpcredentials.json\')\n\n', err); 
      return; 
    }

    else {

      var ftpcredentials = JSON.parse(data);
      app.notify('ftp-credentials-loaded', ftpcredentials, 'fs-readfile');
    }      
  });