module.exports = function(grunt){
	
	grunt.registerTask('deploy', function(remote, branch){

		var branch; 

		if(!remote){ 

    		grunt.fail.fatal('NO GIT REMOTE GIVEN TO DEPLOY TO\n\n* grunt deploy:<remote>:<local branch>\n\n');
		}

		if(!branch){

			branch = remote; 
		}

		grunt.task.run('shell:deploy:' + remote + ':' + branch);
	});
}