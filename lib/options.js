"use strict";

var fs   = require('fs');
var path = require('path'); 

var datadir = path.resolve(__dirname + '/../data/');

var dataFiles = fs.readdirSync(datadir);
if(dataFiles.indexOf('posts.db') == -1){fs.renameSync(datadir + '/posts.emptydb', datadir + '/posts.db');}
if(dataFiles.indexOf('peerlist.json') == -1){fs.renameSync(datadir + '/bootstrap.json', datadir + '/peerlist.json');}

var opt={
		socksPortNumber: 9999,
		controlPortNumber: 9998,
		listenPort: 47654,
		disableNetworking: false,
		powThreads: 2
	}, fOpt, p;

try { 
	fOpt = JSON.parse(fs.readFileSync(datadir + '/options.json', 'utf8'));
}catch(e){
	fOpt = {};	
}

function saveOptions(){
	fs.writeFile(datadir + '/options.json', JSON.stringify(opt, null, 2));
}

for(p in fOpt){
	opt[p] = fOpt[p];
}

saveOptions();
console.dir(opt);

exports = module.exports = {
	datadir: datadir,

	get: function(name){
		return opt[name];
	},

	set: function(name, val){
		opt[name] = val;
		saveOptions();
		return val;
	}
};
