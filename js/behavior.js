(function(){

    var noticeboard, app, socketio;

        noticeboard = require('cjs-noticeboard');
        socketio = require('socket.io-client')();
        
    // init app
        app = new noticeboard();

    // configure app

        // pipe logs to console
            app.watch('log-entry', 'browser-console', function(msg){

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

    // configure socket  

        // status report
            socketio.on('status', function(report){

                var success, completed, message, state;

                    completed = report.completed;
                    success = report.success;
                    message = report.msg;

                alert( message );

                if(success){

                    addClass(document.getElementById('task-wrapper'), 'hidden');
                    removeClass(document.getElementById('update-wrapper'), 'hidden');

                    document.getElementById('url-to-use').value = report.url;
                }
            });


    document.getElementById('push-url').addEventListener('click', function(){
        
        var url_to_push, new_filename;

            url_to_push = document.getElementById('url-to-push').value;
            new_filename = document.getElementById('filename').value;

        if(!url_to_push){ alert('you haven\'t given me a URL to push'); return; }

        socketio.emit('ftp-push', {resource: url_to_push, rename: new_filename});

        addClass(document.getElementById('push-url'), 'hidden');
    });

    document.getElementById('url-to-use').addEventListener('focus', function(){

        var this_input = this;

        this_input.select();
    });

// check if class exists
    function hasClass(element, nameOfClass){

        return element.className.match(new RegExp('(\\s|^)'+nameOfClass+'(\\s|$)'));
    }

// add class if it doesn't exist
    function addClass(element, nameOfClass){
    
        if ( !hasClass(element, nameOfClass) ){
            
            element.className += " "+nameOfClass;
        }
    }

// remove class if it exists
    function removeClass(element, nameOfClass){
    
        if ( hasClass(element, nameOfClass) ){
            
            var reg = new RegExp('(\\s|^)'+nameOfClass+'(\\s|$)');
            element.className=element.className.replace(reg,'');
        }
    }
}());