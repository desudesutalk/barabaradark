"use strict";

var fs = require('fs'); 
var events = require('events');
var utils = require('util');
var ntp_time = require('../ntp_time.js');

var PeerList = function PeerList(dataDir, host){
	events.EventEmitter.call(this);
	this.file = dataDir + 'peerlist.json';
	this.host = host;
	this.aleadyTried = {};

	try { 
  		this.list = JSON.parse(fs.readFileSync(this.file, 'utf8'));
	}catch(e){
		this.list = {};
	}

	this.list[this.host] = {lastseen: Math.floor(ntp_time.now() / 1000)};
	this.saveList();
};
utils.inherits(PeerList, events.EventEmitter);

PeerList.prototype.addList = function addList(list){
	var added = {}, num = 0, p;

	for(p in list){
		if(!p.match(/^[a-z2-7]{16}\.onion$/i)) continue;
		if(p == this.host) continue;
		if(p in this.list) continue;
		added[p] = this.list[p] = list[p];
		num++;
	}

	if(num > 0){
		this.saveList();
		this.emit('peeradded', added);
	}
};

PeerList.prototype.saveList = function saveList(list){
	fs.writeFile(this.file, JSON.stringify(this.list, null, 2));
};

PeerList.prototype.peerSeen = function peerSeen(p){
	if(p in this.list){
		this.list[p].lastseen = Math.floor(ntp_time.now() / 1000);
		this.saveList();
	}
};

PeerList.prototype.getListDiff = function getListDiff(list){
	var diff = {}, cnt = 0, p;

	if(Object.keys(list).length === 0) return null;
	
	for(p in this.list){
		if(p in list) continue;
		diff[p] = this.list[p];
		cnt++;
	}
	
	if (cnt === 0) return null;
	return diff;
};

PeerList.prototype.getBootStrap = function getBootStrap(){
	var bootstrap = [], p;
	
	for(p in this.list){
		if(p == this.host) continue;
		bootstrap.push({host: p, lastseen: this.list[p].lastseen});
	}

	bootstrap.sort(function(a, b){return b.lastseen - a.lastseen;});

	for (var i = 0; i < bootstrap.length; i++) {
		this.aleadyTried[bootstrap[i].host] = Math.floor(ntp_time.now() / 1000);
	}

	return bootstrap.slice(0,8);	
};

PeerList.prototype.getPeer = function getPeer(){
	var peers = [], p,
		now = Math.floor(ntp_time.now() / 1000);
	
	for(p in this.list){
		if(p == this.host) continue;
		if(p in this.aleadyTried && (now - this.aleadyTried[p] < 600)) continue;
		if(p in this.aleadyTried && (now - this.aleadyTried[p] >= 600)) {
			this.aleadyTried[p] = undefined;
			delete this.aleadyTried[p];
		}
		peers.push({host: p, lastseen: this.list[p].lastseen});
	}

	if (peers.length === 0) return null;

	var peer = peers[Math.floor(Math.random()*peers.length)];

	this.aleadyTried[peer.host] = now;
	
	return peer.host;
};

module.exports = PeerList;
