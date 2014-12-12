module.exports = function(grunt){
	
	grunt.registerTask('build', ['browserifying', 'htmlbuild', 'clean']);
}