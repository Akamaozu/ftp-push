var express, ftp, fs, request, noticeboard,
    server, app;

    noticeboard = require('cjs-noticeboard');
    express = require('express');
    request = require('request');
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

// configure server
    server = express();

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

// load html
    fs.readFile('./bin/index.html', 'utf8', function(err, data){

        if(err){ 
        
            app.log('\nERROR: HTML NOT LOADED', '\n  | \n  |-> fs.readFile\n\n', err); 
            return; 
        }

        else app.notify('html-loaded', data, 'fs-readfile');
    });