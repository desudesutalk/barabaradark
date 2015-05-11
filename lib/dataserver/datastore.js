"use strict";

var opt  = require('../options.js');
var crpt = require('crypto');
var fs = require('fs'); 
var events = require('events');
var utils = require('util');
var ntp_time = require('../ntp_time.js');

var DataStore = function DataStore(){
	events.EventEmitter.call(this);
	this.folder = opt.datadir + '/datastore/';
	this.file = opt.datadir + '/datastore.json';
	
	try { 
  		this.list = JSON.parse(fs.readFileSync(this.file, 'utf8'));
	}catch(e){
		this.list = {};
		this.saveList();
	}
};
utils.inherits(DataStore, events.EventEmitter);

DataStore.prototype.saveList = function saveList(list){
	fs.writeFile(this.file, JSON.stringify(this.list, null, 2));
};

DataStore.prototype.addFile = function addFile(buf){
	
	var self = this,
		ts = buf.readUIntBE(11, 4),
		shasum = crpt.createHash('sha256'),
		content = buf.slice(5);
	
	shasum.update(content);

	var fname = shasum.digest('hex');

	if(fname in this.list) return false;
	
	fs.writeFileSync(this.folder + fname, content);
	
	this.list[fname] = {added: ts};
	this.saveList();

	
	self.emit('fileadded', fname, ts);
	
	return fname;
};

DataStore.prototype.getFile = function getFile(fname){
	if(!fname.match(/^[a-f0-9]{64}$/i)) return false;
	if(!(fname in this.list)) return false;
	return fs.readFileSync(this.folder + fname);
};

DataStore.prototype.getListDiff = function getListDiff(list){
	var need = [], have = [], a = this.list, b = list, f, i,
		now = Math.floor(ntp_time.now() / 1000);

	for(f in a){
		if(b.indexOf(f) != -1){
			continue;
		}

		if(now - a[f].added > 2 * 24 * 60 * 60) continue;
		
		have.push(f);
	}
	
	for (i = 0; i < b.length; i++) {
		if(b[i] in a){
			continue;
		}
		need.push(b[i]);
	}

	return {have: have, need: need};
};

DataStore.prototype.getList = function getList(){
	var have = [], a = this.list, f,
		now = Math.floor(Date.now() / 1000);

	for(f in a){
		if(now - a[f].added > 2 * 24 * 60 * 60) continue;
		
		have.push(f);
	}	
	return have;
};

DataStore.prototype.getNeeds = function getNeeds(list){
	var need = [], a = this.list, b = list;

	for (var i = 0; i < b.length; i++) {
		if(b[i] in a){
			continue;
		}
		need.push(b[i]);
	}

	return need;
};


module.exports = DataStore;
