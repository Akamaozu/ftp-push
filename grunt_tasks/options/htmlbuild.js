module.exports = {	

    bin: {
        src: '<%= templateDir %>/index.html.template', 
        dest: '<%= buildDir %>/index.html',
        options: {
            
            styles: {
                bundle: ['./node_modules/normalize.css/normalize.css', '<%= stylesDir %>/*'],
            },
        }
    }
}