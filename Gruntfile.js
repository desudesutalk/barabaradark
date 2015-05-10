module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: ['lib/**/*.js', 'main.js'],
            options: {
                ignores: ['src/_tail.js','src/metablock.js','src/_head.js','src/_tail.js','src/crypto/*.js','src/libs/*.js'],
                strict: true,
                node: true,
                devel: true,
                browser: true
            }
        }
    });

    // Load required modules
    grunt.loadNpmTasks('grunt-contrib-jshint');

    // Task definitions
    grunt.registerTask('default', ['jshint']);
};
