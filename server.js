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

            console.log( msg.notice[0] );
        });

// configure server
    server = express();

    // start server
        app.watch('template-loaded', 'start-server', function(){

            server.listen(3000);

            app.log('SERVER STARTED!');
        });

    // default path
        server.get('/', function(req, res){

            var process = 'express';

            app.log('\n"/" PATH REQUESTED');
            
            app.watch('template-loaded', process + ':serve-app-ui', function(msg){

                var response, template;

                response = msg.watcher;
                template = msg.notice;

                response.send( template );
            
            }, {message: res, useCache: true});
        });

// load template
    fs.readFile('./templates/index.html', 'utf8', function(err, data){

        if(err){ app.log('error: ', err); return; }

        else app.notify('template-loaded', data, 'fs-readfile');
    });