(function(){

    var noticeboard, app, state, socketio;

        noticeboard = require('cjs-noticeboard');
        socketio = require('socket.io-client')();
        
    // init app
        app = new noticeboard();
        state = new noticeboard();
        state.notify('interface', 'input');
        state.notify('interface-input:push-url-btn', 'active');

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

        // toggle visible interface
            state.watch('interface', 'app', function(msg){

                var state, input_interface, progress_interface;
                    state = msg.notice;
                    input_interface = document.getElementById('task-wrapper');
                    progress_interface = document.getElementById('update-wrapper');

                if(state === 'reset'){ 

                    state.notify('interface', 'progress');
                    return;
                }

                switch( state ){

                    case 'progress':                        

                        removeClass(progress_interface, 'hidden');
                        addClass(input_interface, 'hidden');
                        break;

                    case 'input':
                    default:
                        
                        removeClass(input_interface, 'hidden');
                        addClass(progress_interface, 'hidden');
                        break;
                }
            });

        // toggle push url button state
            state.watch('interface-input:push-url-btn', 'push-url-btn', function(msg){

                var new_state, btn;

                    new_state = msg.notice;
                    btn = document.getElementById('push-url');

                    if( new_state === 'reset'){

                        state.notify('interface-input:push-url-btn', 'active');
                        return;
                    }
                    
                    switch( new_state ){

                        case 'active':
                            addClass(btn, 'hidden');
                        break;

                        case 'disabled':
                        default:
                            removeClass(btn, 'hidden');
                        break;
                    }
            });

        // toggle pushed location state
            state.watch('interface-progress:url-to-use', 'url-to-use', function(msg){

                var new_state, url, input, wrapper;

                    wrapper =  document.getElementById('url-to-use-wrapper');
                    input =  document.getElementById('url-to-use');
                    new_state = msg.notice.state;
                    url = msg.notice.url;

                if( new_state === 'reset'){

                    state.notify('interface-progress:url-to-use', 'disabled');
                    input.value = '';
                    return;
                }

                switch( new_state ){

                    case 'active':
                        removeClass(wrapper, 'hidden');
                        input.value = url;
                        break;

                    case 'disabled':
                    default:
                        addClass(wrapper, 'hidden');
                        break;
                }
            });

        // progress log
            state.watch('interface-progress:log', 'update-log', function(msg){

                var log_entry, wrapper;

                    wrapper = document.getElementById('update-log');
                    log_entry = msg.notice;

                wrapper.innerHTML += log_entry;
            });

        // download progress bar
            state.watch('interface-progress:download-bar', 'download-progress-bar', function(msg){

                var percent_downloaded, bar;

                    bar = document.getElementById('downloaded');
                    percent_downloaded = msg.notice + '%';

                bar.style.width = percent_downloaded;
            });

        // upload progress bar
            state.watch('interface-progress:upload-bar', 'upload-progress-bar', function(msg){

                var percent_uploaded, bar;

                    bar = document.getElementById('uploaded');
                    percent_uploaded = msg.notice + '%';

                bar.style.width = percent_uploaded;
            });

    // configure socket  

        // status reports from server
            socketio.on('status', function(report){

                var success, completed, message;

                    completed = report.completed;
                    success = report.success;
                    message = typeof report.msg !== 'undefined' ? report.msg : null;
                    size = typeof report.size !== 'undefined' ? report.size : null;
                    downloaded = typeof report.downloaded !== 'undefined' ? report.downloaded : null;

                if(state.cache['interface'] !== 'progress'){

                    if(message !== null){

                        alert( message );
                    }

                    if(size !== null){

                        state.notify('interface', 'progress');
                        state.notify('interface-progress:log', '<p><b>SIZE: ' + size +'</b></p>');
                    }
                }

                else{

                    if(message !== null){

                        state.notify('interface-progress:log', '<p>' + message + '</p>');
                    }

                    if(downloaded !== null || downloaded !== '100'){

                        state.notify('interface-progress:download-bar', downloaded);
                    }

                    if(success){

                        state.notify('interface-progress:upload-bar', 100);
                        state.notify('interface-progress:url-to-use', {state: 'active', url: report.url});
                    }
                }

                app.log(report);
            });


    document.getElementById('push-url').addEventListener('click', function(){
        
        var url_to_push, new_filename;

            url_to_push = document.getElementById('url-to-push').value;
            new_filename = document.getElementById('filename').value;

        if(!url_to_push){ alert('you haven\'t given me a URL to push'); return; }

        state.notify('interface-input:push-url-btn', 'disabled');

        socketio.emit('ftp-push', {resource: url_to_push, rename: new_filename});
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