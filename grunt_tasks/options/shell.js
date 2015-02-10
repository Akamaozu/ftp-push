module.exports = {
  
  deploy:{

    command: function(git_remote, git_branch){

    	if(!git_remote){ 

    		throw new Error('NO GIT REMOTE GIVEN TO DEPLOY TO\n\n* grunt shell:deploy:<remote>:<local branch>\n\n');
    	}

    	var git_branch = git_branch || git_remote; 

    	return 'git push ' + git_remote + ' ' + git_branch + ':master';
    }
  }
}