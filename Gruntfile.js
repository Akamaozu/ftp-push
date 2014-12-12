module.exports = function(grunt){


  // default config for grunt tasks
    var config = {
      pkg: grunt.file.readJSON('package.json'),
      templateDir: 'templates',
      stylesDir: 'css',   
      buildDir: 'bin'
    };
  
  // autoload grunt task configs
    grunt.util._.extend(config, loadConfig('./grunt_tasks/options/'));
  
  // load configs 
    grunt.initConfig(config);

  // autoload grunt tasks (from package.json)
    require('load-grunt-tasks')(grunt, {

      scope: 'devDependencies',
      pattern: ['grunt-*', '!grunt-cli']
    });

  // default grunt task
      grunt.loadTasks('grunt_tasks');
      grunt.registerTask('default', ['build', 'start-server']);

  // helper function: autoload grunt configs from path
    function loadConfig(path) {
      
      var glob = require('glob');
      var object = {};
      var key;

      glob.sync('*', {cwd: path}).forEach(function(option) {
        key = option.replace(/\.js$/,'');
        object[key] = require(path + option);
      });

      return object;
    } 
}