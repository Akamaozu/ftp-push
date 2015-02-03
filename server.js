var express, http, socketio, ftp, 
    fs, compression, noticeboard, stream,
    server, app, logger, io;

    noticeboard = require('cjs-noticeboard');
    compression = require('compression');
    socketio = require('socket.io');
    express = require('express')();
    http = require('http');
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
    /* UPGRADE: Externalize FTP Pusher to its own server
        - DO NOT DOWNLOAD before dropping on queue
        - pick requests from queue
        - connect to client
        - give client progress updates
    */
        app.watch('push-request', 'ftp-pusher', function(msg){ 

          var task, task_order, current_task_index, request_struct,
              start_time, finish_time;

              request_struct = msg.notice;

              start_time = Date.now();

              task_order = [

                'format-file-name',
                'get-resource-data',
                'ftp-connect',
                'verify-destination-path',
                'start-push'
              ];

          // CONFIGURE TASK
              task = new noticeboard({logging: false});

              // alias start-task
                  task.once('start-task', 'ftp-push-task', function(){

                    var requester = request_struct.requester;

                    requester.emit('status', {msg: 'PREPARING TO PUSH'});

                    current_task_index = 0;

                    task.notify( task_order[ current_task_index ] );                    
                  });

              // alias next-task
                  task.watch('next-task', 'ftp-push-task', function(){

                    var requester, task_length; 

                        requester = request_struct.requester;
                        task_length = task_order.length;
                        setup_length = task_length - 1;

                    current_task_index += 1;

                    if(current_task_index > (task_length - 1)) return;

                    if(current_task_index <= (setup_length - 1)){

                      requester.emit('status', {setup: ((current_task_index / (setup_length - 1)) * 100).toFixed() });
                    }

                    task.notify( task_order[ current_task_index ] );
                  });

              // setup task 'format-file-name'
                  task.once('format-file-name', 'ftp-push-task', function(){

                    var filename, path;
                        
                        path = require('path'); 
                        
                    // get file name
                        filename = request_struct.rename || path.basename(request_struct.resource);

                    // lowercase file name
                        filename = filename.toLowerCase();

                    // append "tag"
                        filename += '_wadup_com_ng';

                    // replace special characters with underscore
                        filename = filename.replace(/[^a-zA-Z0-9]/g,'_');

                    // remove concurrent underscores
                        filename = filename.replace(/_{2,}/g,"_");

                    // store formatted name
                        task.notify('file-name', filename);

                    task.notify('next-task');
                  });

              // setup task 'ftp-connect'
                  task.once('ftp-connect', 'ftp-push-task', function(){

                    var ftp_client = new ftp();

                    ftp_client.on('ready', function(){
                      
                      task.notify('ftp-client', ftp_client);
                      task.notify('next-task');
                    });
          
                    app.once('ftp-credentials-loaded', 'ftp-connect', function(ftp_msg){

                      var credentials = ftp_msg.notice;

                      ftp_client.connect( credentials );
                    },{useCache: true});
                  });

              // setup task: 'verify-destination-path'
                  task.once('verify-destination-path', 'ftp-push-task', function(){

                    var ftp_client, now, year, month, 
                        path, path_index;

                        ftp_client = task.cache['ftp-client'];

                        now = new Date();
                        year = now.getFullYear();
                        month = now.getMonth() + 1;
                        month = (month < 10 ? "0" : "") + month;
                        
                        path = '/wp-content/uploads/' + year + '/' + month + '/';

                    ftp_client.mkdir(path, true, function(err){

                      if(err){

                        logger.log(err);                        
                        ftp_client.end();
                      }

                      else {

                        task.notify('file-path', path);
                        task.notify('next-task');
                      }
                    });                      
                  });

              // setup task 'get-resource-data'
                  task.once('get-resource-data', 'ftp-push-task', function(){

                    var request, resource, requester;

                        request = require('request');

                        resource = request_struct.resource;
                        requester = request_struct.requester;

                    request.head(resource).on('response', function(response){

                      var prettysize, mime, filesize, pretty_filesize, file_extension, report;

                          prettysize = require('prettysize');
                          mime = require('mime-types');

                          filesize = response.headers['content-length'];
                          pretty_filesize = prettysize( filesize );
                          file_extension = mime.extension( response.headers['content-type']);
              
                          report = {};
                          report.success = false;
                          report.completed = false;

                      report.size = pretty_filesize;

                      requester.emit('status', (report) );
                      delete report.size;

                      task.notify('file-size', filesize );
                      task.notify('pretty-filesize', pretty_filesize );
                      task.notify('file-extension', file_extension );
                      task.notify('status-report', report );

                      task.notify('next-task');
                    });
                  });

              // setup task 'start-push'
                  task.once('start-push', 'ftp-push-task', function(){

                    var ftp_client, filepath, filename, extension,
                        request, requester, resource,
                        extension,
                        total_size, bytes_downloaded, downloaded_percent,
                        report;

                        bytes_downloaded = 0;

                        ftp_client = task.cache['ftp-client'];

                        filepath = task.cache['file-path'];
                        filename = task.cache['file-name'];
                        extension = task.cache['file-extension'];
                        total_size = task.cache['file-size'];
                        report = task.cache['status-report'];

                        request = require('request');

                        requester = request_struct.requester;
                        resource = request_struct.resource;

                    // update requester
                        report.msg = "PUSHING TO YOUR SERVER";            
                        requester.emit('status', (report) );
                        delete report.msg;

                    // stream resource
                        ftp_client.put(

                            request({

                              url: resource,
                              encoding: null
                            }, function (error, response, body) {
                              
                              if(error){
                                
                                report.completed = true;
                                report.msg = 'could not download file -- try again please';
                                
                                requester.emit('status', (report) );
                              }

                            }).on('data', function(data){

                              bytes_downloaded += data.length;

                              var progress_to_percent = ((bytes_downloaded / total_size) * 100).toFixed();

                              if(progress_to_percent !== downloaded_percent){

                                downloaded_percent = progress_to_percent;

                                report.downloaded = downloaded_percent;

                                requester.emit('status', report);  
                              }
                          }), 

                          filepath + '/' + filename + '.' + extension, function(err) {
                            
                            if (err) throw err;

                            finish_time = Date.now();

                            ftp_client.end();                  
                            
                            requester.emit('status', {

                              url: 'http://wadup.com.ng' + filepath +  filename + '.' + extension,
                              msg: 'PUSH SUCCESSFUL!',
                              success: true,
                              completed: true
                            });

                            logger.log('* PUSHED ' + task.cache['pretty-filesize'] + ' IN ' + (finish_time - start_time) + 'ms');
                          });
                  })

          // START TASK
            task.notify('start-task');
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

                logger.log('* NEW PUSH REQUEST');
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