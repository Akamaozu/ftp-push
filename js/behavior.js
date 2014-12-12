(function(){

    var noticeboard, app;

        noticeboard = require('cjs-noticeboard');
        
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

        // handle push endpoint response
            app.watch('push-endpoint-response', 'push-response-handler', function(msg){

                var response = JSON.parse(msg.notice);

                if(!response.success){ alert(response.msg); return; }

                alert(response.msg);

                document.getElementById('url-to-use').value = response.url;

                addClass(document.getElementById('task-wrapper'), 'hidden');
                removeClass(document.getElementById('update-wrapper'), 'hidden');
            });


    document.getElementById('push-url').addEventListener('click', function(){
        
        var url_to_push, new_filename;

            url_to_push = document.getElementById('url-to-push').value;
            new_filename = document.getElementById('filename').value;

        if(!url_to_push){ alert('you haven\'t given me a URL to push'); return; }

        var ajax;
        
        // code for IE7+, Firefox, Chrome, Opera, Safari
        if (window.XMLHttpRequest){
            ajax=new XMLHttpRequest();
        }
        
        // code for IE6, IE5
        else{
          ajax=new ActiveXObject("Microsoft.XMLHTTP");
        }

        ajax.open('POST', '/push', true);
        ajax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
        
        ajax.onreadystatechange = function(){

            // filter uncompleted responses
            if (ajax.readyState !=4){ return; }

            // success
            if ( ajax.status > 199 && ajax.status < 400 ){ 

                app.notify('push-endpoint-response', ajax.responseText, 'push-endpoint-ajax'); 
            }

            // fail
            else{ 

                alert('my server didn\'t get it -- please try again');

                app.log('FAILED AJAX\n', ajax); 
            }                      
        };

        ajax.send('resource=' + url_to_push + '&rename=' + new_filename);
        alert('pushing it to my server!');
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