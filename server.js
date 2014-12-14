var express, ftp, fs, request, compression, noticeboard, bodyparser, multer, path,
    server, app;

    noticeboard = require('cjs-noticeboard');
    compression = require('compression');
    bodyparser = require('body-parser');
    express = require('express');
    request = require('request');
    multer = require('multer');
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
  
    // do ftp-push
        app.watch('resource-downloaded', 'ftp-pusher', function(msg){

          var ftp_client, resource_struct;

          resource_struct = msg.notice;
          ftp_client = new ftp();
            
          ftp_client.on('ready', function() {

            ftp_client.put( resource_struct.content, resource_struct.path + resource_struct.name, function(err) {
              
              if (err) throw err;
              ftp_client.end();
              app.log('PUSH SUCCESSFUL!\n', resource_struct.path + resource_struct.name);
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
    server = express();

    // compress responses
        server.use( compression() );

    // handle incoming requests
        server.use(bodyparser.urlencoded({ extended: true }));
        server.use(multer());

    // start server
        app.watch('html-loaded', 'start-server', function(){

            server.listen(3000);

            app.log('SERVER STARTED!');
        });

    // root path
        server.get('/', function(req, res){

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
        server.get('/img/:image', function(req, res){ 

          res.sendFile(req.params.image, {root: __dirname + '/img/'});
        });

    // push path
        server.post('/push/', function(req, res){ 

            var report, filename, extension;

            report = {};
            report.success = false;

          app.log('\n"/push/" ENDPOINT HIT', '\n  | \n  |-> payload\n\n', req.body);

          // prevent response from being cached
            res.set({

              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });

          // filter
            if(!req.body.resource){ 

              report.msg = 'malformed request -- nothing will be pushed';
              res.send( report );
              return;
            }

            filename = req.body.rename || path.basename(req.body.resource);
            extension = path.extname(req.body.resource);

          // clean file name
            filename = filename.replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,"_").toLowerCase();

          // fetch remote resource
            request({

              url:req.body.resource,
              encoding: null

            }, function (error, response, body) {
              
              if(error || response.statusCode !== 200){
                
                report.msg = 'could not download it -- try again please';
                res.send( report );
              }

              else{


                var now = new Date();

                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                month = (month < 10 ? "0" : "") + month;
                var path = 'wp-content/uploads/' + year + '/' + month + '/';
                var file = filename + '_wadup_com_ng' + extension;


                report.success = true;
                report.msg = 'downloaded to my server -- now pushing to yours';
                report.url = 'http://wadup.com.ng/' + path + file;
                res.send( report );

                app.notify('resource-downloaded', {
                  
                  content: body,
                  year: year,
                  month: month,
                  path: 'wp-content/uploads/' + year + '/' + month + '/',
                  name: file
                }, 'express-push-endpoint');
              }
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
      
      app.log('\nERROR: FTPCREDENTIALS NOT LOADED', '\n  | \n  |-> fs.readFile\n\n', err); 
      return; 
    }

    else {

      var ftpcredentials = JSON.parse(data);
      app.notify('ftp-credentials-loaded', ftpcredentials, 'fs-readfile');
    }      
  });